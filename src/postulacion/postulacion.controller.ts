import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PostulacionService } from './postulacion.service';
import { CreatePostulacionDto } from './dto/create-postulacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('postulaciones')
@ApiBearerAuth()
@Controller('postulaciones')
export class PostulacionController {
  constructor(private readonly postulacionService: PostulacionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiOperation({ summary: 'Postularse a una vacante (solo candidatos)' })
  @ApiResponse({ status: 201, description: 'Postulación creada exitosamente' })
  @ApiResponse({ status: 404, description: 'Vacante no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya te has postulado a esta vacante' })
  create(
    @GetUser('candidato.id') candidatoId: string,
    @Body() createPostulacionDto: CreatePostulacionDto,
  ) {
    return this.postulacionService.create(candidatoId, createPostulacionDto);
  }

  @Get('mis-postulaciones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiOperation({ summary: 'Ver mis postulaciones (solo candidatos)' })
  @ApiResponse({ status: 200, description: 'Lista de postulaciones del candidato' })
  findMine(
    @GetUser('candidato.id') candidatoId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.postulacionService.findAllByCandidato(candidatoId, pageNum, limitNum);
  }

  @Get('empresa/candidatos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiOperation({ summary: 'Filtrar candidatos de postulaciones de la empresa (solo reclutadores)' })
  @ApiResponse({ status: 200, description: 'Lista filtrada de candidatos' })
  filterCandidatosByEmpresa(
    @GetUser('reclutador.empresaId') empresaId: string,
    @Query('vacanteId') vacanteId?: string,
    @Query('habilidadId') habilidadId?: string,
    @Query('lenguajeId') lenguajeId?: string,
    @Query('nivelHabilidadMin') nivelHabilidadMin?: string,
    @Query('nivelLenguajeMin') nivelLenguajeMin?: string,
    @Query('compatibilidadMin') compatibilidadMin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.postulacionService.filterCandidatosByEmpresa(
      empresaId,
      {
        vacanteId,
        habilidadId,
        lenguajeId,
        nivelHabilidadMin: nivelHabilidadMin ? parseInt(nivelHabilidadMin) : undefined,
        nivelLenguajeMin: nivelLenguajeMin ? parseInt(nivelLenguajeMin) : undefined,
        compatibilidadMin: compatibilidadMin ? parseFloat(compatibilidadMin) : undefined,
      },
      pageNum,
      limitNum,
    );
  }

  @Get('vacante/:vacanteId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiOperation({
    summary: 'Ver postulaciones de una vacante (solo reclutadores)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de postulaciones de la vacante',
  })
  @ApiResponse({
    status: 403,
    description: 'No tienes permiso para ver estas postulaciones',
  })
  findByVacante(
    @Param('vacanteId') vacanteId: string,
    @GetUser('reclutador.id') reclutadorId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    return this.postulacionService.findAllByVacante(vacanteId, reclutadorId, pageNum, limitNum);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ver una postulación específica' })
  @ApiResponse({ status: 200, description: 'Postulación encontrada' })
  @ApiResponse({ status: 404, description: 'Postulación no encontrada' })
  @ApiResponse({
    status: 403,
    description: 'No tienes permiso para ver esta postulación',
  })
  findOne(
    @Param('id') id: string,
    @GetUser('id') usuarioId: string,
    @GetUser('candidato') candidato: any,
  ) {
    const role = candidato ? 'candidato' : 'reclutador';
    return this.postulacionService.findOne(id, usuarioId, role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiOperation({ summary: 'Cancelar una postulación (solo candidatos)' })
  @ApiResponse({ status: 200, description: 'Postulación eliminada exitosamente' })
  @ApiResponse({ status: 404, description: 'Postulación no encontrada' })
  @ApiResponse({
    status: 403,
    description: 'No tienes permiso para eliminar esta postulación',
  })
  remove(
    @Param('id') id: string,
    @GetUser('candidato.id') candidatoId: string,
  ) {
    return this.postulacionService.remove(id, candidatoId);
  }
}
