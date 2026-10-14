import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsIn,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EstadosHabilidadQueryDto {
  @ApiProperty({ example: '140313', description: 'Numero de CIP del colegiado' })
  @IsString({ message: 'El campo cip debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El campo cip es obligatorio' })
  @MaxLength(20, { message: 'El campo cip no puede exceder 20 caracteres' })
  cip: string;

  @ApiProperty({
    example: '2020-01',
    description:
      'Periodo inicial del reporte (YYYY-MM o YYYY-MM-DD). Opcional. Por defecto: mes de incorporacion del colegiado.',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El campo desde debe ser una cadena de texto' })
  @Matches(/^\d{4}(-\d{2}(-\d{2})?)?$/, {
    message: 'El campo desde debe tener formato YYYY-MM o YYYY-MM-DD (ej. 2020-01)',
  })
  desde?: string;
}

export class EstadosHabilidadLoteDto {
  @ApiProperty({
    example: ['140313', '140456'],
    description: 'Lista de numeros de CIP (maximo 20 por descarga)',
    type: [String],
  })
  @IsArray({ message: 'El campo cips debe ser un arreglo de numeros de CIP' })
  @ArrayNotEmpty({ message: 'Debe indicar al menos un numero de CIP' })
  @ArrayMaxSize(20, {
    message: 'La descarga en bloque admite un maximo de 20 colegiados',
  })
  @IsString({ each: true, message: 'Cada elemento de cips debe ser una cadena de texto' })
  @MaxLength(20, {
    each: true,
    message: 'Cada numero de CIP no puede exceder 20 caracteres',
  })
  cips: string[];

  @ApiProperty({
    example: '2020-01',
    description: 'Periodo inicial del reporte (YYYY-MM o YYYY-MM-DD). Opcional.',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'El campo desde debe ser una cadena de texto' })
  @Matches(/^\d{4}(-\d{2}(-\d{2})?)?$/, {
    message: 'El campo desde debe tener formato YYYY-MM o YYYY-MM-DD (ej. 2020-01)',
  })
  desde?: string;
}

export class SubirLogoDto {
  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgo...',
    description: 'Imagen del logo en base64 (con o sin prefijo data URI)',
  })
  @IsString({ message: 'El contenido del logo debe ser una cadena base64' })
  @IsNotEmpty({ message: 'El contenido del logo es obligatorio' })
  @MaxLength(1500000, { message: 'El logo supera el tamanho maximo permitido (300 KB)' })
  contenido: string;

  @ApiProperty({ example: 'image/png' })
  @IsString({ message: 'El campo mimeType debe ser una cadena de texto' })
  @IsIn(['image/png', 'image/jpeg', 'image/webp'], {
    message: 'El formato del logo debe ser PNG, JPG o WEBP',
  })
  mimeType: string;

  @ApiProperty({ example: 'logo-cip.png' })
  @IsString({ message: 'El campo filename debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del archivo es obligatorio' })
  @MaxLength(150, { message: 'El nombre del archivo no puede exceder 150 caracteres' })
  filename: string;
}
