import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TesoreriaService } from './tesoreria.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Tesorería')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tesoreria')
export class TesoreriaController {
  constructor(private tesoreriaService: TesoreriaService) {}

  @Get('fraccionamiento/search')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Buscar colegiados para fraccionamiento' })
  async searchColegiados(@Query('search') search?: string) {
    return this.tesoreriaService.searchColegiadosForFraccionamiento(search || '');
  }

  @Get('fraccionamiento/:id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener datos de fraccionamiento de deuda por colegiado' })
  async getDatosFraccionamiento(@Param('id') id: string) {
    return this.tesoreriaService.getDatosFraccionamiento(id);
  }

  @Get('debug/columnas/:tableName')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: '[TEMP] Inspeccionar columnas de una tabla legacy' })
  async debugColumnas(@Param('tableName') tableName: string) {
    return this.tesoreriaService.debugTableColumns(tableName);
  }

  @Get('debug/search-columns/:keyword')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: '[TEMP] Buscar columnas por nombre en todas las tablas' })
  async debugSearchColumns(@Param('keyword') keyword: string) {
    return this.tesoreriaService.debugSearchColumns(keyword);
  }
}
