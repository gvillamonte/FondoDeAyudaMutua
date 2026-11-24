import { IsString, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).{8,}$/;
export const PASSWORD_MESSAGE = 'La contraseña debe tener al menos 8 caracteres e incluir letras, números y al menos un símbolo especial (!@#$%&*...)';

export class RegisterDto {
  @ApiProperty({ example: 'nuevo_usuario' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ example: 'usuario@sistemacip.pe' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiProperty({ example: 'Juan Pérez López' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nombreCompleto: string;

  @ApiProperty({ example: 'OPERADOR_PAGOS' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  rol: string;
}
