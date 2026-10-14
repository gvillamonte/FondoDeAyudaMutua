import { Module } from '@nestjs/common';
import { BeneficiosController } from './beneficios.controller';
import { BeneficiosService } from './beneficios.service';

@Module({
  controllers: [BeneficiosController],
  providers: [BeneficiosService],
  exports: [BeneficiosService],
})
export class BeneficiosModule {}
