import { Injectable, ConflictException } from '@nestjs/common';
import { ChatMessageDto } from './dto/chat-message.dto';
import { PrismaService } from '../prisma/prisma.service';
import { VacanteService } from '../vacante/vacante.service';
import { PostulacionService } from '../postulacion/postulacion.service';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

interface ChatSession {
  sessionId: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string }>;
  createdAt: Date;
  lastActive: Date;
}

@Injectable()
export class ChatbotService {
  private openai: OpenAI;
  private sessions: Map<string, ChatSession> = new Map();
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos

  private readonly SYSTEM_CONTEXT = `Eres un asistente virtual experto de SmartHireSolutions, una plataforma de reclutamiento inteligente que conecta candidatos con empresas.

**INFORMACIÓN DEL SISTEMA:**

**¿Qué es SmartHireSolutions?**
SmartHireSolutions es una plataforma de reclutamiento que usa inteligencia artificial (IA) para:
- Encontrar los mejores candidatos para cada vacante
- Generar recomendaciones personalizadas de cursos para candidatos
- Calcular compatibilidad entre candidatos y vacantes usando algoritmos de machine learning (K-Means)

**TIPOS DE USUARIOS:**

1. **Candidatos:**
   - Crean su perfil con habilidades, idiomas y experiencia
   - Se postulan a vacantes
   - Reciben recomendaciones personalizadas de cursos según las habilidades que les faltan
   - Pueden escanear su CV con IA para auto-completar su perfil

2. **Reclutadores:**
   - Publican vacantes definiendo habilidades requeridas
   - Ven candidatos ordenados por compatibilidad (algoritmo K-Means)
   - Gestionan postulaciones
   - Pertenecen a una empresa

3. **Empresas:**
   - Tienen uno o más reclutadores
   - Publican vacantes
   - Reciben postulaciones

**FUNCIONALIDADES PRINCIPALES:**

**Para Candidatos:**
- Crear perfil profesional (bio, título, ubicación)
- Agregar habilidades técnicas con niveles (1-10)
- Agregar idiomas con niveles
- Postularse a vacantes
- Escanear CV con OCR + IA para llenar perfil automáticamente
- Recibir recomendaciones de cursos personalizadas con IA

**Para Reclutadores:**
- Crear vacantes (título, descripción, salario, modalidad, horario)
- Definir habilidades requeridas con niveles
- Ver candidatos rankeados por compatibilidad
- Procesar matching con algoritmo K-Means
- Ver diferencias de habilidades de cada candidato

**Sistema de Matching (K-Means):**
- Calcula compatibilidad entre candidatos y vacantes
- Usa algoritmo de clustering K-Means
- Considera: habilidades, idiomas, experiencia
- Genera score de compatibilidad (0-100)
- Identifica gaps de habilidades

**Sistema de Recomendaciones:**
- Detecta habilidades faltantes en candidatos
- Busca cursos relevantes en base de datos
- Genera mensajes personalizados con GPT
- Recomienda 1 curso por habilidad (el más cercano al nivel requerido)
- Cursos de Udemy, Coursera, Pluralsight, MongoDB University

**CATÁLOGO DE CURSOS:**
El sistema tiene más de 150 cursos reales en tecnologías como:
- Frontend: React, Angular, Vue, Next.js, HTML5, CSS3, Tailwind
- Backend: Node.js, NestJS, Python, Django, Flask, Java, Spring Boot
- Bases de datos: PostgreSQL, MongoDB, MySQL, Redis
- DevOps: Docker, Kubernetes, Jenkins, GitHub Actions, Terraform
- Mobile: React Native, Flutter, Swift, Kotlin
- Testing: Jest, Cypress, Selenium, Pytest
- Soft Skills: Comunicación, Liderazgo, Trabajo en equipo

**CARACTERÍSTICAS TÉCNICAS:**
- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL con Prisma ORM
- IA: OpenAI GPT-4o-mini para mensajes personalizados
- Machine Learning: Microservicio Python con K-Means
- Autenticación: JWT
- OCR: Para escanear CVs

**FLUJO TÍPICO:**

1. **Candidato se registra** → Completa perfil (manual o escaneando CV)
2. **Busca vacantes** → Se postula a las que le interesan
3. **Reclutador publica vacante** → Define requisitos
4. **Sistema ejecuta matching** → Calcula compatibilidad con K-Means
5. **Genera recomendaciones** → IA crea mensajes y sugiere cursos
6. **Candidato ve recomendaciones** → Puede tomar cursos sugeridos
7. **Reclutador ve ranking** → Candidatos ordenados por compatibilidad

**TU ROL:**
- Guía a usuarios sobre cómo usar la plataforma
- Explica funcionalidades de forma clara y amigable
- NO des información técnica de endpoints o código
- Enfócate en casos de uso y flujos de usuario
- Sé conciso pero completo
- Si no sabes algo, di que no tienes esa información`;

