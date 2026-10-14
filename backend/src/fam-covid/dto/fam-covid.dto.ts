import { IsString, IsOptional, IsBoolean, IsNumber, IsIn, IsArray, ValidateNested, IsInt, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const MODALIDADES_VALIDAS = ['monto_unico', 'monto_compartido', 'opcion_sucesiva'];
const TIPOS_COMPROBANTE = ['FACTURA', 'BOLETA', 'RECIBO_HONORARIOS', 'OTRO'];

// ========== COMPROBANTE CONTABLE ==========
export class CrearComprobanteDto {
  @ApiProperty({ enum: TIPOS_COMPROBANTE })
  @IsString()
  @IsIn(TIPOS_COMPROBANTE)
  tipoComprobante: string;

  @ApiPropertyOptional({ example: 'B001' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  serie?: string;

  @ApiPropertyOptional({ example: '000123' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @ApiPropertyOptional({ example: 'Gastos de sepelio' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  concepto?: string;

  @ApiProperty({ example: 180.0 })
  @IsNumber()
  @Min(0.01)
  importeTotal: number;

  @ApiPropertyOptional({ description: 'PDF en base64, máx 10MB' })
  @IsOptional()
  @IsString()
  pdfBase64?: string;
}

// ========== BENEFICIARIO EN ASIGNACIÓN COVID ==========
export class BeneficiarioCovidDto {
  @ApiPropertyOptional({ description: 'ID del beneficiario en APP_DB (si origen SISTEMA)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  nombre: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dni?: string;

  @ApiProperty()
  @IsString()
  parentesco: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  porcentaje: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  orden?: number;
}

// ========== CREAR ASIGNACIÓN COVID ==========
export class CrearAsignacionCovidDto {
  @ApiProperty({ description: 'ID del colegiado (legado o sistema)' })
  @IsString()
  colegiadoId: string;

  @ApiProperty({ enum: MODALIDADES_VALIDAS })
  @IsString()
  @IsIn(MODALIDADES_VALIDAS)
  modalidadBeneficio: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monto?: number;

  @ApiPropertyOptional({ example: '2021-05-12' })
  @IsOptional()
  @IsString()
  fechaPago?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  memorandoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cartaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ type: [BeneficiarioCovidDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BeneficiarioCovidDto)
  beneficiarios: BeneficiarioCovidDto[];

  @ApiPropertyOptional({ description: 'ID del beneficiario solicitante (para modalidades con beneficiarios)' })
  @IsOptional()
  @IsString()
  solicitanteBeneficiarioId?: string;

  @ApiPropertyOptional({ description: 'Índice del solicitante en el array de beneficiarios (para origen legado)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  solicitanteIndice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  solicitanteNombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  solicitanteDni?: string;

  @ApiPropertyOptional({ type: [CrearComprobanteDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearComprobanteDto)
  comprobantes?: CrearComprobanteDto[];
}

// ========== ACTUALIZAR ASIGNACIÓN COVID ==========
export class ActualizarAsignacionCovidDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  monto?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fechaPago?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  memorandoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cartaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  solicitanteNombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  solicitanteDni?: string;
}
