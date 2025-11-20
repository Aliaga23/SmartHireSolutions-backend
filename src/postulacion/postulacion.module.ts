import { Module } from '@nestjs/common';
import { PostulacionService } from './postulacion.service';
import { PostulacionController } from './postulacion.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PostulacionController],
  providers: [PostulacionService],
  exports: [PostulacionService],
})
export class PostulacionModule {}
