import { Module } from '@nestjs/common';
import { FamDuplicadosController } from './fam-duplicados.controller';
import { FamDuplicadosService } from './fam-duplicados.service';
import { AuditModule } from '../audit/audit.module';
import { FamModule } from '../fam/fam.module';

@Module({
  imports: [AuditModule, FamModule],
  controllers: [FamDuplicadosController],
  providers: [FamDuplicadosService],
  exports: [FamDuplicadosService],
})
export class FamDuplicadosModule {}
