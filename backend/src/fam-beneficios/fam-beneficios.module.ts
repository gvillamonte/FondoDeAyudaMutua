import { Module } from '@nestjs/common';
import { FamBeneficiosController } from './fam-beneficios.controller';
import { FamRegistrosController } from './fam-registros.controller';
import { FamSucesionController } from './fam-sucesion.controller';
import { FamBeneficiosService } from './fam-beneficios.service';
import { FamSucesionService } from './fam-sucesion.service';
import { AuditModule } from '../audit/audit.module';
import { FamModule } from '../fam/fam.module';

@Module({
  imports: [AuditModule, FamModule],
  controllers: [FamBeneficiosController, FamRegistrosController, FamSucesionController],
  providers: [FamBeneficiosService, FamSucesionService],
  exports: [FamBeneficiosService, FamSucesionService],
})
export class FamBeneficiosModule {}
