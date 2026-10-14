import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
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
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    let usuario: any = null;

    if (this.prisma.databaseAvailable) {
      usuario = await this.prisma.usuario.findUnique({
        where: { username: dto.username },
      });
    } else {
      usuario = MOCK_USERS[dto.username] || null;
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

    const tokens = await this.generateTokens(usuario.id, usuario.username, usuario.rol);

    return {
      usuario: {
        id: usuario.id,
        username: usuario.username,
        email: usuario.email,
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
      },
      ...tokens,
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
}
