import { IsString, IsEmail, MinLength, MaxLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  password: string;

  @ApiProperty({ example: 'Juan Pérez López' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nombreCompleto: string;

  @ApiProperty({ enum: ['SUPER_ADMINISTRADOR', 'ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR'] })
  @IsString()
  @IsIn(['SUPER_ADMINISTRADOR', 'ADMINISTRADOR', 'OPERADOR_PAGOS', 'AUDITOR'])
  rol: string;
}
