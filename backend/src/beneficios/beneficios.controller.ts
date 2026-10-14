import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BeneficiosService } from './beneficios.service';
import { CrearBeneficioDto, ActualizarBeneficioDto } from './dto/beneficio.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Beneficios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('beneficios')
export class BeneficiosController {
  constructor(private beneficiosService: BeneficiosService) {}

  @Post()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nuevo beneficio' })
  async create(@Body() dto: CrearBeneficioDto, @Request() req: any) {
    return this.beneficiosService.create(dto, req.user.sub);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Listar beneficios' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('tipo') tipo?: string,
    @Query('activo') activo?: boolean,
    @Query('search') search?: string,
  ) {
    return this.beneficiosService.findAll({ page, limit, tipo, activo, search });
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({ summary: 'Obtener beneficio por ID' })
  async findOne(@Param('id') id: string) {
    return this.beneficiosService.findOne(id);
  }

  @Put(':id')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({ summary: 'Actualizar beneficio' })
  async update(@Param('id') id: string, @Body() dto: ActualizarBeneficioDto) {
    return this.beneficiosService.update(id, dto);
  }

  @Put(':id/toggle-activo')
  @Roles('ADMINISTRADOR')
  @ApiOperation({ summary: 'Activar/desactivar beneficio' })
  async toggleActivo(@Param('id') id: string) {
    return this.beneficiosService.toggleActivo(id);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar beneficio' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.beneficiosService.remove(id, req.user.sub);
  }
}
