import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ColegiadosService } from './colegiados.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Colegiados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('colegiados')
export class ColegiadosController {
  constructor(private colegiadosService: ColegiadosService) {}

  @Get('search')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Buscar colegiados' })
  async search(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.colegiadosService.search({ search, page, limit });
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener colegiado con historial' })
  async getById(@Param('id') id: string) {
    return this.colegiadosService.getById(id);
  }

  @Get(':id/resumen')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Resumen de beneficios del colegiado' })
  async getResumen(@Param('id') id: string) {
    return this.colegiadosService.getResumen(id);
  }
}
