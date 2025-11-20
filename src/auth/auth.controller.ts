import { Controller, Post, Body, Get, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterCandidatoDto } from './dto/register-candidato.dto';
import { RegisterReclutadorDto } from './dto/register-reclutador.dto';
import { RegisterEmpresaDto } from './dto/register-empresa.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { InvitarReclutadorDto } from '../email/dto/invitar-reclutador.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { GetUser } from './decorators/get-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('register/candidato')
  async registerCandidato(@Body() registerCandidatoDto: RegisterCandidatoDto) {
    return this.authService.registerCandidato(registerCandidatoDto);
  }

  @Post('invitar/reclutador')
  @ApiOperation({ summary: 'Enviar invitación por email a un reclutador' })
  @ApiResponse({ status: 200, description: 'Invitación enviada exitosamente' })
  async invitarReclutador(@Body() invitarReclutadorDto: InvitarReclutadorDto) {
    return this.authService.invitarReclutador(invitarReclutadorDto);
  }

  @Post('register/reclutador')
  @ApiOperation({ summary: 'Registrar reclutador con token de invitación' })
  @ApiResponse({ status: 201, description: 'Reclutador registrado exitosamente' })
  async registerReclutador(
    @Body() registerReclutadorDto: RegisterReclutadorDto,
    @Query('token') token: string,
  ) {
    return this.authService.registerReclutador(registerReclutadorDto, token);
  }

  @Post('register/empresa')
  @ApiOperation({ summary: 'Registrar empresa con usuario administrador' })
  @ApiResponse({ status: 201, description: 'Empresa y administrador creados exitosamente' })
  @ApiResponse({ status: 409, description: 'El correo ya está registrado' })
  async registerEmpresa(@Body() registerEmpresaDto: RegisterEmpresaDto) {
    return this.authService.registerEmpresa(registerEmpresaDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@GetUser() user: any) {
    return user;
  }

  // Ejemplo de endpoint protegido solo para candidatos
  @Get('candidato/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidato')
  async candidatoOnly(@GetUser() user: any) {
    return {
      message: 'Este endpoint es solo para candidatos',
      usuario: user,
    };
  }

  // Ejemplo de endpoint protegido solo para reclutadores
  @Get('reclutador/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('reclutador')
  async reclutadorOnly(@GetUser() user: any) {
    return {
      message: 'Este endpoint es solo para reclutadores',
      usuario: user,
    };
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  @ApiResponse({ status: 200, description: 'Correo de recuperación enviado' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.correo);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada exitosamente' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.nuevaPassword,
    );
  }
}