  constructor(
    private prisma: PrismaService,
    private vacanteService: VacanteService,
    private postulacionService: PostulacionService,
  ) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Limpiar sesiones expiradas cada 10 minutos
    setInterval(() => this.cleanExpiredSessions(), 10 * 60 * 1000);
  }

  async chat(chatMessageDto: ChatMessageDto, user?: any): Promise<{ sessionId: string; respuesta: string }> {
    let sessionId = chatMessageDto.sessionId || randomUUID();
    let session: ChatSession;

    // Crear contexto personalizado si el usuario está autenticado
    let systemContext = this.SYSTEM_CONTEXT;
    
    if (user) {
      const userInfo = await this.getUserContext(user);
      systemContext += `\n\n**INFORMACIÓN DEL USUARIO ACTUAL:**\n${userInfo}`;
    }

    // Agregar contexto de navegación si está disponible
    if (chatMessageDto.contexto) {
      systemContext += `\n\n**CONTEXTO DE NAVEGACIÓN:**`;
      if (chatMessageDto.contexto.pagina) {
        systemContext += `\n- Página actual: ${chatMessageDto.contexto.pagina}`;
      }
      if (chatMessageDto.contexto.seccion) {
        systemContext += `\n- Sección: ${chatMessageDto.contexto.seccion}`;
      }
      if (chatMessageDto.contexto.accion) {
        systemContext += `\n- Acción: ${chatMessageDto.contexto.accion}`;
      }
      systemContext += `\n\nUsa este contexto para dar respuestas más específicas y relevantes a la ubicación actual del usuario.`;
    }

    // Crear o recuperar sesión
    if (!this.sessions.has(sessionId)) {
      session = {
        sessionId,
        messages: [{ role: 'system', content: systemContext }],
        createdAt: new Date(),
        lastActive: new Date(),
      };
      this.sessions.set(sessionId, session);
    } else {
      session = this.sessions.get(sessionId)!;
      session.lastActive = new Date();
    }

    // Agregar mensaje del usuario
    session.messages.push({
      role: 'user',
      content: chatMessageDto.mensaje,
    });

    // Definir funciones disponibles para GPT (solo si el usuario está autenticado)
    const tools = user ? [
      {
        type: 'function',
        function: {
          name: 'buscar_vacantes',
          description: 'Busca vacantes disponibles según criterios específicos como título, empresa, habilidades, salario, etc.',
          parameters: {
            type: 'object',
            properties: {
              titulo: {
                type: 'string',
                description: 'Título o palabra clave para buscar en el título de la vacante'
              },
              empresaId: {
                type: 'string',
                description: 'ID de la empresa para filtrar vacantes'
              },
              habilidadId: {
                type: 'string',
                description: 'ID de habilidad requerida'
              },
              salarioMin: {
                type: 'number',
                description: 'Salario mínimo deseado'
              },
              limit: {
                type: 'number',
                description: 'Cantidad máxima de resultados (por defecto 5)',
                default: 5
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'postular_vacante',
          description: 'Postula al candidato autenticado a una vacante específica usando su ID',
          parameters: {
            type: 'object',
            properties: {
              vacanteId: {
                type: 'string',
                description: 'ID de la vacante a la que se desea postular'
              }
            },
            required: ['vacanteId']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'mis_postulaciones',
          description: 'Obtiene todas las postulaciones del candidato autenticado con información detallada de cada vacante y estado',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      }
    ] : undefined;

    // Llamar a GPT
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: session.messages as any,
      tools: tools as any,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500,
    });

    const responseMessage = completion.choices[0].message;

    // Si GPT decidió llamar a una función
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Agregar la respuesta de GPT con tool_calls al historial
      session.messages.push(responseMessage as any);

      // Procesar cada llamada a función
      for (const toolCall of responseMessage.tool_calls) {
        // Type guard para asegurar que tenemos el tipo correcto
        if (toolCall.type === 'function') {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          let functionResult;

          try {
            if (functionName === 'buscar_vacantes') {
              functionResult = await this.buscarVacantes(functionArgs);
            } else if (functionName === 'postular_vacante') {
              functionResult = await this.postularVacante(user.candidato?.id, functionArgs.vacanteId);
            } else if (functionName === 'mis_postulaciones') {
              functionResult = await this.obtenerMisPostulaciones(user.candidato?.id);
            }
          } catch (error) {
            functionResult = { error: error.message };
          }

          // Agregar resultado de la función al historial
          session.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(functionResult),
          } as any);
        }
      }

      // Llamar a GPT nuevamente con los resultados de las funciones
      const secondCompletion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: session.messages as any,
        temperature: 0.7,
        max_tokens: 500,
      });

      const respuesta = secondCompletion.choices[0].message.content || 'Lo siento, no pude generar una respuesta.';

      session.messages.push({
        role: 'assistant',
        content: respuesta,
      });

      return {
        sessionId,
        respuesta,
      };
    }

    // Si no hubo tool calls, procesar normalmente
    const respuesta = responseMessage.content || 'Lo siento, no pude generar una respuesta.';

    // Guardar respuesta del asistente
    session.messages.push({
      role: 'assistant',
      content: respuesta,
    });

    return {
      sessionId,
      respuesta,
    };
  }

  async getSessionHistory(sessionId: string): Promise<Array<{ role: string; content: string }>> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    // Retornar solo mensajes user/assistant (sin el system)
    return session.messages.filter(m => m.role !== 'system');
  }

  async clearSession(sessionId: string): Promise<{ message: string }> {
    if (this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      return { message: 'Sesión eliminada exitosamente' };
    }
    return { message: 'Sesión no encontrada' };
  }

  private async getUserContext(user: any): Promise<string> {
    if (!user) return '';

    let context = '';

    // Si es candidato
    if (user.candidato) {
      const candidato = await this.prisma.candidato.findUnique({
        where: { id: user.candidato.id },
        include: {
          usuario: {
            select: {
              name: true,
              lastname: true,
              correo: true,
            },
          },
          habilidadesCandidato: {
            include: {
              habilidad: true,
            },
            take: 10,
            orderBy: { nivel: 'desc' },
          },
          lenguajesCandidato: {
            include: {
              lenguaje: true,
            },
          },
          experiencias: {
            select: {
              titulo: true,
              empresa: true,
            },
            take: 3,
            orderBy: { fecha_comienzo: 'desc' },
          },
          educaciones: {
            select: {
              titulo: true,
              institucion: true,
              estado: true,
            },
            take: 2,
          },
          postulaciones: {
            select: {
              vacante: {
                select: {
                  titulo: true,
                  empresa: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              puntuacion_compatibilidad: true,
            },
            take: 5,
            orderBy: { creado_en: 'desc' },
          },
        },
      });

      if (candidato) {
        context += `Tipo: Candidato\n`;
        context += `Nombre: ${candidato.usuario.name} ${candidato.usuario.lastname}\n`;
        context += `Email: ${candidato.usuario.correo}\n`;
        
        if (candidato.titulo) {
          context += `Título profesional: ${candidato.titulo}\n`;
        }
        
        if (candidato.ubicacion) {
          context += `Ubicación: ${candidato.ubicacion}\n`;
        }

        if (candidato.habilidadesCandidato.length > 0) {
          const habilidades = candidato.habilidadesCandidato
            .map(h => `${h.habilidad.nombre} (nivel ${h.nivel}/10)`)
            .join(', ');
          context += `Habilidades principales: ${habilidades}\n`;
        }

        if (candidato.lenguajesCandidato.length > 0) {
          const lenguajes = candidato.lenguajesCandidato
            .map(l => `${l.lenguaje.nombre} (nivel ${l.nivel}/10)`)
            .join(', ');
          context += `Idiomas: ${lenguajes}\n`;
        }

        if (candidato.experiencias.length > 0) {
          const experiencias = candidato.experiencias
            .map(e => `${e.titulo} en ${e.empresa}`)
            .join(', ');
          context += `Experiencia reciente: ${experiencias}\n`;
        }

        if (candidato.educaciones.length > 0) {
          const educaciones = candidato.educaciones
            .map(e => `${e.titulo} - ${e.institucion} (${e.estado})`)
            .join(', ');
          context += `Educación: ${educaciones}\n`;
        }

        if (candidato.postulaciones.length > 0) {
          context += `Postulaciones recientes: ${candidato.postulaciones.length} vacantes\n`;
          const postulaciones = candidato.postulaciones
            .map(p => {
              const compatibilidad = p.puntuacion_compatibilidad !== null && p.puntuacion_compatibilidad !== undefined
                ? `${(Number(p.puntuacion_compatibilidad) * 100).toFixed(1)}%`
                : 'Pendiente';
              return `${p.vacante.titulo} en ${p.vacante.empresa.name} (compatibilidad: ${compatibilidad})`;
            })
            .slice(0, 3)
            .join(', ');
          context += `  - ${postulaciones}\n`;
        }
      }
    }

    // Si es reclutador
    if (user.reclutador) {
      const reclutador = await this.prisma.reclutador.findUnique({
        where: { id: user.reclutador.id },
        include: {
          usuario: {
            select: {
              name: true,
              lastname: true,
              correo: true,
            },
          },
          empresa: {
            select: {
              name: true,
              area: true,
            },
          },
          vacantes: {
            select: {
              titulo: true,
              estado: true,
              _count: {
                select: {
                  postulaciones: true,
                },
              },
            },
            take: 5,
            orderBy: { creado_en: 'desc' },
          },
        },
      });

      if (reclutador) {
        context += `Tipo: Reclutador\n`;
        context += `Nombre: ${reclutador.usuario.name} ${reclutador.usuario.lastname}\n`;
        context += `Email: ${reclutador.usuario.correo}\n`;
        context += `Empresa: ${reclutador.empresa.name}\n`;
        
        if (reclutador.empresa.area) {
          context += `Área de la empresa: ${reclutador.empresa.area}\n`;
        }

        if (reclutador.posicion) {
          context += `Posición: ${reclutador.posicion}\n`;
        }

        if (reclutador.vacantes.length > 0) {
          context += `Vacantes publicadas: ${reclutador.vacantes.length}\n`;
          const vacantes = reclutador.vacantes
            .map(v => `${v.titulo} (${v.estado}, ${v._count.postulaciones} postulaciones)`)
            .slice(0, 3)
            .join(', ');
          context += `  - ${vacantes}\n`;
        }
      }
    }

    return context;
  }

  private cleanExpiredSessions() {
    const now = new Date().getTime();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActive.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Busca vacantes disponibles según criterios específicos
   */
  private async buscarVacantes(params: {
    titulo?: string;
    empresaId?: string;
    habilidadId?: string;
    salarioMin?: number;
    limit?: number;
  }) {
    try {
      const limit = params.limit || 5;
      
      const result = await this.vacanteService.findAll(
        {
          titulo: params.titulo,
          empresaId: params.empresaId,
          habilidadId: params.habilidadId,
          salarioMin: params.salarioMin,
          estado: 'ABIERTA', // Solo vacantes abiertas
        },
        1,
        limit,
      );

      // Formatear resultado para GPT
      return {
        vacantes: result.data.map((v: any) => ({
          id: v.id,
          titulo: v.titulo,
          descripcion: v.descripcion,
          empresa: v.empresa?.nombre || 'N/A',
          salario: `${v.salario_minimo || 0} - ${v.salario_maximo || 0}`,
          modalidad: v.modalidad?.nombre || 'N/A',
          horario: v.horario?.nombre || 'N/A',
          ubicacion: v.ubicacion || 'N/A',
          postulaciones: v._count?.postulaciones || 0,
        })),
        total: result.pagination.total,
        mensaje: result.data.length === 0 
          ? 'No se encontraron vacantes con esos criterios.'
          : `Se encontraron ${result.pagination.total} vacante(s).`,
      };
    } catch (error) {
      return {
        error: 'Error al buscar vacantes',
        mensaje: error.message,
      };
    }
  }

  /**
   * Postula a un candidato a una vacante específica
   */
  private async postularVacante(candidatoId: string, vacanteId: string) {
    try {
      if (!candidatoId) {
        return {
          error: 'Usuario no autenticado',
          mensaje: 'Debes iniciar sesión como candidato para postularte a vacantes.',
        };
      }

      const postulacion = await this.postulacionService.create(candidatoId, { vacanteId });

      return {
        success: true,
        mensaje: `Te has postulado exitosamente a la vacante "${postulacion.vacante.titulo}".`,
        postulacion: {
          id: postulacion.id,
          vacante: postulacion.vacante.titulo,
          fecha: postulacion.creado_en,
        },
      };
    } catch (error) {
      // Manejar errores específicos
      if (error instanceof ConflictException) {
        return {
          error: 'Postulación duplicada',
          mensaje: error.message,
        };
      }

      return {
        error: 'Error al postular',
        mensaje: error.message || 'No se pudo completar la postulación.',
      };
    }
  }

  /**
   * Obtiene todas las postulaciones del candidato autenticado
   */
  private async obtenerMisPostulaciones(candidatoId: string) {
    try {
      if (!candidatoId) {
        return {
          error: 'Usuario no autenticado',
          mensaje: 'Debes iniciar sesión como candidato para ver tus postulaciones.',
        };
      }

      const postulaciones = await this.prisma.postulacion.findMany({
        where: { candidatoId },
        include: {
          vacante: {
            include: {
              empresa: { select: { name: true } },
              modalidad: { select: { nombre: true } },
              horario: { select: { nombre: true } },
            },
          },
        },
        orderBy: { creado_en: 'desc' },
      });

      return {
        total: postulaciones.length,
        postulaciones: postulaciones.map((p) => ({
          id: p.id,
          vacanteId: p.vacanteId,
          vacanteTitulo: p.vacante.titulo,
          empresa: p.vacante.empresa.name,
          salario: `${p.vacante.salario_minimo || 0} - ${p.vacante.salario_maximo || 0}`,
          modalidad: p.vacante.modalidad?.nombre || 'N/A',
          horario: p.vacante.horario?.nombre || 'N/A',
          fechaPostulacion: p.creado_en.toLocaleDateString('es-ES'),
          compatibilidad: p.puntuacion_compatibilidad !== null && p.puntuacion_compatibilidad !== undefined
            ? `${(Number(p.puntuacion_compatibilidad) * 100).toFixed(1)}%` 
            : 'Pendiente de calcular',
          estadoVacante: p.vacante.estado,
        })),
        mensaje: postulaciones.length === 0 
          ? 'No tienes postulaciones aún.' 
          : `Tienes ${postulaciones.length} postulación(es).`,
      };
    } catch (error) {
      return {
        error: 'Error al obtener postulaciones',
        mensaje: error.message,
      };
    }
  }
}