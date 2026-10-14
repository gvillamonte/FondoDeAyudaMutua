import { IsString, IsNumber, IsOptional, IsBoolean, IsIn, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearBeneficioDto {
  @ApiProperty({ example: 'Asistencia Económica por Fallecimiento' })
  @IsString()
  nombre: string;

  @ApiPropertyOptional({ example: 'Asistencia económica para gastos de sepelio' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ enum: ['ASISTENCIA_ECONOMICA', 'CAPACITACION', 'SEGURO', 'BONO', 'OTRO'] })
  @IsString()
  @IsIn(['ASISTENCIA_ECONOMICA', 'CAPACITACION', 'SEGURO', 'BONO', 'OTRO'])
  tipo: string;

  @ApiProperty({ example: 1500.00 })
  @IsNumber()
  @Min(0)
  montoBase: number;

  @ApiPropertyOptional({ example: 'PEN' })
  @IsOptional()
  @IsString()
  @IsIn(['PEN', 'USD'])
  moneda?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requiereJunta?: boolean;
}

export class ActualizarBeneficioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ enum: ['ASISTENCIA_ECONOMICA', 'CAPACITACION', 'SEGURO', 'BONO', 'OTRO'] })
  @IsOptional()
  @IsString()
  @IsIn(['ASISTENCIA_ECONOMICA', 'CAPACITACION', 'SEGURO', 'BONO', 'OTRO'])
  tipo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoBase?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiereJunta?: boolean;
}
