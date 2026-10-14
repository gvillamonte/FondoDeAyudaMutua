import { Module } from '@nestjs/common';
import { LegacyService } from './legacy.service';
import { LegacyController } from './legacy.controller';

@Module({
  controllers: [LegacyController],
  providers: [LegacyService],
  exports: [LegacyService],
})
export class LegacyModule {}
