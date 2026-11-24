import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRolDto } from './dto/update-rol.dto';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('modulos')
  @ApiOperation({ summary: 'Listar catálogo de módulos del sistema disponibles para roles' })
  getModulosCatalogo() {
    return this.rolesService.getModulosCatalogo();
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los roles con sus módulos y conteo de usuarios' })
  async findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un rol por ID' })
  async findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Crear un nuevo rol con módulos habilitados' })
  @ApiResponse({ status: 201, description: 'Rol creado exitosamente' })
  async create(@Body() dto: CreateRolDto, @Request() req: any) {
    const currentUserId = req.user?.sub;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return this.rolesService.create(dto, currentUserId, ip, ua);
  }

  @Put(':id')
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar un rol existente y sus accesos a módulos' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRolDto,
    @Request() req: any,
  ) {
    const currentUserId = req.user?.sub;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return this.rolesService.update(id, dto, currentUserId, ip, ua);
  }

  @Patch(':id/estado')
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Activar o desactivar un rol' })
  async toggleEstado(@Param('id') id: string, @Request() req: any) {
    const currentUserId = req.user?.sub;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return this.rolesService.toggleEstado(id, currentUserId, ip, ua);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar un rol personalizado que no tenga usuarios asignados' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const currentUserId = req.user?.sub;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return this.rolesService.remove(id, currentUserId, ip, ua);
  }
}
