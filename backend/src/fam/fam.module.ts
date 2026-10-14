import { Module } from '@nestjs/common';
import { FamService } from './fam.service';
import { FamController } from './fam.controller';

@Module({
  controllers: [FamController],
  providers: [FamService],
  exports: [FamService],
})
export class FamModule {}
