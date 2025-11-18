import { IsEmail, IsString } from 'class-validator';

export class InvitarReclutadorDto {
  @IsEmail()
  email: string;

  @IsString()
  empresaId: string;
}
