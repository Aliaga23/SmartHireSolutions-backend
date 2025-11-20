import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { UpdateCandidatoDto } from './dto/update-candidato.dto';
import { ParseCvDto } from './dto/parse-cv.dto';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';

@Injectable()
export class CandidatoService {
  private openai: OpenAI;

  constructor(private prisma: PrismaService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getProfile(candidatoId: string) {
    const candidato = await this.prisma.candidato.findUnique({
      where: { id: candidatoId },
      include: {
        usuario: {
          select: {
            name: true,
            lastname: true,
            correo: true,
            telefono: true,
            fecha_nacimiento: true,
          },
        },
        habilidadesCandidato: {
          include: {
            habilidad: {
              include: {
                categoria: true,
              },
            },
          },
          orderBy: { nivel: 'desc' },
        },
        lenguajesCandidato: {
          include: {
            lenguaje: true,
          },
          orderBy: { nivel: 'desc' },
        },
        _count: {
          select: {
            postulaciones: true,
          },
        },
      },
    });

    if (!candidato) {
      throw new NotFoundException('Candidato no encontrado');
    }

    return candidato;
  }

  async updateProfile(candidatoId: string, updateDto: UpdateCandidatoDto) {
    return this.prisma.candidato.update({
      where: { id: candidatoId },
      data: updateDto,
    });
  }

  async addHabilidad(candidatoId: string, habilidadId: string, nivel: number) {
    // Verificar que la habilidad existe y si ya está agregada
    const [habilidad, existing] = await Promise.all([
      this.prisma.habilidades.findUnique({
        where: { id: habilidadId },
      }),
      this.prisma.habilidadesCandidato.findUnique({
        where: {
          candidatoId_habilidadId: { candidatoId, habilidadId },
        },
      }),
    ]);

    if (!habilidad) {
      throw new NotFoundException('Habilidad no encontrada');
    }

    if (existing) {
      throw new ConflictException('Ya tienes esta habilidad agregada. Usa PUT para actualizar el nivel.');
    }

    return this.prisma.habilidadesCandidato.create({
      data: {
        candidatoId,
        habilidadId,
        nivel,
      },
      include: {
        habilidad: {
          include: {
            categoria: true,
          },
        },
      },
    });
  }

  async updateHabilidad(candidatoId: string, habilidadId: string, nivel: number) {
    return this.prisma.habilidadesCandidato.update({
      where: {
        candidatoId_habilidadId: {
          candidatoId,
          habilidadId,
        },
      },
      data: { nivel },
    });
  }

  async removeHabilidad(candidatoId: string, habilidadId: string) {
    await this.prisma.habilidadesCandidato.delete({
      where: {
        candidatoId_habilidadId: {
          candidatoId,
          habilidadId,
        },
      },
    });

    return { message: 'Habilidad eliminada del perfil' };
  }

  async addLenguaje(candidatoId: string, lenguajeId: string, nivel: number) {
    // Verificar que el lenguaje existe , mi amor porque la base esta tan laaaarga 
    const lenguaje = await this.prisma.lenguaje.findUnique({
      where: { id: lenguajeId },
    });

    if (!lenguaje) {
      throw new NotFoundException('Lenguaje no encontrado');
    }

    return this.prisma.lenguajeCandidato.create({
      data: {
        candidatoId,
        lenguajeId,
        nivel,
      },
      include: {
        lenguaje: true,
      },
    });
  }

  async updateLenguaje(candidatoId: string, lenguajeId: string, nivel: number) {
    return this.prisma.lenguajeCandidato.update({
      where: {
        candidatoId_lenguajeId: {
          candidatoId,
          lenguajeId,
        },
      },
      data: { nivel },
    });
  }

  async removeLenguaje(candidatoId: string, lenguajeId: string) {
    await this.prisma.lenguajeCandidato.delete({
      where: {
        candidatoId_lenguajeId: {
          candidatoId,
          lenguajeId,
        },
      },
    });

    return { message: 'Lenguaje eliminado del perfil' };
  }

  async searchCandidatos(filtros?: { habilidadId?: string; ubicacion?: string }) {
    const where: any = {};

    if (filtros?.ubicacion) {
      where.ubicacion = {
        contains: filtros.ubicacion,
        mode: 'insensitive',
      };
    }

    const candidatos = await this.prisma.candidato.findMany({
      where,
      include: {
        usuario: {
          select: {
            name: true,
            lastname: true,
          },
        },
        habilidadesCandidato: {
          include: {
            habilidad: true,
          },
          take: 5,
          orderBy: { nivel: 'desc' },
        },
        _count: {
          select: {
            habilidadesCandidato: true,
            lenguajesCandidato: true,
          },
        },
      },
    });

    // Si se filtra por habilidad, ordenar por candidatos que la tienen
    if (filtros?.habilidadId) {
      return candidatos.filter((c) =>
        c.habilidadesCandidato.some((h) => h.habilidadId === filtros.habilidadId),
      );
    }

    return candidatos;
  }

  async parseCvWithGPT(candidatoId: string, parseCvDto: ParseCvDto) {
    const { imageData } = parseCvDto;

    // 1. Obtener todas las habilidades y lenguajes disponibles de la BD
    const [todasHabilidades, todosLenguajes] = await Promise.all([
      this.prisma.habilidades.findMany({
        select: { id: true, nombre: true },
      }),
      this.prisma.lenguaje.findMany({
        select: { id: true, nombre: true },
      }),
    ]);

    const habilidadesDisponibles = todasHabilidades.map(h => h.nombre).join(', ');
    const lenguajesDisponibles = todosLenguajes.map(l => l.nombre).join(', ');

    // 2. Usar GPT-4 Vision para extraer información estructurada del CV
    const prompt = `Analiza la imagen del CV y extrae la información estructurada.

Habilidades técnicas disponibles en el sistema: ${habilidadesDisponibles}

Idiomas disponibles en el sistema: ${lenguajesDisponibles}

INSTRUCCIONES:
1. Lee TODO el texto visible en la imagen del CV
2. Para "bio": Resume la experiencia profesional en 2-3 oraciones (máximo 200 palabras)
3. Para "titulo": Extrae el título profesional actual o el puesto más reciente
4. Para "ubicacion": Extrae la ciudad/país de residencia
5. Para "habilidades": Identifica SOLO las habilidades que coincidan EXACTAMENTE con las disponibles en el sistema. Para cada una, asigna un nivel del 1-10 basado en la experiencia mencionada
6. Para "lenguajes": Identifica SOLO los idiomas que coincidan con los disponibles. Asigna nivel 1-10 (1-3=básico, 4-6=intermedio, 7-8=avanzado, 9-10=nativo)

Responde SOLO con un JSON en este formato exacto:
{
  "bio": "texto aquí",
  "titulo": "texto aquí",
  "ubicacion": "texto aquí",
  "habilidades": [
    { "nombre": "nombre exacto de la habilidad", "nivel": 7 }
  ],
  "lenguajes": [
    { "nombre": "nombre exacto del idioma", "nivel": 8 }
  ]
}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageData,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const datosExtraidos = JSON.parse(response.choices[0].message.content || '{}');

    // 3. Crear mapas de búsqueda para habilidades y lenguajes
    const habilidadMap = new Map(todasHabilidades.map(h => [h.nombre.toLowerCase(), h.id]));
    const lenguajeMap = new Map(todosLenguajes.map(l => [l.nombre.toLowerCase(), l.id]));

    // 4. Actualizar perfil del candidato
    await this.prisma.candidato.update({
      where: { id: candidatoId },
      data: {
        bio: datosExtraidos.bio,
        titulo: datosExtraidos.titulo,
        ubicacion: datosExtraidos.ubicacion,
      },
    });

    // 5. Agregar habilidades en batch (usando createMany)
    const habilidadesParaCrear = datosExtraidos.habilidades
      ?.map((hab: any) => {
        const habilidadId = habilidadMap.get(hab.nombre.toLowerCase());
        if (habilidadId) {
          return {
            candidatoId,
            habilidadId,
            nivel: hab.nivel,
          };
        }
        return null;
      })
      .filter((h: any) => h !== null) || [];

    // 6. Agregar lenguajes en batch
    const lenguajesParaCrear = datosExtraidos.lenguajes
      ?.map((lang: any) => {
        const lenguajeId = lenguajeMap.get(lang.nombre.toLowerCase());
        if (lenguajeId) {
          return {
            candidatoId,
            lenguajeId,
            nivel: lang.nivel,
          };
        }
        return null;
      })
      .filter((l: any) => l !== null) || [];

    // 7. Ejecutar inserciones en paralelo
    await Promise.all([
      habilidadesParaCrear.length > 0
        ? this.prisma.habilidadesCandidato.createMany({
            data: habilidadesParaCrear,
            skipDuplicates: true,
          })
        : Promise.resolve(),
      lenguajesParaCrear.length > 0
        ? this.prisma.lenguajeCandidato.createMany({
            data: lenguajesParaCrear,
            skipDuplicates: true,
          })
        : Promise.resolve(),
    ]);

    // 8. Retornar el perfil actualizado
    return this.getProfile(candidatoId);
  }
}
