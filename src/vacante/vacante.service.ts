import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateVacanteDto } from './dto/create-vacante.dto';
import { UpdateVacanteDto } from './dto/update-vacante.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface FilterVacantesDto {
  estado?: string;
  empresaId?: string;
  modalidadId?: string;
  horarioId?: string;
  habilidadId?: string;
  lenguajeId?: string;
  nivelHabilidadMin?: number;
  nivelLenguajeMin?: number;
  salarioMin?: number;
  salarioMax?: number;
}

@Injectable()
export class VacanteService {
  constructor(private prisma: PrismaService) {}

  async create(createVacanteDto: CreateVacanteDto, reclutadorId: string) {
    const reclutador = await this.prisma.reclutador.findFirst({
      where: { 
        id: reclutadorId,
        empresaId: createVacanteDto.empresaId 
      },
      select: { id: true }
    });

    if (!reclutador) {
      throw new ForbiddenException('No puedes crear vacantes para esta empresa');
    }

    const { habilidades, lenguajes, ...vacanteData } = createVacanteDto;

    return this.prisma.$transaction(async (prisma) => {
      const vacante = await prisma.vacante.create({
        data: {
          ...vacanteData,
          reclutadorId,
          estado: 'ABIERTA',
        },
      });

      // Crear habilidades y lenguajes en paralelo
      await Promise.all([
        habilidades?.length ? prisma.habilidadesVacante.createMany({
          data: habilidades.map(h => ({
            vacanteId: vacante.id,
            habilidadId: h.habilidadId,
            nivel: h.nivel,
            requerido: h.requerido,
          })),
        }) : Promise.resolve(),
        lenguajes?.length ? prisma.lenguajeVacante.createMany({
          data: lenguajes.map(l => ({
            vacanteId: vacante.id,
            lenguajeId: l.lenguajeId,
            nivel: l.nivel,
          })),
        }) : Promise.resolve(),
      ]);

      // Retornar vacante completa
      return prisma.vacante.findUnique({
        where: { id: vacante.id },
        include: {
          empresa: true,
          reclutador: { include: { usuario: { select: { name: true, lastname: true, correo: true } } } },
          modalidad: true,
          horario: true,
          habilidadesVacante: {
            include: {
              habilidad: {
                include: { categoria: true }
              }
            }
          },
          lenguajesVacante: {
            include: { lenguaje: true }
          },
          _count: {
            select: { postulaciones: true },
          },
        },
      });
    });
  }

  async findAll(
    filtros?: FilterVacantesDto,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filtros?.estado) where.estado = filtros.estado;
    if (filtros?.empresaId) where.empresaId = filtros.empresaId;
    if (filtros?.modalidadId) where.modalidadId = filtros.modalidadId;
    if (filtros?.horarioId) where.horarioId = filtros.horarioId;

    // Filtros de salario
    if (filtros?.salarioMin !== undefined || filtros?.salarioMax !== undefined) {
      where.AND = [];
      if (filtros.salarioMin !== undefined) {
        where.AND.push({ salario_maximo: { gte: filtros.salarioMin } });
      }
      if (filtros.salarioMax !== undefined) {
        where.AND.push({ salario_minimo: { lte: filtros.salarioMax } });
      }
    }

    // Filtros de habilidades
    if (filtros?.habilidadId) {
      where.habilidadesVacante = {
        some: {
          habilidadId: filtros.habilidadId,
          ...(filtros.nivelHabilidadMin && {
            nivel: { gte: filtros.nivelHabilidadMin },
          }),
        },
      };
    }

