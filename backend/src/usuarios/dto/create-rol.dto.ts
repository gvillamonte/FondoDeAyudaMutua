import { IsString, MinLength, MaxLength, IsOptional, IsBoolean, IsArray, ArrayMinSize, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRolDto {
  @ApiProperty({ example: 'CAJERO_PRINCIPAL' })
  @IsString()
  @MinLength(2, { message: 'El identificador del rol debe tener al menos 2 caracteres' })
  @MaxLength(50)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'El código del rol solo debe contener mayúsculas, números, guiones y guiones bajos (ej. OPERADOR_CAJA)' })
  id: string;

  @ApiProperty({ example: 'Cajero Principal' })
  @IsString()
  @MinLength(2, { message: 'El nombre del rol debe tener al menos 2 caracteres' })
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional({ example: 'Encargado de cobro de aportaciones y arqueos de caja' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiProperty({ example: ['dashboard', 'caja', 'pagos'] })
  @IsArray({ message: 'Los módulos deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe habilitar al menos un módulo para el rol' })
  @IsString({ each: true })
  modulos: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
