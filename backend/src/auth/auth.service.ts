import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as crypto from 'crypto';

const MOCK_USERS: Record<string, any> = {
  admin: {
    id: '00000000-0000-0000-0000-000000000001',
    username: 'admin',
    email: 'admin@sistemacip.pe',
    nombreCompleto: 'Administrador del Sistema',
    rol: 'ADMINISTRADOR',
    activo: true,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuPFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop',
  },
  operador1: {
    id: '00000000-0000-0000-0000-000000000002',
    username: 'operador1',
    email: 'operador@sistemacip.pe',
    nombreCompleto: 'Operador de Pagos',
    rol: 'OPERADOR_PAGOS',
    activo: true,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuPFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop',
  },
  auditor1: {
    id: '00000000-0000-0000-0000-000000000003',
    username: 'auditor1',
    email: 'auditor@sistemacip.pe',
    nombreCompleto: 'Auditor del Sistema',
    rol: 'AUDITOR',
    activo: true,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuPFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop',
  },
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private transporter: any = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private initTransporter() {
    if (this.transporter) return;
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<number>('SMTP_PORT', 465));
    const secure = this.configService.get<string>('SMTP_SECURE', 'true') === 'true' || port === 465;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });
      this.logger.log(`Servicio SMTP de autenticación configurado: ${host}:${port}`);
    } else {
      this.logger.warn('Configuración SMTP incompleta para recuperación de contraseñas.');
    }
  }

  async login(dto: LoginDto) {
    let usuario: any = null;
    const cleanIdentifier = (dto.username || '').trim();

    if (this.prisma.databaseAvailable) {
      usuario = await this.prisma.usuario.findFirst({
        where: {
          OR: [
            { username: cleanIdentifier },
            { email: cleanIdentifier },
          ],
        },
        include: { rolInfo: true },
      });
    } else {
      usuario = MOCK_USERS[cleanIdentifier.toLowerCase()] || null;
      if (usuario) {
        const mockPasswordHash = await bcrypt.hash('Admin123!', 10);
        usuario = { ...usuario, passwordHash: mockPasswordHash };
      }
    }

    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, usuario.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (this.prisma.databaseAvailable) {
      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { ultimoAcceso: new Date() },
      });
    }

    const defaultAllModulos = [
      'dashboard', 'colegiados', 'actualizacion-datos', 'beneficios', 'pagos',
      'caja', 'tesoreria', 'fam', 'reportes', 'configuraciones', 'auditoria', 'usuarios'
    ];
    let modulos: string[] = [];
    if (usuario.rolInfo?.modulos) {
      try {
        modulos = JSON.parse(usuario.rolInfo.modulos);
      } catch {
        modulos = defaultAllModulos;
      }
    } else if (usuario.rol === 'ADMINISTRADOR' || usuario.rol === 'SUPER_ADMINISTRADOR') {
      modulos = defaultAllModulos;
    }

    const tokens = await this.generateTokens(usuario.id, usuario.username, usuario.rol);

    return {
      usuario: {
        id: usuario.id,
        username: usuario.username,
        email: usuario.email,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
        debeCambiarPassword: Boolean(usuario.debeCambiarPassword),
        modulos,
      },
      ...tokens,
    };
  }

  async getProfile(userId: string) {
    const defaultAllModulos = [
      'dashboard', 'colegiados', 'actualizacion-datos', 'beneficios', 'pagos',
      'caja', 'tesoreria', 'fam', 'reportes', 'configuraciones', 'auditoria', 'usuarios'
    ];

    if (!this.prisma.databaseAvailable) {
      return {
        id: userId,
        username: 'admin',
        email: 'admin@sistemacip.pe',
        nombreCompleto: 'Administrador del Sistema',
        rol: 'ADMINISTRADOR',
        debeCambiarPassword: false,
        modulos: defaultAllModulos,
      };
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      include: { rolInfo: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    let modulos: string[] = [];
    if (usuario.rolInfo?.modulos) {
      try {
        modulos = JSON.parse(usuario.rolInfo.modulos);
      } catch {
        modulos = defaultAllModulos;
      }
    } else if (usuario.rol === 'ADMINISTRADOR' || usuario.rol === 'SUPER_ADMINISTRADOR') {
      modulos = defaultAllModulos;
    }

    return {
      id: usuario.id,
      username: usuario.username,
      email: usuario.email,
      nombreCompleto: usuario.nombreCompleto,
      rol: usuario.rol,
      debeCambiarPassword: Boolean(usuario.debeCambiarPassword),
      modulos,
    };
  }

  async register(dto: RegisterDto) {
    if (this.prisma.databaseAvailable) {
      const existingUser = await this.prisma.usuario.findFirst({
        where: { OR: [{ username: dto.username }, { email: dto.email }] },
      });
      if (existingUser) {
        throw new ConflictException(existingUser.username === dto.username ? 'Usuario ya existe' : 'Email ya registrado');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const userId = '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0');

    if (this.prisma.databaseAvailable) {
      const usuario = await this.prisma.usuario.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          nombreCompleto: dto.nombreCompleto,
          rol: dto.rol,
        },
      });
      const tokens = await this.generateTokens(usuario.id, usuario.username, usuario.rol);
      return { usuario: { id: usuario.id, username: usuario.username, email: usuario.email, nombreCompleto: usuario.nombreCompleto, rol: usuario.rol }, ...tokens };
    }

    const tokens = await this.generateTokens(userId, dto.username, dto.rol);
    return {
      usuario: { id: userId, username: dto.username, email: dto.email, nombreCompleto: dto.nombreCompleto, rol: dto.rol },
      ...tokens,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async refreshTokens(refreshToken: string) {
    if (!this.prisma.databaseAvailable) {
      const payload: any = this.jwtService.decode(refreshToken);
      if (!payload) throw new UnauthorizedException('Token invalido');
      return this.generateTokens(payload.sub, payload.username, payload.rol);
    }

    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
      include: { usuario: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token invalido o expirado');
    }

    await this.prisma.refreshToken.update({ where: { id: storedToken.id }, data: { revoked: true } });
    return this.generateTokens(storedToken.usuario.id, storedToken.usuario.username, storedToken.usuario.rol);
  }

  async logout(userId: string) {
    if (this.prisma.databaseAvailable) {
      await this.prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
    }
  }

  private async generateTokens(userId: string, username: string, rol: string) {
    const payload = { sub: userId, username, rol };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: this.configService.get<string>('JWT_EXPIRATION', '15m') }),
      this.jwtService.signAsync(payload, { secret: this.configService.get<string>('JWT_REFRESH_SECRET'), expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d') }),
    ]);

    if (this.prisma.databaseAvailable) {
      const tokenHash = this.hashToken(refreshToken);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      await this.prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
    }

    return { accessToken, refreshToken };
  }

  async cambiarPasswordObligatorio(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 8 caracteres');
    }

    if (!this.prisma.databaseAvailable) {
      return { success: true, message: 'Contraseña actualizada correctamente.' };
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        passwordHash,
        debeCambiarPassword: false,
      },
    });

    return {
      success: true,
      message: 'Contraseña actualizada correctamente. Bienvenido al sistema.',
    };
  }

  async solicitarRecuperacionPassword(identifier: string, originHost?: string) {
    const clean = (identifier || '').trim();
    if (!clean) {
      throw new BadRequestException('Debe ingresar su usuario o correo electrónico');
    }

    if (!this.prisma.databaseAvailable) {
      return {
        success: true,
        message: 'Si el correo o usuario está registrado, se enviará el enlace de recuperación.',
      };
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        OR: [{ username: clean }, { email: clean }],
        activo: true,
      },
    });

    if (usuario && usuario.email) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora de vigencia

      await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          resetPasswordToken: token,
          resetPasswordExpires: expires,
        },
      });

      // Enviar correo asíncronamente
      this.enviarCorreoRecuperacion(
        usuario.email,
        usuario.nombreCompleto || usuario.username,
        token,
        originHost,
      ).catch((e) => this.logger.error(`Error enviando correo de recuperación: ${e.message}`));
    }

    return {
      success: true,
      message: 'Si el correo o usuario está registrado, se ha enviado un enlace para restablecer su contraseña.',
    };
  }

  async verificarTokenRecuperacion(token: string) {
    if (!token || token.length < 10) {
      return { valid: false, message: 'Token de recuperación inválido' };
    }

    if (!this.prisma.databaseAvailable) {
      return { valid: true, username: 'demo', emailMasked: 'demo@cipcusco.org.pe' };
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!usuario) {
      return { valid: false, message: 'El enlace de recuperación es inválido o ya ha expirado' };
    }

    const parts = usuario.email.split('@');
    const masked =
      parts[0].length > 3
        ? parts[0].substring(0, 2) + '***' + parts[0].slice(-1) + '@' + parts[1]
        : parts[0] + '@' + parts[1];

    return {
      valid: true,
      username: usuario.username,
      emailMasked: masked,
    };
  }

  async confirmarRecuperacionPassword(token: string, newPassword: string) {
    if (!token || !newPassword || newPassword.length < 8) {
      throw new BadRequestException('Datos incompletos o contraseña demasiado corta (mínimo 8 caracteres)');
    }

    if (!this.prisma.databaseAvailable) {
      return { success: true, message: 'Contraseña restablecida exitosamente.' };
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!usuario) {
      throw new BadRequestException('El enlace de recuperación es inválido o ha expirado. Por favor solicite uno nuevo.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        debeCambiarPassword: false,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: usuario.id, revoked: false },
      data: { revoked: true },
    });

    return {
      success: true,
      message: 'Su contraseña ha sido restablecida exitosamente. Ya puede iniciar sesión con su nueva clave.',
    };
  }

  private async enviarCorreoRecuperacion(
    destinatario: string,
    nombre: string,
    token: string,
    originHost?: string,
  ) {
    try {
      this.initTransporter();
      if (!this.transporter) {
        this.logger.warn('Transporter SMTP no disponible para enviar correo de recuperación.');
        return;
      }

      const baseUrl = originHost
        ? originHost.replace(/\/$/, '')
        : (this.configService.get<string>('FRONTEND_URL') || 'http://18.191.81.201:3000');
      const resetLink = `${baseUrl}/recuperar-password?token=${token}`;
      const fromName =
        this.configService.get<string>('SMTP_FROM') ||
        '"Colegio de Ingenieros del Perú" <notificaciones@cipcusco.org.pe>';

      const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="background-color: #8f0404; padding: 28px 30px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">COLEGIO DE INGENIEROS DEL PERÚ</h1>
              <p style="margin: 4px 0 0 0; color: #FCD34D; font-size: 13px; font-weight: 600; text-transform: uppercase;">Consejo Departamental Cusco</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 30px;">
              <h2 style="margin: 0 0 16px 0; color: #1E293B; font-size: 18px; font-weight: 700;">Recuperación de Contraseña</h2>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                Estimado(a) <strong>${nombre}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                Hemos recibido una solicitud para restablecer la contraseña de acceso a su cuenta en el <strong>Sistema del Colegio de Ingenieros del Perú</strong>.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; background-color: #8f0404; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 8px; box-shadow: 0 2px 4px rgba(143, 4, 4, 0.25);">
                  Restablecer mi Contraseña
                </a>
              </div>
              <p style="margin: 0 0 12px 0; color: #64748B; font-size: 12px; line-height: 1.5;">
                Si el botón no funciona, copie y pegue el siguiente enlace en su navegador web:
              </p>
              <p style="margin: 0 0 24px 0; color: #8f0404; font-size: 12px; word-break: break-all; background-color: #FEF2F2; padding: 10px 12px; border-radius: 6px; border: 1px solid #FECACA;">
                <a href="${resetLink}" style="color: #8f0404; text-decoration: underline;">${resetLink}</a>
              </p>
              <div style="background-color: #FFFBEB; border-left: 4px solid #F59E0B; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400E; font-size: 12px; line-height: 1.5;">
                  <strong>Aviso de seguridad:</strong> Este enlace es personal, de un solo uso y expirará en <strong>60 minutos</strong>. Si usted no solicitó este cambio, ignore este mensaje; su cuenta continuará protegida con su clave habitual.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 30px; text-align: center;">
              <p style="margin: 0 0 4px 0; color: #64748B; font-size: 12px; font-weight: 600;">Colegio de Ingenieros del Perú — Consejo Departamental Cusco</p>
              <p style="margin: 0; color: #94A3B8; font-size: 11px;">Este es un mensaje automático del sistema, por favor no responda a este correo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      await this.transporter.sendMail({
        from: fromName,
        to: destinatario,
        subject: 'Recuperación de Contraseña — Colegio de Ingenieros del Perú',
        html,
      });

      this.logger.log(`Correo de recuperación enviado exitosamente a: ${destinatario}`);
    } catch (err: any) {
      this.logger.error(`Error al enviar correo de recuperación a ${destinatario}: ${err.message}`);
    }
  }
}
