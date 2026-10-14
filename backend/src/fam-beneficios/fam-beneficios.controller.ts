import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FamBeneficiosService } from './fam-beneficios.service';
import { CrearFamSolicitudDto, ActualizarFamSolicitudDto } from './dto/fam-solicitud.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('FAM - Solicitudes de Beneficio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fam-beneficios')
export class FamBeneficiosController {
  constructor(private famBeneficiosService: FamBeneficiosService) {}

  @Post()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Crear solicitud de beneficio FAM' })
  async crear(@Body() dto: CrearFamSolicitudDto, @Req() req: any) {
    return this.famBeneficiosService.crear(dto, req.user.sub);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Listar expedientes de beneficio FAM (con filtros)' })
  async listar(
    @Query('colegiadoId') colegiadoId?: string,
    @Query('estado') estado?: string,
    @Query('tipoBeneficioId') tipoBeneficioId?: string,
    @Query('search') search?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('documentacionCompleta') documentacionCompleta?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.famBeneficiosService.listar({
      colegiadoId,
      estado,
      tipoBeneficioId,
      search,
      fechaDesde,
      fechaHasta,
      documentacionCompleta,
      page,
      limit,
    });
  }

  @Get('montos')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener montos predeterminados FAM' })
  async obtenerMontos() {
    return this.famBeneficiosService.obtenerMontos();
  }

  @Get('tipos')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Listar tipos de beneficio FAM activos' })
  async listarTipos() {
    return this.famBeneficiosService.listarTiposBeneficio();
  }

  @Get(':id/documento/:campo')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener documento PDF (base64) de un expediente' })
  async obtenerDocumento(@Param('id') id: string, @Param('campo') campo: string) {
    return this.famBeneficiosService.obtenerDocumento(id, campo as any);
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener solicitud de beneficio FAM por ID' })
  async obtenerPorId(@Param('id') id: string) {
    return this.famBeneficiosService.obtenerPorId(id);
  }

  @Put(':id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar solicitud de beneficio FAM (solo ADMINISTRADOR)' })
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarFamSolicitudDto, @Req() req: any) {
    return this.famBeneficiosService.actualizar(id, dto, req.user?.role);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar solicitud de beneficio FAM (solo ADMINISTRADOR)' })
  async eliminar(@Param('id') id: string, @Req() req: any) {
    return this.famBeneficiosService.eliminar(id, req.user.sub, req.ip);
  }
}
