import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfiguracionesService } from './configuraciones.service';
import { CrearConfiguracionDto, ActualizarConfiguracionDto } from './dto/configuracion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Configuraciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('configuraciones')
export class ConfiguracionesController {
  constructor(private configuracionesService: ConfiguracionesService) {}

  @Post()
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Crear configuración' })
  async crear(@Body() dto: CrearConfiguracionDto) {
    return this.configuracionesService.crear(dto);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Listar configuraciones' })
  async listar(
    @Query('search') search?: string,
    @Query('activo') activo?: string,
    @Query('grupo') grupo?: string,
  ) {
    return this.configuracionesService.listar({
      search,
      activo: activo === 'true' ? true : activo === 'false' ? false : undefined,
      grupo,
    });
  }

  @Get('montos-fam')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Obtener montos predeterminados FAM' })
  async obtenerMontosFam() {
    return this.configuracionesService.obtenerMontosFam();
  }

  @Get('grupo/:grupo')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Listar configuraciones por grupo' })
  async listarPorGrupo(@Param('grupo') grupo: string) {
    return this.configuracionesService.listarPorGrupo(grupo);
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener configuración por ID' })
  async obtenerPorId(@Param('id') id: string) {
    return this.configuracionesService.obtenerPorId(id);
  }

  @Put(':id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar configuración' })
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarConfiguracionDto) {
    return this.configuracionesService.actualizar(id, dto);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar configuración' })
  async eliminar(@Param('id') id: string) {
    return this.configuracionesService.eliminar(id);
  }
}
