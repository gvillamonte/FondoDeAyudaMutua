import { Module } from '@nestjs/common';
import { FamBeneficiosController } from './fam-beneficios.controller';
import { FamRegistrosController } from './fam-registros.controller';
import { FamBeneficiosService } from './fam-beneficios.service';
import { AuditModule } from '../audit/audit.module';
import { FamModule } from '../fam/fam.module';

@Module({
  imports: [AuditModule, FamModule],
  controllers: [FamBeneficiosController, FamRegistrosController],
  providers: [FamBeneficiosService],
  exports: [FamBeneficiosService],
})
export class FamBeneficiosModule {}
