import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EsPdfBase64 } from '../../fam-beneficios/dto/fam-solicitud.dto';

export const ESTADOS_DUPLICADO = ['DETECTADO', 'CONFIRMADO', 'DESCARTADO'] as const;
export type EstadoDuplicado = (typeof ESTADOS_DUPLICADO)[number];

export class DocumentoDuplicadoDto {
  @IsString()
  @IsNotEmpty({ message: 'La etiqueta del documento es obligatoria' })
  @MaxLength(100)
  etiqueta: string;

  @Validate(EsPdfBase64)
  @IsString()
  @IsNotEmpty({ message: 'El PDF del documento es obligatorio' })
  pdfBase64: string;
}

export class CrearDuplicadoDto {
  @IsString()
  @IsNotEmpty({ message: 'El colegiado es obligatorio' })
  @MaxLength(50)
  colegiadoId: string;

  @IsString()
  @IsNotEmpty({ message: 'El tipo de beneficio es obligatorio' })
  @MaxLength(36)
  tipoBeneficioId: string;

  @IsOptional()
  @IsIn(ESTADOS_DUPLICADO)
  estado?: EstadoDuplicado;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  expedienteIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => DocumentoDuplicadoDto)
  documentos?: DocumentoDuplicadoDto[];
}

export class ActualizarDuplicadoDto {
  @IsOptional()
  @IsIn(ESTADOS_DUPLICADO)
  estado?: EstadoDuplicado;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observaciones?: string;
}
