import { Module } from '@nestjs/common';
import { ExpedienteSlaService } from './expediente-sla.service';
import { ExpedienteSlaController } from './expediente-sla.controller';

@Module({
  controllers: [ExpedienteSlaController],
  providers: [ExpedienteSlaService],
  exports: [ExpedienteSlaService],
})
export class ExpedienteSlaModule {}
