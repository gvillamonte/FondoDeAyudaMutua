import {
  Controller,
  Get,
  Post,
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

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener detalle de actualización por ID' })
  async obtenerPorId(@Param('id') id: string) {
    return this.service.obtenerPorId(id);
  }
}
