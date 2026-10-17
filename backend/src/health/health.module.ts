import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { LegacyModule } from '../legacy/legacy.module';

@Module({
  imports: [LegacyModule],
  controllers: [HealthController],
})
export class HealthModule {}
