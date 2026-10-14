import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LegacyService } from './legacy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Colegiados (Legado)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('legacy/colegiados')
export class LegacyController {
  constructor(private legacyService: LegacyService) {}

  @Get('search')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Buscar colegiados en sistema legado (READ-ONLY)' })
  async search(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.legacyService.searchColegiados({
      search,
      page: page || 1,
      limit: limit || 25,
    });
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener colegiado por ID (READ-ONLY)' })
  async getById(@Param('id') id: string) {
    return this.legacyService.getColegiadoById(id);
  }

  @Get('numero/:numero')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener colegiado por numero de colegiatura (READ-ONLY)' })
  async getByNumero(@Param('numero') numero: string) {
    return this.legacyService.getColegiadoByNumero(numero);
  }

  @Get(':id/cuotas')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener cuotas de colegiatura (READ-ONLY)' })
  async getCuotas(@Param('id') id: string) {
    return this.legacyService.getCuotasColegiado(id);
  }
}
