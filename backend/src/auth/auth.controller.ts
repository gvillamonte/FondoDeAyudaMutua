import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CambiarPasswordObligatorioDto } from './dto/cambiar-password-obligatorio.dto';
import { SolicitarRecuperacionDto } from './dto/solicitar-recuperacion.dto';
import { ConfirmarRecuperacionDto } from './dto/confirmar-recuperacion.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMINISTRADOR', 'SUPER_ADMINISTRADOR')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario registrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado (Solo Administradores)' })
  @ApiResponse({ status: 409, description: 'Usuario o email ya existe' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token' })
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshTokens(refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener datos del usuario autenticado y sus permisos por módulo' })
  async me(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @Patch('cambiar-password-obligatorio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambio de contraseña obligatorio tras primer ingreso o reseteo' })
  async cambiarPasswordObligatorio(
    @Request() req: any,
    @Body() dto: CambiarPasswordObligatorioDto,
  ) {
    return this.authService.cambiarPasswordObligatorio(req.user.sub, dto.password);
  }

  @Post('recuperar-password/solicitar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar enlace de recuperación de contraseña por correo' })
  async solicitarRecuperacion(
    @Body() dto: SolicitarRecuperacionDto,
    @Headers('origin') origin?: string,
  ) {
    return this.authService.solicitarRecuperacionPassword(dto.identifier, origin);
  }

  @Get('recuperar-password/verificar')
  @ApiOperation({ summary: 'Verificar validez del token de recuperación de contraseña' })
  async verificarTokenRecuperacion(@Query('token') token: string) {
    return this.authService.verificarTokenRecuperacion(token);
  }

  @Post('recuperar-password/confirmar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirmar restablecimiento de contraseña con token' })
  async confirmarRecuperacion(@Body() dto: ConfirmarRecuperacionDto) {
    return this.authService.confirmarRecuperacionPassword(dto.token, dto.password);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.sub);
    return { message: 'Sesión cerrada correctamente' };
  }
}
