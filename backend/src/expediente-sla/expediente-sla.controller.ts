import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ExpedienteSlaService } from './expediente-sla.service';

@ApiTags('Expedientes - SLA y Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expediente-sla')
export class ExpedienteSlaController {
  constructor(private slaService: ExpedienteSlaService) {}

  @Get('config')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Listar configuraciones SLA' })
  async listarConfig(@Query('activos') activos?: string) {
    return this.slaService.listar(activos === 'true' ? true : activos === 'false' ? false : undefined);
  }

  @Post('config')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Crear configuración SLA' })
  async crearConfig(@Body() body: { estado: string; nombreVisible: string; horasLimite: number; colorBadge?: string; ordenFlujo?: number }) {
    return this.slaService.crear(body);
  }

  @Put('config/:id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar configuración SLA' })
  async actualizarConfig(@Param('id') id: string, @Body() body: { nombreVisible?: string; horasLimite?: number; colorBadge?: string; ordenFlujo?: number; activo?: boolean }) {
    return this.slaService.actualizar(Number(id), body);
  }

  @Delete('config/:id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar configuración SLA' })
  async eliminarConfig(@Param('id') id: string) {
    return this.slaService.eliminar(Number(id));
  }

  @Get('dashboard')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Resumen del dashboard de expedientes' })
  async getDashboard(@Req() req: any) {
    return this.slaService.getResumenDashboard(req.user.sub, req.user.rol);
  }

  @Get('trazabilidad/:expedienteId')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Trazabilidad/historial de un expediente' })
  async getTrazabilidad(@Param('expedienteId') expedienteId: string) {
    return this.slaService.getTrazabilidad(expedienteId);
  }
}
