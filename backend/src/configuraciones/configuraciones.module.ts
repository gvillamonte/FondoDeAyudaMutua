import { Module } from '@nestjs/common';
import { ConfiguracionesController } from './configuraciones.controller';
import { ConfiguracionesService } from './configuraciones.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConfiguracionesController],
  providers: [ConfiguracionesService],
  exports: [ConfiguracionesService],
})
export class ConfiguracionesModule {}
