import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID, Min, IsArray, ValidateNested, IsInt, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class HabilidadVacanteDto {
  @ApiProperty({ example: 'uuid-habilidad' })
  @IsUUID()
  habilidadId: string;

  @ApiProperty({ example: 7, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  nivel: number;

  @ApiProperty({ example: 'SI', enum: ['SI', 'NO'] })
  @IsString()
  requerido: string;
}

export class LenguajeVacanteDto {
  @ApiProperty({ example: 'uuid-lenguaje' })
  @IsUUID()
  lenguajeId: string;

  @ApiProperty({ example: 8, minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  nivel: number;
}

export class CreateVacanteDto {
  @ApiProperty({ example: 'Desarrollador Full Stack Senior' })
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @ApiProperty({ 
    example: 'Buscamos un desarrollador con amplia experiencia en React, Node.js y bases de datos relacionales.' 
  })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiProperty({ example: 50000, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  salario_minimo?: number;

  @ApiProperty({ example: 80000, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  salario_maximo?: number;

  @ApiProperty({ example: 'uuid-empresa' })
  @IsUUID()
  @IsNotEmpty()
  empresaId: string;

  @ApiProperty({ example: 'uuid-modalidad' })
  @IsUUID()
  @IsNotEmpty()
  modalidadId: string;

  @ApiProperty({ example: 'uuid-horario' })
  @IsUUID()
  @IsNotEmpty()
  horarioId: string;

  @ApiProperty({ type: [HabilidadVacanteDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HabilidadVacanteDto)
  habilidades?: HabilidadVacanteDto[];

  @ApiProperty({ type: [LenguajeVacanteDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LenguajeVacanteDto)
  lenguajes?: LenguajeVacanteDto[];
}
