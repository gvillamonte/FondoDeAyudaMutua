import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsInt,
  IsUUID,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearSolicitudDto {
  @ApiProperty({ example: '12345678-1234-1234-1234-123456789012' })
  @IsUUID()
  beneficioId: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  colegiadoId: string;

  @ApiProperty({ example: 1500.00 })
  @IsNumber()
  @Min(0)
  montoSolicitado: number;

  @ApiProperty({ example: 'Fallecimiento del padre del colegiado' })
  @IsString()
  motivo: string;
}

export class RegistrarPagoDto {
  @ApiProperty({ example: '12345678-1234-1234-1234-123456789012' })
  @IsUUID()
  solicitudId: string;

  @ApiProperty({ example: 1500.00 })
  @IsNumber()
  @Min(0)
  montoPagado: number;

  @ApiProperty({ example: 1, description: 'ID del método de pago (ver GET /metodos-pagos)' })
  @IsInt()
  @Min(1)
  metodoPagoId: number;

  @ApiPropertyOptional({ example: 'REF-2024-001' })
  @IsOptional()
  @IsString()
  referenciaPago?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comprobanteUrl?: string;
}

export class ResolverSolicitudDto {
  @ApiProperty({ enum: ['APROBADA', 'RECHAZADA', 'EN_REVISION'] })
  @IsString()
  @IsIn(['APROBADA', 'RECHAZADA', 'EN_REVISION'])
  estado: string;

  @ApiPropertyOptional({ example: 1500.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoAprobado?: number;

  @ApiPropertyOptional({ example: 'Solicitud aprobada conforme a reglamento' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class FiltrarPagosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  colegiadoId?: string;

  @ApiPropertyOptional({ enum: ['PENDIENTE', 'COMPLETADO', 'REVERTIDO', 'ANULADO'] })
  @IsOptional()
  @IsString()
  @IsIn(['PENDIENTE', 'COMPLETADO', 'REVERTIDO', 'ANULADO'])
  estado?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
