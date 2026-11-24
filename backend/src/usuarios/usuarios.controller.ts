import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { QueryUsuarioDto } from './dto/query-usuario.dto';

@ApiTags('Usuarios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Listar usuarios con paginación y filtros' })
  async findAll(@Query() query: QueryUsuarioDto) {
    return this.usuariosService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Obtener detalle de un usuario' })
  async findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Post()
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  async create(@Body() dto: CreateUsuarioDto, @Request() req: any) {
    const currentUserId = req.user?.sub;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return this.usuariosService.create(dto, currentUserId, ip, ua);
  }

  @Put(':id')
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar datos de un usuario' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
    @Request() req: any,
  ) {
    const currentUserId = req.user?.sub;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return this.usuariosService.update(id, dto, currentUserId, ip, ua);
  }

  @Patch(':id/password')
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Cambiar la contraseña de un usuario con validación estricta' })
  async changePassword(
    @Param('id') id: string,
    @Body() dto: ChangePasswordDto,
    @Request() req: any,
  ) {
    const currentUserId = req.user?.sub;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return this.usuariosService.changePassword(id, dto, currentUserId, ip, ua);
  }

  @Patch(':id/estado')
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Activar o desactivar un usuario' })
  async toggleEstado(@Param('id') id: string, @Request() req: any) {
    const currentUserId = req.user?.sub;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return this.usuariosService.toggleEstado(id, currentUserId, ip, ua);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiOperation({ summary: 'Eliminar o desactivar un usuario' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const currentUserId = req.user?.sub;
    const ip = req.ip || req.connection?.remoteAddress;
    const ua = req.headers?.['user-agent'];
    return this.usuariosService.remove(id, currentUserId, ip, ua);
  }
}
