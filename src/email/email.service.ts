import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

interface InvitacionPendiente {
  email: string;
  empresaId: string;
  nombreEmpresa: string;
  expiraEn: Date;
}

interface TokenRecuperacion {
  email: string;
  expiraEn: Date;
}

@Injectable()
export class EmailService {
  private transporter;
  private invitacionesPendientes = new Map<string, InvitacionPendiente>();
  private tokensRecuperacion = new Map<string, TokenRecuperacion>();

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    setInterval(() => this.limpiarInvitacionesExpiradas(), 1000 * 60 * 60);
  }

  async enviarInvitacionReclutador(
    email: string,
    empresaId: string,
    nombreEmpresa: string,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiraEn = new Date();
    expiraEn.setHours(expiraEn.getHours() + 48);

    this.invitacionesPendientes.set(token, {
      email,
      empresaId,
      nombreEmpresa,
      expiraEn,
    });

    const registroUrl = `${process.env.FRONTEND_URL}/register/reclutador?token=${token}`;

    const mailOptions = {
      from: `"SmartHireSolutions" <${process.env.SMTP_USERNAME}>`,
      to: email,
      subject: `Invitación para unirte a ${nombreEmpresa} en SmartHireSolutions`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Invitación a SmartHireSolutions</h2>
          
          <p>Has sido invitado a unirte a <strong>${nombreEmpresa}</strong> como reclutador en nuestra plataforma.</p>
          
          <p>Para completar tu registro, haz clic en el siguiente enlace:</p>
          
          <a href="${registroUrl}" 
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Completar Registro
          </a>
          
          <p style="color: #666; font-size: 14px;">
            Este enlace expirará en 48 horas.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            Si no solicitaste esta invitación, puedes ignorar este correo.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px;">
            SmartHireSolutions - Plataforma de Reclutamiento Inteligente
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    return token;
  }

  validarToken(token: string): InvitacionPendiente | null {
    const invitacion = this.invitacionesPendientes.get(token);
    
    if (!invitacion) {
      return null;
    }

    if (new Date() > invitacion.expiraEn) {
      this.invitacionesPendientes.delete(token);
      return null;
    }

    return invitacion;
  }

  consumirToken(token: string): void {
    this.invitacionesPendientes.delete(token);
  }

  private limpiarInvitacionesExpiradas(): void {
    const ahora = new Date();
    for (const [token, invitacion] of this.invitacionesPendientes.entries()) {
      if (ahora > invitacion.expiraEn) {
        this.invitacionesPendientes.delete(token);
      }
    }
  }

  getInvitacionesPendientesPorEmpresa(empresaId: string): number {
    let count = 0;
    const ahora = new Date();
    for (const invitacion of this.invitacionesPendientes.values()) {
      if (invitacion.empresaId === empresaId && invitacion.expiraEn > ahora) {
        count++;
      }
    }
    return count;
  }

  async enviarCorreoRecuperacion(email: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const expiraEn = new Date();
    expiraEn.setHours(expiraEn.getHours() + 1); // Expira en 1 hora

    this.tokensRecuperacion.set(token, {
      email,
      expiraEn,
    });

    const recuperacionUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    const mailOptions = {
      from: `"SmartHireSolutions" <${process.env.SMTP_USERNAME}>`,
      to: email,
      subject: 'Recuperación de Contraseña - SmartHireSolutions',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Recuperación de Contraseña</h2>
          
          <p>Has solicitado restablecer tu contraseña en SmartHireSolutions.</p>
          
          <p>Para crear una nueva contraseña, haz clic en el siguiente enlace:</p>
          
          <a href="${recuperacionUrl}" 
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Restablecer Contraseña
          </a>
          
          <p style="color: #666; font-size: 14px;">
            Este enlace expirará en 1 hora por seguridad.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            Si no solicitaste este cambio, puedes ignorar este correo de forma segura.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px;">
            SmartHireSolutions - Plataforma de Reclutamiento Inteligente
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
    return token;
  }

  validarTokenRecuperacion(token: string): string | null {
    const recuperacion = this.tokensRecuperacion.get(token);
    
    if (!recuperacion) {
      return null;
    }

    if (new Date() > recuperacion.expiraEn) {
      this.tokensRecuperacion.delete(token);
      return null;
    }

    return recuperacion.email;
  }

  consumirTokenRecuperacion(token: string): void {
    this.tokensRecuperacion.delete(token);
  }
}
