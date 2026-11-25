import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PASSWORD_REGEX, PASSWORD_MESSAGE } from './cambiar-password-obligatorio.dto';

export class ConfirmarRecuperacionDto {
  @ApiProperty({ example: 'a1b2c3d4...' })
  @IsString()
  @MinLength(10, { message: 'Token de recuperación inválido' })
  token: string;

  @ApiProperty({ example: 'NuevoPass2026*!' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;
}
