import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Aumentar límite de payload para imágenes base64
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
  
  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');
  
  // Habilitar validaciones globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Habilitar CORS
  app.enableCors();

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('SmartHire Solutions API')
    .setDescription('API para sistema de reclutamiento inteligente')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticación y registro de usuarios')
    .addTag('empresas', 'Gestión de empresas')
    .addTag('catalogos', 'Catálogos auxiliares (Modalidades, Horarios, Habilidades, Lenguajes)')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
