import { Injectable, ConflictException, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterCandidatoDto } from './dto/register-candidato.dto';
import { RegisterReclutadorDto } from './dto/register-reclutador.dto';
import { RegisterEmpresaDto } from './dto/register-empresa.dto';
import { LoginDto } from './dto/login.dto';
import { InvitarReclutadorDto } from '../email/dto/invitar-reclutador.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.usuario.findUnique({
      where: { correo: registerDto.correo },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const usuario = await this.prisma.usuario.create({
      data: {
        name: registerDto.name,
        lastname: registerDto.lastname,
        correo: registerDto.correo,
        password: hashedPassword,
        telefono: registerDto.telefono,
        fecha_nacimiento: registerDto.fecha_nacimiento
          ? new Date(registerDto.fecha_nacimiento)
          : null,
      },
      select: {
        id: true,
        name: true,
        lastname: true,
        correo: true,
        telefono: true,
        fecha_nacimiento: true,
        creado_en: true,
      },
    });

    const token = this.generateToken(usuario.id, usuario.correo);

    return {
      usuario,
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: loginDto.correo },
      include: {
        candidato: true,
        reclutador: {
          include: {
            empresa: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      usuario.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = this.generateToken(usuario.id, usuario.correo);

    let tipoUsuario = 'usuario';
    if (usuario.candidato) {
      tipoUsuario = 'candidato';
    } else if (usuario.reclutador) {
      tipoUsuario = 'reclutador';
    }

    const { password, ...usuarioSinPassword } = usuario;

    return {
      usuario: usuarioSinPassword,
      tipoUsuario,
      token,
    };
  }

  private generateToken(userId: string, correo: string): string {
    const payload = { sub: userId, correo };
    return this.jwtService.sign(payload);
  }

  async validateUser(userId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lastname: true,
        correo: true,
        telefono: true,
        fecha_nacimiento: true,
        candidato: true,
        reclutador: {
          include: {
            empresa: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return usuario;
  }

  async registerCandidato(registerCandidatoDto: RegisterCandidatoDto) {
    const [existingUser, hashedPassword] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { correo: registerCandidatoDto.correo },
      }),
      bcrypt.hash(registerCandidatoDto.password, 10),
    ]);

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const usuario = await this.prisma.usuario.create({
      data: {
        name: registerCandidatoDto.name,
        lastname: registerCandidatoDto.lastname,
        correo: registerCandidatoDto.correo,
        password: hashedPassword,
        telefono: registerCandidatoDto.telefono,
        fecha_nacimiento: registerCandidatoDto.fecha_nacimiento
          ? new Date(registerCandidatoDto.fecha_nacimiento)
          : null,
        candidato: {
          create: {
            titulo: registerCandidatoDto.titulo,
            bio: registerCandidatoDto.bio,
            ubicacion: registerCandidatoDto.ubicacion,
          },
        },
      },
      select: {
        id: true,
        name: true,
        lastname: true,
        correo: true,
        telefono: true,
        fecha_nacimiento: true,
        creado_en: true,
        candidato: true,
      },
    });

    const token = this.generateToken(usuario.id, usuario.correo);

    return {
      usuario,
      tipoUsuario: 'candidato',
      token,
    };
  }

  async registerReclutador(registerReclutadorDto: RegisterReclutadorDto, token: string) {
    const invitacion = this.emailService.validarToken(token);

    if (!invitacion) {
      throw new BadRequestException('Token de invitación inválido o expirado');
    }

    if (invitacion.email !== registerReclutadorDto.correo) {
      throw new BadRequestException('El correo no coincide con la invitación');
    }

    const [existingUser, hashedPassword] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { correo: registerReclutadorDto.correo },
      }),
      bcrypt.hash(registerReclutadorDto.password, 10),
    ]);

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const usuario = await this.prisma.usuario.create({
      data: {
        name: registerReclutadorDto.name,
        lastname: registerReclutadorDto.lastname,
        correo: registerReclutadorDto.correo,
        password: hashedPassword,
        telefono: registerReclutadorDto.telefono,
        fecha_nacimiento: registerReclutadorDto.fecha_nacimiento
          ? new Date(registerReclutadorDto.fecha_nacimiento)
          : null,
        reclutador: {
          create: {
            posicion: registerReclutadorDto.posicion,
            empresaId: invitacion.empresaId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        lastname: true,
        correo: true,
        telefono: true,
        fecha_nacimiento: true,
        creado_en: true,
        reclutador: {
          include: {
            empresa: true,
          },
        },
      },
    });

    this.emailService.consumirToken(token);

    const tokenJWT = this.generateToken(usuario.id, usuario.correo);

    return {
      usuario,
      tipoUsuario: 'reclutador',
      token: tokenJWT,
    };
  }

  async invitarReclutador(invitarReclutadorDto: InvitarReclutadorDto) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: invitarReclutadorDto.empresaId },
    });

    if (!empresa) {
      throw new NotFoundException('La empresa especificada no existe');
    }

    const existingUser = await this.prisma.usuario.findUnique({
      where: { correo: invitarReclutadorDto.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    await this.emailService.enviarInvitacionReclutador(
      invitarReclutadorDto.email,
      invitarReclutadorDto.empresaId,
      empresa.name,
    );

    return {
      message: 'Invitación enviada exitosamente',
      email: invitarReclutadorDto.email,
    };
  }

  async registerEmpresa(registerEmpresaDto: RegisterEmpresaDto) {
    const [existingUser, hashedPassword] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { correo: registerEmpresaDto.correo },
      }),
      bcrypt.hash(registerEmpresaDto.password, 10),
    ]);

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const result = await this.prisma.$transaction(async (prisma) => {
      const usuario = await prisma.usuario.create({
        data: {
          name: registerEmpresaDto.name,
          lastname: registerEmpresaDto.lastname,
          correo: registerEmpresaDto.correo,
          password: hashedPassword,
          telefono: registerEmpresaDto.telefono,
        },
      });

      const empresa = await prisma.empresa.create({
        data: {
          name: registerEmpresaDto.nombreEmpresa,
          descripcion: registerEmpresaDto.descripcionEmpresa,
          area: registerEmpresaDto.areaEmpresa,
          creadorId: usuario.id,
        },
      });

      const reclutador = await prisma.reclutador.create({
        data: {
          usuarioId: usuario.id,
          empresaId: empresa.id,
          posicion: registerEmpresaDto.posicion || 'Administrador',
        },
      });

      return { usuario, empresa, reclutador };
    });

    const token = this.generateToken(result.usuario.id, result.usuario.correo);

    const { password, ...usuarioSinPassword } = result.usuario;

    return {
      usuario: {
        ...usuarioSinPassword,
        reclutador: {
          ...result.reclutador,
          empresa: result.empresa,
        },
      },
      empresa: result.empresa,
      tipoUsuario: 'reclutador',
      token,
    };
  }

  async forgotPassword(correo: string): Promise<{ message: string }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo },
    });

    if (!usuario) {
      // Por seguridad, no revelamos si el correo existe
      return { 
        message: 'Si el correo existe, recibirás un enlace de recuperación.' 
      };
    }

    await this.emailService.enviarCorreoRecuperacion(correo);

    return { 
      message: 'Si el correo existe, recibirás un enlace de recuperación.' 
    };
  }

  async resetPassword(token: string, nuevaPassword: string): Promise<{ message: string }> {
    const email = this.emailService.validarTokenRecuperacion(token);

    if (!email) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { correo: email },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { password: hashedPassword },
    });

    this.emailService.consumirTokenRecuperacion(token);

    return { message: 'Contraseña actualizada exitosamente' };
  }
}
