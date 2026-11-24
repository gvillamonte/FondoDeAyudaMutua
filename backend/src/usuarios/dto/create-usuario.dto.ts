import { IsString, IsEmail, MinLength, MaxLength, Matches, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PASSWORD_REGEX = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).{8,}$/;
export const PASSWORD_MESSAGE = 'La contraseña debe tener al menos 8 caracteres e incluir letras, números y al menos un símbolo especial (!@#$%&*...)';

export class CreateUsuarioDto {
  @ApiProperty({ example: 'jdoe' })
  @IsString()
  @MinLength(3, { message: 'El nombre de usuario debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El nombre de usuario no puede exceder 50 caracteres' })
  username: string;

  @ApiProperty({ example: 'jdoe@cipcusco.org.pe' })
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido' })
  email: string;

  @ApiProperty({ example: 'Pass1234*!' })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @MaxLength(128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @ApiProperty({ example: 'Juan Pérez López' })
  @IsString()
  @MinLength(2, { message: 'El nombre completo debe tener al menos 2 caracteres' })
  @MaxLength(200)
  nombreCompleto: string;

  @ApiProperty({ example: 'OPERADOR_PAGOS' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  rol: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
