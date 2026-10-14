import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FamDuplicadosService } from './fam-duplicados.service';
import {
  CrearDuplicadoDto,
  ActualizarDuplicadoDto,
  DocumentoDuplicadoDto,
} from './dto/fam-duplicado.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

const LECTURA = ['ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR'];
const ESCRITURA = ['ADMINISTRADOR', 'OPERADOR_PAGOS'];

@ApiTags('Beneficios Duplicados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fam-duplicados')
export class FamDuplicadosController {
  constructor(private famDuplicadosService: FamDuplicadosService) {}

  @Get()
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Listar casos de beneficio duplicado (auto + manual)' })
  async listar(@Query('search') search?: string) {
    return this.famDuplicadosService.listar({ search });
  }

  @Get(':id/documentos/:documentoId/pdf')
  @Roles(...LECTURA)
  @ApiOperation({ summary: 'Servir PDF de documentacion del duplicado' })
  async obtenerDocumentoPdf(@Param('id') id: string, @Param('documentoId') documentoId: string) {
    return this.famDuplicadosService.obtenerDocumentoPdf(id, documentoId);
  }

  @Post()
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar caso de duplicado (manual) con documentacion' })
  async crear(@Body() dto: CrearDuplicadoDto, @Request() req: any) {
    return this.famDuplicadosService.crear(dto, req.user.sub, req.ip);
  }

  @Put(':id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Confirmar / descartar o actualizar un caso de duplicado' })
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarDuplicadoDto,
    @Request() req: any,
  ) {
    return this.famDuplicadosService.actualizar(id, dto, req.user.sub, req.ip);
  }

  @Delete(':id')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Eliminar un caso de duplicado (y su documentacion)' })
  async eliminar(@Param('id') id: string, @Request() req: any) {
    return this.famDuplicadosService.eliminar(id, req.user.sub, req.ip);
  }

  @Post(':id/documentos')
  @Roles(...ESCRITURA)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agregar documentacion al caso de duplicado' })
  async agregarDocumento(
    @Param('id') id: string,
    @Body() dto: DocumentoDuplicadoDto,
    @Request() req: any,
  ) {
    return this.famDuplicadosService.agregarDocumento(id, dto, req.user.sub, req.ip);
  }

  @Delete(':id/documentos/:documentoId')
  @Roles(...ESCRITURA)
  @ApiOperation({ summary: 'Eliminar documentacion del caso de duplicado' })
  async eliminarDocumento(
    @Param('id') id: string,
    @Param('documentoId') documentoId: string,
    @Request() req: any,
  ) {
    return this.famDuplicadosService.eliminarDocumento(id, documentoId, req.user.sub, req.ip);
  }
}
