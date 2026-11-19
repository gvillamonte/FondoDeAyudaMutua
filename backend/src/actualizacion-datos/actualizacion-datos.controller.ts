import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActualizacionDatosService } from './actualizacion-datos.service';
import {
  VerificarCipDto,
  ConsultarColegiadoDto,
  ActualizarDatosColegiadoDto,
  FiltroActualizacionesDto,
} from './dto/actualizacion-datos.dto';
import {
  ActualizarEmailConfigDto,
  ProbarEnvioEmailDto,
  PrevisualizarEmailDto,
} from './dto/actualizacion-datos-email-config.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Actualización de Datos de Colegiados')
@Controller('actualizacion-datos')
export class ActualizacionDatosController {
  constructor(private readonly service: ActualizacionDatosService) {}

  // ==========================================
  // RUTAS PÚBLICAS (PORTAL DE COLEGIADOS)
  // ==========================================

  @Get('catalogos')
  @ApiOperation({ summary: 'Obtener catálogos de ubigeos y estados civiles (Público)' })
  async obtenerCatalogos() {
    return this.service.obtenerCatalogos();
  }

  @Post('verificar-cip')
  @ApiOperation({ summary: 'Verificar si el CIP existe en el padrón (Paso 1)' })
  async verificarCip(@Body() dto: VerificarCipDto) {
    return this.service.verificarCip(dto.cip);
  }

  @Post('consultar')
  @ApiOperation({ summary: 'Consultar datos de colegiado por CIP y DNI (Paso 2)' })
  async consultar(@Body() dto: ConsultarColegiadoDto) {
    return this.service.consultarPorCipYDni(dto);
  }

  @Post('actualizar')
  @ApiOperation({ summary: 'Actualizar correo, celular, fecha nacimiento y sexo (Público)' })
  async actualizar(@Body() dto: ActualizarDatosColegiadoDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return this.service.actualizarDatos(dto, String(ip), String(userAgent));
  }

  // ==========================================
  // RUTAS PROTEGIDAS (DASHBOARD ADMINISTRATIVO)
  // ==========================================

  @Get('historial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar quiénes actualizaron sus datos con paginación' })
  async listar(@Query() filtros: FiltroActualizacionesDto) {
    return this.service.listarActualizaciones(filtros);
  }

  @Get('exportar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Exportar registros de actualizaciones a Excel' })
  async exportar(@Query() filtros: FiltroActualizacionesDto) {
    return this.service.exportarTodos(filtros);
  }

  @Post('reenviar-pendientes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reenviar constancias por correo a todos los colegiados pendientes' })
  async reenviarPendientes(@Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
    return this.service.reenviarCorreosPendientes(req.user?.sub, String(ip));
  }

  @Post(':id/reenviar-correo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reenviar constancia de actualización por correo a un colegiado' })
  async reenviarCorreo(@Param('id') id: string, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
    return this.service.reenviarCorreo(id, req.user?.sub, String(ip));
  }

  // ==========================================
  // CONFIGURACIÓN Y PLANTILLA DE CORREO (ADMIN)
  // ==========================================

  @Get('email-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener la configuración y diseño de correo de actualización' })
  async obtenerEmailConfig() {
    return this.service.obtenerEmailConfig();
  }

  @Post('email-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Guardar la configuración de correo, colores y logo' })
  async guardarEmailConfigPost(@Body() dto: ActualizarEmailConfigDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const usuario = req.user?.username || req.user?.sub || 'admin';
    return this.service.guardarEmailConfig(dto, usuario, String(ip), String(userAgent));
  }

  @Put('email-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar la configuración de correo, colores y logo' })
  async guardarEmailConfigPut(@Body() dto: ActualizarEmailConfigDto, @Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const usuario = req.user?.username || req.user?.sub || 'admin';
    return this.service.guardarEmailConfig(dto, usuario, String(ip), String(userAgent));
  }

  @Post('email-config/restaurar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restaurar la plantilla y colores a los valores por defecto' })
  async restaurarEmailConfig(@Req() req: any) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const usuario = req.user?.username || req.user?.sub || 'admin';
    return this.service.restaurarEmailConfig(usuario, String(ip), String(userAgent));
  }

  @Post('email-config/previsualizar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generar vista previa HTML interactiva con datos simulados' })
  async previsualizarEmail(@Body() dto: PrevisualizarEmailDto) {
    return this.service.previsualizarEmail(dto);
  }

  @Post('email-config/probar-envio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enviar correo de prueba al destinatario indicado' })
  async probarEnvioEmail(@Body() dto: ProbarEnvioEmailDto) {
    return this.service.probarEnvioEmail(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener detalle de actualización por ID' })
  async obtenerPorId(@Param('id') id: string) {
    return this.service.obtenerPorId(id);
  }
}
