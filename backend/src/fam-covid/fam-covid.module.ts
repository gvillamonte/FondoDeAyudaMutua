import { Module } from '@nestjs/common';
import { FamCovidController } from './fam-covid.controller';
import { FamCovidService } from './fam-covid.service';
import { AuditModule } from '../audit/audit.module';
import { FamModule } from '../fam/fam.module';

@Module({
  imports: [AuditModule, FamModule],
  controllers: [FamCovidController],
  providers: [FamCovidService],
  exports: [FamCovidService],
})
export class FamCovidModule {}
