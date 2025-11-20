import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmpresaService {
  constructor(private prisma: PrismaService) {}

  async create(createEmpresaDto: CreateEmpresaDto) {
    return this.prisma.empresa.create({
      data: createEmpresaDto,
    });
  }

  async findAll() {
    return this.prisma.empresa.findMany({
      include: {
        _count: {
          select: {
            reclutadores: true,
            vacantes: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id },
      include: {
        reclutadores: {
          include: {
            usuario: {
              select: {
                id: true,
                name: true,
                lastname: true,
                correo: true,
              },
            },
          },
        },
        vacantes: {
          select: {
            id: true,
            titulo: true,
            estado: true,
            creado_en: true,
          },
          orderBy: {
            creado_en: 'desc',
          },
        },
      },
    });

    if (!empresa) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
    }

    return empresa;
  }

  async update(id: string, updateEmpresaDto: UpdateEmpresaDto) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.empresa.update({
      where: { id },
      data: updateEmpresaDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Verificar que existe

    return this.prisma.empresa.delete({
      where: { id },
    });
  }

  async getDashboard(empresaId: string, emailService: any, reclutadorEmpresaId: string) {
    if (empresaId !== reclutadorEmpresaId) {
      throw new ForbiddenException('No tienes acceso a esta empresa');
    }

    const [empresa, reclutadores, vacantes] = await Promise.all([
      this.prisma.empresa.findUnique({
        where: { id: empresaId },
        select: {
          id: true,
          name: true,
          area: true,
        },
      }),
      this.prisma.reclutador.findMany({
        where: { empresaId },
        select: {
          id: true,
          usuario: {
            select: {
              name: true,
              lastname: true,
              correo: true,
              creado_en: true,
            },
          },
        },
      }),
      this.prisma.vacante.findMany({
        where: { empresaId },
        select: {
          id: true,
          titulo: true,
          estado: true,
          _count: {
            select: {
              postulaciones: true,
            },
          },
        },
      }),
    ]);

    if (!empresa) {
      throw new NotFoundException(`Empresa con ID ${empresaId} no encontrada`);
    }

    const invitacionesPendientes = emailService.getInvitacionesPendientesPorEmpresa(empresaId);

    return {
      empresa,
      estadisticas: {
        totalReclutadores: reclutadores.length,
        totalVacantes: vacantes.length,
        vacantesAbiertas: vacantes.filter(v => v.estado === 'ABIERTA').length,
        vacantesCerradas: vacantes.filter(v => v.estado === 'CERRADA').length,
        totalPostulaciones: vacantes.reduce((sum, v) => sum + v._count.postulaciones, 0),
        invitacionesPendientes,
      },
      reclutadores,
      vacantes,
    };
  }
}
