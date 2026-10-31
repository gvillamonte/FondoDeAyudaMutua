import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FamService } from './fam.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('FAM - Fondo de Asistencia Mutual')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fam')
export class FamController {
  constructor(private famService: FamService) {}

  @Get('beneficiarios')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Buscar colegiados con beneficiarios FAM' })
  async search(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('estado') estado?: string,
    @Query('conBeneficiarios') conBeneficiarios?: string,
  ) {
    return this.famService.search({ search, page, limit, estado, conBeneficiarios });
  }

  @Get('autocomplete')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Autocomplete de colegiados por CIP, DNI o nombre' })
  async autocomplete(@Query('q') q: string) {
    return this.famService.autocomplete(q);
  }

  @Get('exportar')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Exportar todos los colegiados FAM a Excel' })
  async exportar(
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('conBeneficiarios') conBeneficiarios?: string,
  ) {
    return this.famService.exportar({ search, estado, conBeneficiarios });
  }

  @Get('buscar-personas')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Buscar personas en TPersona para agregar como beneficiarios' })
  async buscarPersonas(@Query('q') q: string) {
    return this.famService.buscarPersonas(q);
  }

  @Get('parentescos')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Lista de parentescos desde TConstante (LEGACY_DB)' })
  async parentescos() {
    return this.famService.obtenerParentescosDesdeLegado();
  }

  @Post('personas')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Crear persona en TPersona (LEGACY_DB) para uso como beneficiario' })
  async crearPersona(
    @Body() body: {
      nombres: string;
      apPaterno: string;
      apMaterno: string;
      dni: string;
      sexo: 'M' | 'F';
      fechaNac?: string;
      celular?: string;
      email?: string;
      direccion?: string;
      parentescoCod: string;
    },
  ) {
    return this.famService.crearPersonaEnLegado(body);
  }

  @Get('personas/:id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener colegiado por ID con beneficiarios' })
  async getColegiadoById(@Param('id') id: string) {
    const result = await this.famService.getColegiadoById(id);
    if (!result) throw new NotFoundException('Colegiado no encontrado');
    return result;
  }

  @Get('colegiado/:id/beneficiarios')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Beneficiarios de un colegiado especifico' })
  async getBeneficiariosByColegiado(@Param('id') id: string) {
    return this.famService.getBeneficiariosByColegiado(id);
  }

  @Get('beneficiario/:id/imagenes')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Imagenes de un beneficiario (DNI, carta, sucesion)' })
  async getImagenesBeneficiario(@Param('id') id: string) {
    return this.famService.getImagenesBeneficiario(id);
  }

  @Get('resumen')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Resumen general del FAM' })
  async getResumen() {
    return this.famService.getResumen();
  }

  @Post('colegiado/:id/beneficiarios')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Crear un nuevo beneficiario para un colegiado' })
  async crearBeneficiario(
    @Param('id') colegiadoId: string,
    @Body() body: {
      nombre: string;
      dni?: string;
      parentesco: string;
      porcentaje: number;
      observaciones?: string;
      imagenes?: {
        dniCara?: string;
        dniReverso?: string;
        cartaDeclaratoria?: string;
        sucesionIntestada?: string;
      };
    },
  ) {
    return this.famService.crearBeneficiario(colegiadoId, body);
  }

  @Put('beneficiario/:id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Actualizar beneficiario' })
  async actualizarBeneficiario(
    @Param('id') id: string,
    @Body() body: {
      nombre?: string;
      dni?: string;
      parentesco?: string;
      porcentaje?: number;
      activo?: boolean;
      observaciones?: string;
    },
  ) {
    return this.famService.actualizarBeneficiario(id, body);
  }

  @Put('beneficiario/:id/imagenes')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Actualizar imagenes de un beneficiario' })
  async actualizarImagenes(
    @Param('id') id: string,
    @Body() body: {
      dniCara?: string;
      dniReverso?: string;
      cartaDeclaratoria?: string;
      sucesionIntestada?: string;
    },
  ) {
    return this.famService.actualizarImagenes(id, body);
  }

  @Delete('beneficiario/:id')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar (desactivar) beneficiario' })
  async eliminarBeneficiario(@Param('id') id: string) {
    return this.famService.eliminarBeneficiario(id);
  }

  @Post('carga-masiva')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Registrar beneficiario por carga masiva (CIP + datos)' })
  async cargaMasiva(
    @Body() body: {
      cip: string;
      nombre: string;
      dni?: string;
      parentesco: string;
      porcentaje: number;
      observaciones?: string;
    },
  ) {
    return this.famService.cargaMasiva(body);
  }
}
