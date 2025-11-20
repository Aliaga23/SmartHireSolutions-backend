import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatbotService } from './chatbot.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Enviar mensaje al chatbot - Guía de la plataforma' })
  @ApiBearerAuth()
  async chat(@Body() chatMessageDto: ChatMessageDto, @Request() req: any) {
    // Si el usuario está autenticado, pasar su información
    const user = req.user || null;
    return this.chatbotService.chat(chatMessageDto, user);
  }

  @Get('session/:sessionId/history')
  @ApiOperation({ summary: 'Obtener historial de conversación de una sesión' })
  async getHistory(@Param('sessionId') sessionId: string) {
    return this.chatbotService.getSessionHistory(sessionId);
  }

  @Delete('session/:sessionId')
  @ApiOperation({ summary: 'Limpiar sesión de chat (borrar historial)' })
  async clearSession(@Param('sessionId') sessionId: string) {
    return this.chatbotService.clearSession(sessionId);
  }
}
