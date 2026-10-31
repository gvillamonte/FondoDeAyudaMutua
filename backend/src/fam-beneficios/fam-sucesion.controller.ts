import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FamSucesionService } from './fam-sucesion.service';
import {
  RegistrarSucesionIntestadaDto,
  ModificarDistribucionSucesionDto,
} from './dto/fam-sucesion.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('FAM - Sucesión Intestada')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fam-sucesion')
export class FamSucesionController {
  constructor(private readonly sucesionService: FamSucesionService) {}

  @Post()
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar expediente con múltiples beneficiarios por sucesión intestada y sustento PDF',
  })
  async registrarSucesion(@Body() dto: RegistrarSucesionIntestadaDto, @Req() req: any) {
    const data = await this.sucesionService.registrarSucesion(dto, req.user?.sub, req.ip);
    return {
      success: true,
      data,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('expediente/:solicitudId')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({
    summary: 'Obtener información y herederos de sucesión intestada por ID de solicitud/expediente',
  })
  async obtenerPorSolicitud(@Param('solicitudId') solicitudId: string) {
    const data = await this.sucesionService.obtenerSucesionPorSolicitud(solicitudId);
    return {
      success: true,
      data,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':sucesionId/distribucion')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS')
  @ApiOperation({
    summary: 'Modificar distribución de herederos y registrar nueva versión histórica',
  })
  async modificarDistribucion(
    @Param('sucesionId') sucesionId: string,
    @Body() dto: ModificarDistribucionSucesionDto,
    @Req() req: any,
  ) {
    const data = await this.sucesionService.modificarDistribucion(
      sucesionId,
      dto,
      req.user?.sub,
      req.ip,
    );
    return {
      success: true,
      data,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':sucesionId/versiones')
  @Roles('ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR')
  @ApiOperation({
    summary: 'Consultar el historial de versiones de una sucesión intestada',
  })
  async obtenerVersiones(@Param('sucesionId') sucesionId: string) {
    const data = await this.sucesionService.obtenerHistorialVersiones(sucesionId);
    return {
      success: true,
      data,
      error: null,
      timestamp: new Date().toISOString(),
    };
  }
}
