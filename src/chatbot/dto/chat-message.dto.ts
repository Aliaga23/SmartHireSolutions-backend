import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ContextoDto {
  @ApiProperty({ description: 'Página actual del usuario', example: '/candidatos/perfil', required: false })
  @IsOptional()
  @IsString()
  pagina?: string;

  @ApiProperty({ description: 'Sección específica', example: 'experiencia-laboral', required: false })
  @IsOptional()
  @IsString()
  seccion?: string;

  @ApiProperty({ description: 'Acción que está realizando', example: 'editando', required: false })
  @IsOptional()
  @IsString()
  accion?: string;
}

export class ChatMessageDto {
  @ApiProperty({ 
    description: 'Mensaje del usuario', 
    example: '¿Cómo puedo postularme a una vacante?' 
  })
  @IsNotEmpty()
  @IsString()
  mensaje: string;

  @ApiProperty({ 
    description: 'ID de sesión para mantener contexto (opcional)', 
    example: 'uuid-1234-5678',
    required: false 
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({
    description: 'Contexto de navegación del usuario',
    type: ContextoDto,
    required: false
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ContextoDto)
  contexto?: ContextoDto;
}
