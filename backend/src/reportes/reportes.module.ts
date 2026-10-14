import { Module } from '@nestjs/common';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { LegacyModule } from '../legacy/legacy.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [LegacyModule, PrismaModule],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [ReportesService],
})
export class ReportesModule {}
