import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ParseCvDto {
  @ApiProperty({ 
    description: 'Imagen del CV en base64 o URL de imagen',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...' 
  })
  @IsString()
  @IsNotEmpty()
  imageData: string;
}
