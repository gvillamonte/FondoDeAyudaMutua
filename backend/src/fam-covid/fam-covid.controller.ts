import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FamCovidService } from './fam-covid.service';
import { CrearAsignacionCovidDto, ActualizarAsignacionCovidDto } from './dto/fam-covid.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const LECTURA = ['ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR'];
const ESCRITURA = ['ADMINISTRADOR', 'OPERADOR_PAGOS'];

@ApiTags('Ayuda COVID')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fam-covid')
export class FamCovidController {
  constructor(private famCovidService: FamCovidService) {}

  @Get()
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Listar asignaciones COVID' })
  async listar(
    @Query('search') search?: string,
    @Query('activo') activo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.famCovidService.listar({
      search,
      activo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('colegiado/:colegiadoId')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Verificar si un colegiado tiene asignación COVID activa' })
  async verificarColegiado(@Param('colegiadoId') colegiadoId: string) {
    return this.famCovidService.verificarColegiado(colegiadoId);
  }

  @Get(':id')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Detalle de asignación COVID (sin blobs)' })
  async obtenerPorId(@Param('id') id: string) {
    return this.famCovidService.obtenerPorId(id);
  }

  @Get(':id/comprobantes/:comprobanteId/pdf')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Servir PDF de comprobante contable' })
  async obtenerPdfComprobante(@Param('comprobanteId') comprobanteId: string) {
    return this.famCovidService.obtenerPdfComprobante(comprobanteId);
  }

  @Post()
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear asignación COVID con beneficiarios y comprobantes' })
  async crear(@Body() dto: CrearAsignacionCovidDto, @Request() req: any) {
    return this.famCovidService.crearAsignacion(dto, req.user.sub, req.ip);
  }

  @Put(':id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Actualizar asignación COVID' })
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarAsignacionCovidDto,
    @Request() req: any,
  ) {
    return this.famCovidService.actualizar(id, dto, req.user.sub, req.ip);
  }

  @Delete(':id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Desactivar asignación COVID' })
  async eliminar(@Param('id') id: string, @Request() req: any) {
    return this.famCovidService.eliminar(id, req.user.sub, req.ip);
  }

  @Post(':id/comprobantes')
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agregar comprobante contable a una asignación' })
  async agregarComprobante(
    @Param('id') id: string,
    @Body() dto: any,
    @Request() req: any,
  ) {
    return this.famCovidService.agregarComprobante(id, dto, req.user.sub, req.ip);
  }

  @Delete(':id/comprobantes/:comprobanteId')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Eliminar comprobante contable' })
  async eliminarComprobante(
    @Param('comprobanteId') comprobanteId: string,
    @Request() req: any,
  ) {
    return this.famCovidService.eliminarComprobante(comprobanteId, req.user.sub, req.ip);
  }
}
