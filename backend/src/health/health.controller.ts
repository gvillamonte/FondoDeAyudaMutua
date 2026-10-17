import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyService } from '../legacy/legacy.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legacy: LegacyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Estado del backend y de las bases de datos' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      databases: {
        appDb: this.prisma.databaseAvailable ? 'connected' : 'unavailable',
        legacyDb: this.legacy.databaseAvailable ? 'connected' : 'unavailable',
      },
    };
  }
}
