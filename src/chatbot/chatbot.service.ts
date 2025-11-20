import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from './dto/chat-message.dto';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

interface ChatSession {
  sessionId: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
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

  constructor(private prisma: PrismaService) {
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

    // Llamar a GPT
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: session.messages as any,
      temperature: 0.7,
      max_tokens: 500,
    });

    const respuesta = completion.choices[0].message.content || 'Lo siento, no pude generar una respuesta.';

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
        context += `**Tipo:** Candidato\n`;
        context += `**Nombre:** ${candidato.usuario.name} ${candidato.usuario.lastname}\n`;
        context += `**Email:** ${candidato.usuario.correo}\n`;
        
        if (candidato.titulo) {
          context += `**Título profesional:** ${candidato.titulo}\n`;
        }
        
        if (candidato.ubicacion) {
          context += `**Ubicación:** ${candidato.ubicacion}\n`;
        }

        if (candidato.habilidadesCandidato.length > 0) {
          const habilidades = candidato.habilidadesCandidato
            .map(h => `${h.habilidad.nombre} (nivel ${h.nivel}/10)`)
            .join(', ');
          context += `**Habilidades principales:** ${habilidades}\n`;
        }

        if (candidato.lenguajesCandidato.length > 0) {
          const lenguajes = candidato.lenguajesCandidato
            .map(l => `${l.lenguaje.nombre} (nivel ${l.nivel}/10)`)
            .join(', ');
          context += `**Idiomas:** ${lenguajes}\n`;
        }

        if (candidato.experiencias.length > 0) {
          const experiencias = candidato.experiencias
            .map(e => `${e.titulo} en ${e.empresa}`)
            .join(', ');
          context += `**Experiencia reciente:** ${experiencias}\n`;
        }

        if (candidato.educaciones.length > 0) {
          const educaciones = candidato.educaciones
            .map(e => `${e.titulo} - ${e.institucion} (${e.estado})`)
            .join(', ');
          context += `**Educación:** ${educaciones}\n`;
        }

        if (candidato.postulaciones.length > 0) {
          context += `**Postulaciones recientes:** ${candidato.postulaciones.length} vacantes\n`;
          const postulaciones = candidato.postulaciones
            .map(p => `${p.vacante.titulo} en ${p.vacante.empresa.name} (compatibilidad: ${p.puntuacion_compatibilidad?.toFixed(0) || 'N/A'}%)`)
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
        context += `**Tipo:** Reclutador\n`;
        context += `**Nombre:** ${reclutador.usuario.name} ${reclutador.usuario.lastname}\n`;
        context += `**Email:** ${reclutador.usuario.correo}\n`;
        context += `**Empresa:** ${reclutador.empresa.name}\n`;
        
        if (reclutador.empresa.area) {
          context += `**Área de la empresa:** ${reclutador.empresa.area}\n`;
        }

        if (reclutador.posicion) {
          context += `**Posición:** ${reclutador.posicion}\n`;
        }

        if (reclutador.vacantes.length > 0) {
          context += `**Vacantes publicadas:** ${reclutador.vacantes.length}\n`;
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
}
