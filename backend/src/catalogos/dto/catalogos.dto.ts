import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsIn,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const APLICA_A_VALIDOS = ['FALLECIMIENTO', 'INCAPACIDAD', 'ENF_TERMINAL'];

// ========== MONTOS FAM ==========
export class CrearMontoFamDto {
  @ApiProperty({ example: 'Fallecimiento del Titular' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional({ enum: APLICA_A_VALIDOS })
  @IsOptional()
  @IsString()
  @IsIn(APLICA_A_VALIDOS)
  aplicaA?: string;

  @ApiProperty({ example: 3000.0 })
  @IsNumber()
  @Min(0)
  monto: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarMontoFamDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional({ enum: APLICA_A_VALIDOS })
  @IsOptional()
  @IsString()
  @IsIn(APLICA_A_VALIDOS)
  aplicaA?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  monto?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ========== ESTADOS DE SOLICITUD ==========
export class CrearEstadoSolicitudDto {
  @ApiProperty({ example: 'Anulada' })
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  nombre: string;

  @ApiPropertyOptional({ example: 'Solicitud anulada por el solicitante' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional({ example: 6, description: 'Posición en el flujo' })
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarEstadoSolicitudDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ========== MONEDAS ==========
export class CrearMonedaDto {
  @ApiProperty({ example: 'Euro' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre: string;

  @ApiProperty({ example: '€' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  simbolo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarMonedaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  simbolo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ========== TIPOS DE BENEFICIO ==========
export class CrearTipoBeneficioConfigDto {
  @ApiProperty({ example: 'Asistencia Económica' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre: string;

  @ApiPropertyOptional({ example: 'Ayuda económica directa al colegiado' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarTipoBeneficioConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ========== MEMORÁNDUMS ==========
export class CrearMemorandoDto {
  @ApiProperty({ example: 'MEM-045-2021' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  numero: string;

  @ApiPropertyOptional({ example: '2021-05-12' })
  @IsOptional()
  @IsString()
  fecha?: string;

  @ApiPropertyOptional({ example: 'Ayuda económica por COVID-19' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  asunto?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarMemorandoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fecha?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  asunto?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

// ========== CARTAS ==========
export class CrearCartaDto {
  @ApiProperty({ example: 'CART-0123-2021' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  numero: string;

  @ApiPropertyOptional({ example: '2021-05-12' })
  @IsOptional()
  @IsString()
  fecha?: string;

  @ApiPropertyOptional({ example: 'Remisión de expediente aGerencia' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referencia?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarCartaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  numero?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fecha?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referencia?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
