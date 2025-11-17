import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Cargar variables de entorno (DATABASE_URL, etc.)
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Prisma disponible en toda la aplicación
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
