import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PagosService } from './pagos.service';
import {
  CrearSolicitudDto,
  RegistrarPagoDto,
  ResolverSolicitudDto,
} from './dto/pago.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Pagos y Solicitudes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pagos')
export class PagosController {
  constructor(private pagosService: PagosService) {}

  // ========== SOLICITUDES ==========

  @Post('solicitudes')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear solicitud de beneficio' })
  async crearSolicitud(@Body() dto: CrearSolicitudDto, @Request() req: any) {
    return this.pagosService.crearSolicitud(dto, req.user.sub);
  }

  @Get('solicitudes')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Listar solicitudes de beneficio' })
  async findAllSolicitudes(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('estado') estado?: string,
    @Query('colegiadoId') colegiadoId?: string,
    @Query('search') search?: string,
  ) {
    return this.pagosService.findAllSolicitudes({
      page,
      limit,
      estado,
      colegiadoId,
      search,
    });
  }

  @Put('solicitudes/:id/resolver')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Resolver solicitud (aprobar/rechazar)' })
  async resolverSolicitud(
    @Param('id') id: string,
    @Body() dto: ResolverSolicitudDto,
    @Request() req: any,
  ) {
    return this.pagosService.resolverSolicitud(id, dto, req.user.sub);
  }

  // ========== PAGOS ==========

  @Post()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar pago' })
  async registrarPago(@Body() dto: RegistrarPagoDto, @Request() req: any) {
    return this.pagosService.registrarPago(dto, req.user.sub);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Listar pagos' })
  async findAllPagos(
    @Query('colegiadoId') colegiadoId?: string,
    @Query('estado') estado?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.pagosService.findAllPagos({
      colegiadoId,
      estado,
      fechaDesde,
      fechaHasta,
      page,
      limit,
    });
  }

  @Put(':id/revertir')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Revertir un pago completado' })
  async revertirPago(
    @Param('id') id: string,
    @Body('motivo') motivo: string,
    @Request() req: any,
  ) {
    return this.pagosService.revertirPago(id, req.user.sub, motivo);
  }

  // ========== ESTADÍSTICAS ==========

  @Get('estadisticas')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Estadísticas generales de pagos y solicitudes' })
  async getEstadisticas() {
    return this.pagosService.getEstadisticas();
  }
}
