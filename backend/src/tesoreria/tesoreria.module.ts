import { Module } from '@nestjs/common';
import { TesoreriaController } from './tesoreria.controller';
import { TesoreriaService } from './tesoreria.service';
import { LegacyModule } from '../legacy/legacy.module';

@Module({
  imports: [LegacyModule],
  controllers: [TesoreriaController],
  providers: [TesoreriaService],
})
export class TesoreriaModule {}
