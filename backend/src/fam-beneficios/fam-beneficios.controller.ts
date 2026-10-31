import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FamBeneficiosService } from './fam-beneficios.service';
import { CrearFamSolicitudDto, ActualizarFamSolicitudDto, ActualizarBeneficiariosDto, PagarExpedienteDto, ActualizarDepositoDto, SubirDocumentoDto, SubirDeclaracionJuradaDto } from './dto/fam-solicitud.dto';
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
    @Query('ordenarPor') ordenarPor?: string,
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
      ordenarPor,
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

  @Get('activo')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener el expediente activo de un colegiado para un tipo de beneficio' })
  async obtenerActivo(
    @Query('colegiadoId') colegiadoId: string,
    @Query('tipoBeneficioId') tipoBeneficioId?: string,
    @Query('tipoBeneficioConfigId') tipoBeneficioConfigId?: string,
  ) {
    return this.famBeneficiosService.obtenerExpedienteActivoResumen(
      colegiadoId,
      tipoBeneficioId,
      tipoBeneficioConfigId,
    );
  }

  @Get(':id/documento/:campo')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener documento PDF (base64) de un expediente' })
  async obtenerDocumento(@Param('id') id: string, @Param('campo') campo: string) {
    return this.famBeneficiosService.obtenerDocumento(id, campo as any);
  }

  @Get(':id/historial')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener el historial guiado de un expediente FAM' })
  async obtenerHistorial(@Param('id') id: string, @Req() req: any) {
    return this.famBeneficiosService.obtenerHistorial(id, req.user?.rol);
  }

  @Put(':id/historial/documento/:campo')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Subir o reemplazar un documento del expediente desde el historial' })
  async subirDocumentoHistorial(
    @Param('id') id: string,
    @Param('campo') campo: string,
    @Body() dto: SubirDocumentoDto,
    @Req() req: any,
  ) {
    return this.famBeneficiosService.subirDocumentoHistorial(
      id,
      campo,
      dto.contenido,
      req.user.sub,
      req.user?.rol,
      req.ip,
    );
  }

  @Put(':id/historial/beneficiario/:beneficiarioId/documento/:tipo')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Subir un documento de un beneficiario desde el historial' })
  async subirDocumentoBeneficiarioHistorial(
    @Param('id') id: string,
    @Param('beneficiarioId') beneficiarioId: string,
    @Param('tipo') tipo: string,
    @Body() dto: SubirDeclaracionJuradaDto,
    @Req() req: any,
  ) {
    return this.famBeneficiosService.subirDocumentoBeneficiarioHistorial(
      id,
      beneficiarioId,
      tipo,
      dto,
      req.user.sub,
      req.user?.rol,
      req.ip,
    );
  }

  @Put(':id/historial/deposito/:depositoId/comprobante')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Subir el comprobante de un depósito desde el historial' })
  async subirComprobanteDepositoHistorial(
    @Param('id') id: string,
    @Param('depositoId') depositoId: string,
    @Body() dto: SubirDocumentoDto,
    @Req() req: any,
  ) {
    return this.famBeneficiosService.subirComprobanteDepositoHistorial(
      id,
      depositoId,
      dto.contenido,
      req.user.sub,
      req.user?.rol,
      req.ip,
    );
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener solicitud de beneficio FAM por ID' })
  async obtenerPorId(@Param('id') id: string) {
    return this.famBeneficiosService.obtenerPorId(id);
  }

  @Put(':id/beneficiarios')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Agregar o corregir beneficiarios y declaraciones juradas de un expediente' })
  async actualizarBeneficiarios(
    @Param('id') id: string,
    @Body() dto: ActualizarBeneficiariosDto,
    @Req() req: any,
  ) {
    return this.famBeneficiosService.actualizarBeneficiarios(id, dto, req.user.sub, req.user?.rol, req.ip);
  }

  @Post(':id/pagar')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Registrar el pago del expediente y generar un deposito por beneficiario' })
  async pagar(@Param('id') id: string, @Body() dto: PagarExpedienteDto, @Req() req: any) {
    return this.famBeneficiosService.pagar(id, dto, req.user.sub, req.ip);
  }

  @Put(':id/depositos/:depositoId')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Corregir un deposito o comprobante (solo ADMINISTRADOR)' })
  async actualizarDeposito(
    @Param('id') id: string,
    @Param('depositoId') depositoId: string,
    @Body() dto: ActualizarDepositoDto,
    @Req() req: any,
  ) {
    return this.famBeneficiosService.actualizarDeposito(
      id,
      depositoId,
      dto,
      req.user.sub,
      req.user?.rol,
      req.ip,
    );
  }

  @Get(':id/beneficiario/:beneficiarioId/declaracion')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener la declaracion jurada de un beneficiario' })
  async obtenerDeclaracion(
    @Param('id') id: string,
    @Param('beneficiarioId') beneficiarioId: string,
  ) {
    return this.famBeneficiosService.obtenerDeclaracionBeneficiario(id, beneficiarioId);
  }

  @Get(':id/beneficiario/:beneficiarioId/orden-pago')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener la orden de pago de un beneficiario' })
  async obtenerOrdenPago(
    @Param('id') id: string,
    @Param('beneficiarioId') beneficiarioId: string,
  ) {
    return this.famBeneficiosService.obtenerOrdenPagoBeneficiario(id, beneficiarioId);
  }

  @Get(':id/deposito/:depositoId/comprobante')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener el comprobante de un deposito' })
  async obtenerComprobante(
    @Param('id') id: string,
    @Param('depositoId') depositoId: string,
  ) {
    return this.famBeneficiosService.obtenerComprobanteDeposito(id, depositoId);
  }

  @Put(':id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar solicitud de beneficio FAM (solo ADMINISTRADOR)' })
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarFamSolicitudDto, @Req() req: any) {
    return this.famBeneficiosService.actualizar(id, dto, req.user?.rol);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar solicitud de beneficio FAM (solo ADMINISTRADOR)' })
  async eliminar(@Param('id') id: string, @Req() req: any) {
    return this.famBeneficiosService.eliminar(id, req.user.sub, req.ip);
  }
}
