import { IsString, MinLength, MaxLength, IsOptional, IsBoolean, IsArray, ArrayMinSize } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRolDto {
  @ApiPropertyOptional({ example: 'Cajero General' })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre del rol debe tener al menos 2 caracteres' })
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Descripción actualizada' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @ApiPropertyOptional({ example: ['dashboard', 'caja', 'pagos'] })
  @IsOptional()
  @IsArray({ message: 'Los módulos deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un módulo' })
  @IsString({ each: true })
  modulos?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
