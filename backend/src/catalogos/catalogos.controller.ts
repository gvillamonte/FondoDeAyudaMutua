import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogosService } from './catalogos.service';
import {
  CrearMontoFamDto,
  ActualizarMontoFamDto,
  CrearEstadoSolicitudDto,
  ActualizarEstadoSolicitudDto,
  CrearMonedaDto,
  ActualizarMonedaDto,
  CrearTipoBeneficioConfigDto,
  ActualizarTipoBeneficioConfigDto,
  CrearMemorandoDto,
  ActualizarMemorandoDto,
  CrearCartaDto,
  ActualizarCartaDto,
} from './dto/catalogos.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const LECTURA = ['ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR'];
const ESCRITURA = ['ADMINISTRADOR'];

@ApiTags('Catálogos de Configuración')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CatalogosController {
  constructor(private catalogosService: CatalogosService) {}

  // ================= MONTOS FAM =================
  @Get('montos-fam')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Listar montos FAM' })
  async listarMontosFam(@Query('activos') activos?: string) {
    return this.catalogosService.listarMontosFam(activos === 'true');
  }

  @Post('montos-fam')
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear monto FAM' })
  async crearMontoFam(@Body() dto: CrearMontoFamDto, @Request() req: any) {
    return this.catalogosService.crearMontoFam(dto, req.user.sub, req.ip);
  }

  @Put('montos-fam/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Actualizar monto FAM' })
  async actualizarMontoFam(
    @Param('id') id: string,
    @Body() dto: ActualizarMontoFamDto,
    @Request() req: any,
  ) {
    return this.catalogosService.actualizarMontoFam(Number(id), dto, req.user.sub, req.ip);
  }

  @Delete('montos-fam/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Eliminar monto FAM' })
  async eliminarMontoFam(@Param('id') id: string, @Request() req: any) {
    return this.catalogosService.eliminarMontoFam(Number(id), req.user.sub, req.ip);
  }

  // ================= ESTADOS DE SOLICITUD =================
  @Get('estados-solicitudes')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Listar estados de solicitud' })
  async listarEstados(@Query('activos') activos?: string) {
    return this.catalogosService.listarEstadosSolicitud(activos === 'true');
  }

  @Post('estados-solicitudes')
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear estado de solicitud' })
  async crearEstado(@Body() dto: CrearEstadoSolicitudDto, @Request() req: any) {
    return this.catalogosService.crearEstadoSolicitud(dto, req.user.sub, req.ip);
  }

  @Put('estados-solicitudes/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Actualizar estado de solicitud' })
  async actualizarEstado(
    @Param('id') id: string,
    @Body() dto: ActualizarEstadoSolicitudDto,
    @Request() req: any,
  ) {
    return this.catalogosService.actualizarEstadoSolicitud(Number(id), dto, req.user.sub, req.ip);
  }

  @Delete('estados-solicitudes/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Eliminar estado de solicitud' })
  async eliminarEstado(@Param('id') id: string, @Request() req: any) {
    return this.catalogosService.eliminarEstadoSolicitud(Number(id), req.user.sub, req.ip);
  }

  // ================= MONEDAS =================
  @Get('monedas')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Listar monedas' })
  async listarMonedas(@Query('activos') activos?: string) {
    return this.catalogosService.listarMonedas(activos === 'true');
  }

  @Post('monedas')
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear moneda' })
  async crearMoneda(@Body() dto: CrearMonedaDto, @Request() req: any) {
    return this.catalogosService.crearMoneda(dto, req.user.sub, req.ip);
  }

  @Put('monedas/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Actualizar moneda' })
  async actualizarMoneda(
    @Param('id') id: string,
    @Body() dto: ActualizarMonedaDto,
    @Request() req: any,
  ) {
    return this.catalogosService.actualizarMoneda(Number(id), dto, req.user.sub, req.ip);
  }

  @Delete('monedas/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Eliminar moneda' })
  async eliminarMoneda(@Param('id') id: string, @Request() req: any) {
    return this.catalogosService.eliminarMoneda(Number(id), req.user.sub, req.ip);
  }

  // ================= TIPOS DE BENEFICIO =================
  @Get('tipos-beneficio-config')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Listar tipos de beneficio (catálogo)' })
  async listarTipos(@Query('activos') activos?: string) {
    return this.catalogosService.listarTiposBeneficioConfig(activos === 'true');
  }

  @Post('tipos-beneficio-config')
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear tipo de beneficio (catálogo)' })
  async crearTipo(@Body() dto: CrearTipoBeneficioConfigDto, @Request() req: any) {
    return this.catalogosService.crearTipoBeneficioConfig(dto, req.user.sub, req.ip);
  }

  @Put('tipos-beneficio-config/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Actualizar tipo de beneficio (catálogo)' })
  async actualizarTipo(
    @Param('id') id: string,
    @Body() dto: ActualizarTipoBeneficioConfigDto,
    @Request() req: any,
  ) {
    return this.catalogosService.actualizarTipoBeneficioConfig(Number(id), dto, req.user.sub, req.ip);
  }

  @Delete('tipos-beneficio-config/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Eliminar tipo de beneficio (catálogo)' })
  async eliminarTipo(@Param('id') id: string, @Request() req: any) {
    return this.catalogosService.eliminarTipoBeneficioConfig(Number(id), req.user.sub, req.ip);
  }

  // ================= MEMORÁNDUMS =================
  @Get('memorandos')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Listar memorándums' })
  async listarMemorandos(@Query('activos') activos?: string) {
    return this.catalogosService.listarMemorandos(activos === 'true');
  }

  @Post('memorandos')
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear memorándum' })
  async crearMemorando(@Body() dto: CrearMemorandoDto, @Request() req: any) {
    return this.catalogosService.crearMemorando(dto, req.user.sub, req.ip);
  }

  @Put('memorandos/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Actualizar memorándum' })
  async actualizarMemorando(
    @Param('id') id: string,
    @Body() dto: ActualizarMemorandoDto,
    @Request() req: any,
  ) {
    return this.catalogosService.actualizarMemorando(id, dto, req.user.sub, req.ip);
  }

  @Delete('memorandos/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Eliminar memorándum' })
  async eliminarMemorando(@Param('id') id: string, @Request() req: any) {
    return this.catalogosService.eliminarMemorando(id, req.user.sub, req.ip);
  }

  // ================= CARTAS =================
  @Get('cartas')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Listar cartas' })
  async listarCartas(@Query('activos') activos?: string) {
    return this.catalogosService.listarCartas(activos === 'true');
  }

  @Post('cartas')
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear carta' })
  async crearCarta(@Body() dto: CrearCartaDto, @Request() req: any) {
    return this.catalogosService.crearCarta(dto, req.user.sub, req.ip);
  }

  @Put('cartas/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Actualizar carta' })
  async actualizarCarta(
    @Param('id') id: string,
    @Body() dto: ActualizarCartaDto,
    @Request() req: any,
  ) {
    return this.catalogosService.actualizarCarta(id, dto, req.user.sub, req.ip);
  }

  @Delete('cartas/:id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Eliminar carta' })
  async eliminarCarta(@Param('id') id: string, @Request() req: any) {
    return this.catalogosService.eliminarCarta(id, req.user.sub, req.ip);
  }
}
