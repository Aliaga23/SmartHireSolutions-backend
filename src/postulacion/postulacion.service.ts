import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';

@Injectable()
export class PostulacionService {
  constructor(private prisma: PrismaService) {}

  async create(candidatoId: string, createPostulacionDto: CreatePostulacionDto) {
    const { vacanteId } = createPostulacionDto;

    // Verificar vacante existe/activa y postulación existente en paralelo
    const [vacante, existingPostulacion] = await Promise.all([
      this.prisma.vacante.findUnique({
        where: { id: vacanteId },
      }),
      this.prisma.postulacion.findUnique({
        where: {
          candidatoId_vacanteId: {
            candidatoId,
            vacanteId,
          },
        },
      }),
    ]);

    if (!vacante) {
      throw new NotFoundException('Vacante no encontrada');
    }

    if (vacante.estado === 'CERRADA') {
      throw new ConflictException('La vacante está cerrada');
    }

    if (existingPostulacion) {
      throw new ConflictException('Ya te has postulado a esta vacante');
    }

    // Crear la postulación (la compatibilidad se calculará con k-means)
    return this.prisma.postulacion.create({
      data: {
        candidatoId,
        vacanteId,
      },
      include: {
        vacante: {
          include: {
            empresa: true,
            modalidad: true,
            horario: true,
          },
        },
      },
    });
  }

  async findAllByCandidato(candidatoId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.postulacion.findMany({
        where: { candidatoId },
        include: {
          vacante: {
            select: {
              id: true,
              titulo: true,
              descripcion: true,
              salario_minimo: true,
              salario_maximo: true,
              estado: true,
              creado_en: true,
              empresa: {
                select: {
                  id: true,
                  name: true,
                  area: true,
                }
              },
              modalidad: {
                select: {
                  id: true,
                  nombre: true,
                }
              },
              horario: {
                select: {
                  id: true,
                  nombre: true,
                }
              },
            },
          },
        },
        orderBy: {
          creado_en: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.postulacion.count({ where: { candidatoId } }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAllByVacante(vacanteId: string, reclutadorId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.postulacion.findMany({
        where: { 
          vacanteId,
          vacante: {
            reclutadorId
          }
        },
        include: {
          candidato: {
            include: {
              usuario: {
                select: {
                  name: true,
                  lastname: true,
                  correo: true,
                  telefono: true,
                },
              },
              habilidadesCandidato: {
                include: {
                  habilidad: {
                    select: {
                      id: true,
                      nombre: true,
                      categoria: {
                        select: {
                          id: true,
                          nombre: true,
                        }
                      }
                    }
                  },
                },
              },
              lenguajesCandidato: {
                include: {
                  lenguaje: {
                    select: {
                      id: true,
                      nombre: true,
                    }
                  },
                },
              },
            },
          },
        },
        orderBy: {
          puntuacion_compatibilidad: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.postulacion.count({
        where: {
          vacanteId,
          vacante: {
            reclutadorId
          }
        }
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, usuarioId: string, role: string) {
    const whereClause = role === 'candidato' 
      ? { id, candidato: { usuarioId } }
      : { id, vacante: { reclutador: { usuarioId } } };

    const postulacion = await this.prisma.postulacion.findFirst({
      where: whereClause,
      select: {
        id: true,
        puntuacion_compatibilidad: true,
        creado_en: true,
        candidato: {
          select: {
            id: true,
            titulo: true,
            bio: true,
            ubicacion: true,
            foto_perfil_url: true,
            usuario: {
              select: {
                name: true,
                lastname: true,
                correo: true,
                telefono: true,
                fecha_nacimiento: true,
              }
            },
            habilidadesCandidato: {
              select: {
                id: true,
                nivel: true,
                habilidad: {
                  select: {
                    id: true,
                    nombre: true,
                  }
                }
              },
              orderBy: {
                nivel: 'desc',
              }
            },
            lenguajesCandidato: {
              select: {
                id: true,
                nivel: true,
                lenguaje: {
                  select: {
                    id: true,
                    nombre: true,
                  }
                }
              },
              orderBy: {
                nivel: 'desc',
              }
            },
            educaciones: {
              select: {
                id: true,
                titulo: true,
                institucion: true,
                estado: true,
                fecha_comienzo: true,
                fecha_final: true,
                descripcion: true,
              },
              orderBy: {
                fecha_comienzo: 'desc',
              },
            },
            experiencias: {
              select: {
                id: true,
                titulo: true,
                empresa: true,
                ubicacion: true,
                fecha_comienzo: true,
                fecha_final: true,
                descripcion: true,
              },
              orderBy: {
                fecha_comienzo: 'desc',
              },
            },
          },
        },
        vacante: {
          select: {
            id: true,
            titulo: true,
            descripcion: true,
            estado: true,
            salario_minimo: true,
            salario_maximo: true,
            empresa: {
              select: {
                id: true,
                name: true,
                area: true,
              }
            },
            modalidad: {
              select: {
                id: true,
                nombre: true,
              }
            },
            horario: {
              select: {
                id: true,
                nombre: true,
              }
            },
          },
        },
      },
    });

    if (!postulacion) {
      throw new NotFoundException('Postulacion no encontrada o no tienes permiso');
    }

    return postulacion;
  }

  async remove(id: string, candidatoId: string) {
    const postulacion = await this.prisma.postulacion.findFirst({
      where: { 
        id,
        candidatoId
      },
    });

    if (!postulacion) {
      throw new NotFoundException('Postulacion no encontrada o no tienes permiso');
    }

    return this.prisma.postulacion.delete({
      where: { id },
    });
  }
}
