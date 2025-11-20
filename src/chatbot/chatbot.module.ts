import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { VacanteModule } from '../vacante/vacante.module';
import { PostulacionModule } from '../postulacion/postulacion.module';

@Module({
  imports: [PrismaModule, VacanteModule, PostulacionModule],
  controllers: [ChatbotController],
  providers: [ChatbotService]
})
export class ChatbotModule {}
