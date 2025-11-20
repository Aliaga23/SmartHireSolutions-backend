import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { VacanteService } from './vacante.service';
import { CreateVacanteDto } from './dto/create-vacante.dto';
import { UpdateVacanteDto } from './dto/update-vacante.dto';
import { AddHabilidadVacanteDto } from './dto/add-habilidad-vacante.dto';
import { AddLenguajeVacanteDto } from './dto/add-lenguaje-vacante.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('vacantes')
@Controller('vacantes')
export class VacanteController {
  constructor(private readonly vacanteService: VacanteService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear una nueva vacante (solo reclutadores)' })
  create(@Body() createVacanteDto: CreateVacanteDto, @GetUser() user: any) {
    return this.vacanteService.create(createVacanteDto, user.reclutador.id);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las vacantes con filtros avanzados y paginación' })
  @ApiQuery({ name: 'estado', required: false, enum: ['ABIERTA', 'CERRADA', 'PAUSADA'] })
  @ApiQuery({ name: 'empresaId', required: false })
  @ApiQuery({ name: 'modalidadId', required: false })
  @ApiQuery({ name: 'horarioId', required: false })
  @ApiQuery({ name: 'habilidadId', required: false })
  @ApiQuery({ name: 'lenguajeId', required: false })
  @ApiQuery({ name: 'nivelHabilidadMin', required: false })
  @ApiQuery({ name: 'nivelLenguajeMin', required: false })
  @ApiQuery({ name: 'salarioMin', required: false })
  @ApiQuery({ name: 'salarioMax', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('estado') estado?: string,
    @Query('empresaId') empresaId?: string,
    @Query('modalidadId') modalidadId?: string,
    @Query('horarioId') horarioId?: string,
    @Query('habilidadId') habilidadId?: string,
    @Query('lenguajeId') lenguajeId?: string,
    @Query('nivelHabilidadMin') nivelHabilidadMin?: string,
    @Query('nivelLenguajeMin') nivelLenguajeMin?: string,
    @Query('salarioMin') salarioMin?: string,
    @Query('salarioMax') salarioMax?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.vacanteService.findAll(
      {
        estado,
        empresaId,
        modalidadId,
        horarioId,
        habilidadId,
        lenguajeId,
        nivelHabilidadMin: nivelHabilidadMin ? parseInt(nivelHabilidadMin) : undefined,
        nivelLenguajeMin: nivelLenguajeMin ? parseInt(nivelLenguajeMin) : undefined,
        salarioMin: salarioMin ? parseFloat(salarioMin) : undefined,
        salarioMax: salarioMax ? parseFloat(salarioMax) : undefined,
      },
      pageNum,
      limitNum,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una vacante por ID con todos sus detalles' })
  findOne(@Param('id') id: string) {
    return this.vacanteService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar una vacante (solo el reclutador que la creó)' })
  update(
    @Param('id') id: string,
    @Body() updateVacanteDto: UpdateVacanteDto,
    @GetUser() user: any,
  ) {
    return this.vacanteService.update(id, updateVacanteDto, user.reclutador.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar una vacante (solo el reclutador que la creó)' })
  remove(@Param('id') id: string, @GetUser() user: any) {
    return this.vacanteService.remove(id, user.reclutador.id);
  }

  @Patch(':id/estado')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar el estado de una vacante (ABIERTA/CERRADA/PAUSADA)' })
  updateEstado(
    @Param('id') id: string,
    @Body('estado') estado: string,
    @GetUser() user: any,
  ) {
    return this.vacanteService.updateEstado(id, estado, user.reclutador.id);
  }

  @Post(':id/habilidades')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agregar una habilidad requerida a la vacante' })
  addHabilidad(
    @Param('id') id: string,
    @Body() dto: AddHabilidadVacanteDto,
    @GetUser() user: any,
  ) {
    return this.vacanteService.addHabilidad(id, dto.habilidadId, dto.nivel, dto.requerido, user.reclutador.id);
  }

  @Delete(':id/habilidades/:habilidadId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar una habilidad de la vacante' })
  removeHabilidad(
    @Param('id') id: string,
    @Param('habilidadId') habilidadId: string,
    @GetUser() user: any,
  ) {
    return this.vacanteService.removeHabilidad(id, habilidadId, user.reclutador.id);
  }

  @Post(':id/lenguajes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agregar un lenguaje requerido a la vacante' })
  addLenguaje(
    @Param('id') id: string,
    @Body() dto: AddLenguajeVacanteDto,
    @GetUser() user: any,
  ) {
    return this.vacanteService.addLenguaje(id, dto.lenguajeId, dto.nivel, user.reclutador.id);
  }

  @Delete(':id/lenguajes/:lenguajeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar un lenguaje de la vacante' })
  removeLenguaje(
    @Param('id') id: string,
    @Param('lenguajeId') lenguajeId: string,
    @GetUser() user: any,
  ) {
    return this.vacanteService.removeLenguaje(id, lenguajeId, user.reclutador.id);
  }
}
