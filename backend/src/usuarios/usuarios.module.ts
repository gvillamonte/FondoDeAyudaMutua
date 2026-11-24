import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [UsuariosController, RolesController],
  providers: [UsuariosService, RolesService],
  exports: [UsuariosService, RolesService],
})
export class UsuariosModule {}
