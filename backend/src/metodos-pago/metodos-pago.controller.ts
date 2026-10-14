import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, Request, HttpCode, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MetodosPagoService } from './metodos-pago.service';
import { CrearMetodoPagoDto, ActualizarMetodoPagoDto } from './dto/metodo-pago.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Métodos de Pago')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('metodos-pagos')
export class MetodosPagoController {
  constructor(private metodosPagoService: MetodosPagoService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Listar métodos de pago' })
  async listar(@Query('activos') activos?: string) {
    return this.metodosPagoService.listar(activos === 'true');
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener método de pago por ID' })
  async obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.metodosPagoService.obtenerPorId(id);
  }

  @Post()
  @Roles('ADMINISTRADOR')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear método de pago' })
  async crear(@Body() dto: CrearMetodoPagoDto, @Request() req: any) {
    return this.metodosPagoService.crear(dto, req.user.sub, req.ip);
  }

  @Put(':id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar método de pago' })
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarMetodoPagoDto,
    @Request() req: any,
  ) {
    return this.metodosPagoService.actualizar(id, dto, req.user.sub, req.ip);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar método de pago' })
  async eliminar(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.metodosPagoService.eliminar(id, req.user.sub, req.ip);
  }
}
