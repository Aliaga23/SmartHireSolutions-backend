import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CandidatoService } from './candidato.service';
import { UpdateCandidatoDto } from './dto/update-candidato.dto';
import { ParseCvDto } from './dto/parse-cv.dto';
import { AddHabilidadCandidatoDto, AddLenguajeCandidatoDto } from './dto/create-candidato.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('candidatos')
@Controller('candidatos')
export class CandidatoController {
  constructor(private readonly candidatoService: CandidatoService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil completo del candidato autenticado' })
  getMyProfile(@GetUser() user: any) {
    return this.candidatoService.getProfile(user.candidato.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil del candidato' })
  updateProfile(@GetUser() user: any, @Body() updateDto: UpdateCandidatoDto) {
    return this.candidatoService.updateProfile(user.candidato.id, updateDto);
  }

  @Post('profile/parse-cv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Procesar imagen de CV con GPT-4 Vision y actualizar perfil automáticamente' })
  parseCv(@GetUser() user: any, @Body() parseCvDto: ParseCvDto) {
    return this.candidatoService.parseCvWithGPT(user.candidato.id, parseCvDto);
  }

  @Post('profile/habilidades')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agregar habilidad al perfil' })
  addHabilidad(@GetUser() user: any, @Body() dto: AddHabilidadCandidatoDto) {
    return this.candidatoService.addHabilidad(user.candidato.id, dto.habilidadId, dto.nivel);
  }

  @Put('profile/habilidades/:habilidadId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar nivel de habilidad' })
  updateHabilidad(
    @GetUser() user: any,
    @Param('habilidadId') habilidadId: string,
    @Body('nivel') nivel: number,
  ) {
    return this.candidatoService.updateHabilidad(user.candidato.id, habilidadId, nivel);
  }

  @Delete('profile/habilidades/:habilidadId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar habilidad del perfil' })
  removeHabilidad(@GetUser() user: any, @Param('habilidadId') habilidadId: string) {
    return this.candidatoService.removeHabilidad(user.candidato.id, habilidadId);
  }

  @Post('profile/lenguajes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agregar lenguaje al perfil' })
  addLenguaje(@GetUser() user: any, @Body() dto: AddLenguajeCandidatoDto) {
    return this.candidatoService.addLenguaje(user.candidato.id, dto.lenguajeId, dto.nivel);
  }

  @Put('profile/lenguajes/:lenguajeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar nivel de lenguaje' })
  updateLenguaje(
    @GetUser() user: any,
    @Param('lenguajeId') lenguajeId: string,
    @Body('nivel') nivel: number,
  ) {
    return this.candidatoService.updateLenguaje(user.candidato.id, lenguajeId, nivel);
  }

  @Delete('profile/lenguajes/:lenguajeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar lenguaje del perfil' })
  removeLenguaje(@GetUser() user: any, @Param('lenguajeId') lenguajeId: string) {
    return this.candidatoService.removeLenguaje(user.candidato.id, lenguajeId);
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar candidatos (público)' })
  @ApiQuery({ name: 'habilidadId', required: false })
  @ApiQuery({ name: 'ubicacion', required: false })
  searchCandidatos(
    @Query('habilidadId') habilidadId?: string,
    @Query('ubicacion') ubicacion?: string,
  ) {
    return this.candidatoService.searchCandidatos({ habilidadId, ubicacion });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver perfil público de un candidato' })
  getProfile(@Param('id') id: string) {
    return this.candidatoService.getProfile(id);
  }
}
