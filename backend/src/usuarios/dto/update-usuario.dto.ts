import { IsString, IsEmail, MinLength, MaxLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUsuarioDto {
  @ApiPropertyOptional({ example: 'usuario@cipcusco.org.pe' })
  @IsOptional()
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido' })
  email?: string;

  @ApiPropertyOptional({ example: 'Juan Pérez López' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre completo debe tener al menos 2 caracteres' })
  @MaxLength(200)
  nombreCompleto?: string;

  @ApiPropertyOptional({ example: 'AUDITOR' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  rol?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
