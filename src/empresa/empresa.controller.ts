import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { EmpresaService } from './empresa.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';
import { UpdateEmpresaDto } from './dto/update-empresa.dto';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('empresas')
@Controller('empresas')
export class EmpresaController {
  constructor(
    private readonly empresaService: EmpresaService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva empresa' })
  @ApiResponse({ status: 201, description: 'Empresa creada exitosamente' })
  create(@Body() createEmpresaDto: CreateEmpresaDto) {
    return this.empresaService.create(createEmpresaDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las empresas' })
  @ApiResponse({ status: 200, description: 'Lista de empresas' })
  findAll() {
    return this.empresaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener empresa por ID' })
  @ApiResponse({ status: 200, description: 'Empresa encontrada' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  findOne(@Param('id') id: string) {
    return this.empresaService.findOne(id);
  }

  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener dashboard de empresa (solo reclutadores de la empresa)' })
  @ApiResponse({ status: 200, description: 'Dashboard de empresa' })
  @ApiResponse({ status: 403, description: 'No tienes acceso a esta empresa' })
  getDashboard(
    @Param('id') id: string,
    @GetUser('reclutador.empresaId') empresaId: string,
  ) {
    return this.empresaService.getDashboard(id, this.emailService, empresaId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar empresa' })
  @ApiResponse({ status: 200, description: 'Empresa actualizada' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  update(@Param('id') id: string, @Body() updateEmpresaDto: UpdateEmpresaDto) {
    return this.empresaService.update(id, updateEmpresaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar empresa' })
  @ApiResponse({ status: 200, description: 'Empresa eliminada' })
  @ApiResponse({ status: 404, description: 'Empresa no encontrada' })
  remove(@Param('id') id: string) {
    return this.empresaService.remove(id);
  }
}
