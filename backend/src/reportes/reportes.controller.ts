import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportesService } from './reportes.service';
import {
  EstadosHabilidadQueryDto,
  EstadosHabilidadLoteDto,
  SubirLogoDto,
} from './dto/reportes.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private reportesService: ReportesService) {}

  @Get('estados-habilidad')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Reporte de estados de habilidad por colegiado' })
  async getEstadosHabilidad(@Query() query: EstadosHabilidadQueryDto) {
    return this.reportesService.getEstadosHabilidad(query.cip, query.desde);
  }

  @Get('estados-habilidad/excel')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Exportar estados de habilidad a Excel' })
  async getEstadosHabilidadExcel(@Query() query: EstadosHabilidadQueryDto) {
    return this.reportesService.generarExcel(query.cip, query.desde);
  }

  @Post('estados-habilidad/excel-lote')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Exportar a Excel en bloque (ZIP con un archivo por colegiado, max. 20)' })
  async getEstadosHabilidadExcelLote(@Body() dto: EstadosHabilidadLoteDto) {
    return this.reportesService.generarExcelLote(dto.cips, dto.desde);
  }

  @Get('logo')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener el logo institucional del CIP' })
  async getLogo() {
    return this.reportesService.getLogo();
  }

  @Post('logo')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Subir/reemplazar el logo institucional del CIP (solo admin)' })
  async subirLogo(@Body() dto: SubirLogoDto, @Req() req: any) {
    return this.reportesService.subirLogo(dto, req.user?.username || 'Sistema');
  }
}
