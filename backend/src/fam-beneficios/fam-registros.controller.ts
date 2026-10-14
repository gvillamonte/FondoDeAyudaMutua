import { Controller, Post, Body, Delete, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FamBeneficiosService } from './fam-beneficios.service';
import { CrearRegistroFamDto } from './dto/fam-solicitud.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('FAM - Registro de Casos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fam-registros')
export class FamRegistrosController {
  constructor(private famBeneficiosService: FamBeneficiosService) {}

  @Post()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Registrar caso FAM completo: beneficiarios + solicitud + vinculacion (transaccional)',
  })
  async crearRegistro(@Body() dto: CrearRegistroFamDto, @Req() req: any) {
    return this.famBeneficiosService.crearRegistro(dto, req.user.sub, req.ip);
  }

  @Delete('bulk')
  @Roles('SUPER_ADMINISTRADOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar TODOS los registros FAM (solo SUPER_ADMINISTRADOR)',
  })
  async bulkDeleteAllRegistros(@Req() req: any) {
    return this.famBeneficiosService.bulkDeleteAllRegistros(req.user.sub);
  }
}
