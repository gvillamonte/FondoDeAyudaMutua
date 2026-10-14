import { Module } from '@nestjs/common';
import { ColegiadosController } from './colegiados.controller';
import { ColegiadosService } from './colegiados.service';
import { LegacyModule } from '../legacy/legacy.module';

@Module({
  imports: [LegacyModule],
  controllers: [ColegiadosController],
  providers: [ColegiadosService],
})
export class ColegiadosModule {}
