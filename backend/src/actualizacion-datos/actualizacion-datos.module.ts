import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActualizacionDatosController } from './actualizacion-datos.controller';
import { ActualizacionDatosService } from './actualizacion-datos.service';
import { ActualizacionDatosEmailService } from './actualizacion-datos-email.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyModule } from '../legacy/legacy.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ConfigModule, PrismaModule, LegacyModule, AuditModule],
  controllers: [ActualizacionDatosController],
  providers: [ActualizacionDatosService, ActualizacionDatosEmailService],
  exports: [ActualizacionDatosService, ActualizacionDatosEmailService],
})
export class ActualizacionDatosModule {}
