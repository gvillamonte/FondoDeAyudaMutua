import { Module } from '@nestjs/common';
import { ExpedienteSlaService } from './expediente-sla.service';
import { ExpedienteSlaController } from './expediente-sla.controller';
import { FamModule } from '../fam/fam.module';

@Module({
  imports: [FamModule],
  controllers: [ExpedienteSlaController],
  providers: [ExpedienteSlaService],
  exports: [ExpedienteSlaService],
})
export class ExpedienteSlaModule {}