    // Filtros de lenguajes
    if (filtros?.lenguajeId) {
      where.lenguajesVacante = {
        some: {
          lenguajeId: filtros.lenguajeId,
          ...(filtros.nivelLenguajeMin && {
            nivel: { gte: filtros.nivelLenguajeMin },
          }),
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.vacante.findMany({
        where,
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
            },
          },
          modalidad: {
            select: {
              id: true,
              nombre: true,
            },
          },
          horario: {
            select: {
              id: true,
              nombre: true,
            },
          },
          habilidadesVacante: {
            select: {
              nivel: true,
              requerido: true,
              habilidad: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          lenguajesVacante: {
            select: {
              nivel: true,
              lenguaje: {
                select: {
                  id: true,
                  nombre: true,
                },
              },
            },
          },
          _count: {
            select: { postulaciones: true },
          },
        },
        orderBy: { creado_en: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vacante.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filtrosAplicados: filtros,
    };
  }

  async findOne(id: string) {
    const vacante = await this.prisma.vacante.findUnique({
      where: { id },
      include: {
        empresa: true,
        reclutador: { include: { usuario: { select: { name: true, lastname: true, correo: true } } } },
        modalidad: true,
        horario: true,
        habilidadesVacante: {
          include: { habilidad: { include: { categoria: true } } },
        },
        lenguajesVacante: {
          include: { lenguaje: true },
        },
        _count: {
          select: { postulaciones: true },
        },
      },
    });

    if (!vacante) {
      throw new NotFoundException(`Vacante con ID ${id} no encontrada`);
    }

    return vacante;
  }

  async update(id: string, updateVacanteDto: UpdateVacanteDto, reclutadorId: string) {
    const vacante = await this.prisma.vacante.findFirst({
      where: { 
        id,
        reclutadorId 
      },
    });

    if (!vacante) {
      throw new ForbiddenException('Vacante no encontrada o no tienes permiso para editarla');
    }

    return this.prisma.vacante.update({
      where: { id },
      data: updateVacanteDto,
      include: {
        empresa: true,
        modalidad: true,
        horario: true,
      },
    });
  }

  async remove(id: string, reclutadorId: string) {
    const vacante = await this.prisma.vacante.findFirst({
      where: { 
        id,
        reclutadorId 
      },
    });

    if (!vacante) {
      throw new ForbiddenException('Vacante no encontrada o no tienes permiso para eliminarla');
    }

    // Eliminar relaciones antes de eliminar la vacante
    await Promise.all([
      this.prisma.habilidadesVacante.deleteMany({ where: { vacanteId: id } }),
      this.prisma.lenguajeVacante.deleteMany({ where: { vacanteId: id } }),
      this.prisma.postulacion.deleteMany({ where: { vacanteId: id } }),
    ]);

    await this.prisma.vacante.delete({ where: { id } });
    return { message: 'Vacante eliminada exitosamente' };
  }

  async updateEstado(id: string, estado: string, reclutadorId: string) {
    const vacante = await this.prisma.vacante.findFirst({
      where: { 
        id,
        reclutadorId 
      },
    });

    if (!vacante) {
      throw new ForbiddenException('Vacante no encontrada o no tienes permiso para modificarla');
    }

    return this.prisma.vacante.update({
      where: { id },
      data: { estado },
    });
  }

  async addHabilidad(vacanteId: string, habilidadId: string, nivel: number, requerido: string, reclutadorId: string) {
    const [vacante, habilidad] = await Promise.all([
      this.prisma.vacante.findFirst({
        where: { 
          id: vacanteId,
          reclutadorId 
        },
      }),
      this.prisma.habilidades.findUnique({
        where: { id: habilidadId },
      }),
    ]);

    if (!vacante) {
      throw new ForbiddenException('Vacante no encontrada o no tienes permiso para modificarla');
    }

    if (!habilidad) {
      throw new NotFoundException(`Habilidad con ID ${habilidadId} no encontrada`);
    }

    return this.prisma.habilidadesVacante.create({
      data: {
        vacanteId,
        habilidadId,
        nivel,
        requerido,
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

  async removeHabilidad(vacanteId: string, habilidadId: string, reclutadorId: string) {
    const vacante = await this.prisma.vacante.findFirst({
      where: { 
        id: vacanteId,
        reclutadorId 
      },
    });

    if (!vacante) {
      throw new ForbiddenException('Vacante no encontrada o no tienes permiso para modificarla');
    }

    await this.prisma.habilidadesVacante.delete({
      where: {
        vacanteId_habilidadId: {
          vacanteId,
          habilidadId,
        },
      },
    });

    return { message: 'Habilidad eliminada de la vacante' };
  }

  async addLenguaje(vacanteId: string, lenguajeId: string, nivel: number, reclutadorId: string) {
    const [vacante, lenguaje] = await Promise.all([
      this.prisma.vacante.findFirst({
        where: { 
          id: vacanteId,
          reclutadorId 
        },
      }),
      this.prisma.lenguaje.findUnique({
        where: { id: lenguajeId },
      }),
    ]);

    if (!vacante) {
      throw new ForbiddenException('Vacante no encontrada o no tienes permiso para modificarla');
    }

    if (!lenguaje) {
      throw new NotFoundException(`Lenguaje con ID ${lenguajeId} no encontrado`);
    }

    return this.prisma.lenguajeVacante.create({
      data: {
        vacanteId,
        lenguajeId,
        nivel,
      },
      include: {
        lenguaje: true,
      },
    });
  }

  async removeLenguaje(vacanteId: string, lenguajeId: string, reclutadorId: string) {
    const vacante = await this.prisma.vacante.findFirst({
      where: { 
        id: vacanteId,
        reclutadorId 
      },
    });

    if (!vacante) {
      throw new ForbiddenException('Vacante no encontrada o no tienes permiso para modificarla');
    }

    await this.prisma.lenguajeVacante.delete({
      where: {
        vacanteId_lenguajeId: {
          vacanteId,
          lenguajeId,
        },
      },
    });

    return { message: 'Lenguaje eliminado de la vacante' };
  }
}
