import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
  IsIn,
  Matches,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EsPdfBase64 } from './fam-solicitud.dto';

export class HerederoSucesionItemDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsIn(['DNI', 'CE', 'PASAPORTE'], { message: 'tipoDocumento debe ser DNI, CE o PASAPORTE' })
  tipoDocumento: string;

  @IsString()
  @Matches(/^[A-Za-z0-9]{8,15}$/, { message: 'numeroDocumento tiene formato inválido' })
  numeroDocumento: string;

  @IsString()
  nombres: string;

  @IsString()
  apellidos: string;

  @IsString()
  parentesco: string;

  @IsNumber()
  @Min(0.01, { message: 'El porcentaje asignado debe ser mayor a 0%' })
  @Max(100.0, { message: 'El porcentaje asignado no puede exceder el 100%' })
  porcentaje: number;

  @IsNumber()
  @Min(0.01, { message: 'El monto asignado debe ser mayor a S/ 0.00' })
  monto: number;

  @IsOptional()
  @IsString()
  @Matches(/^(\+51)?[0-9]{7,12}$/, { message: 'El teléfono tiene formato inválido' })
  telefono?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  declaracionJuradaPdf?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  ordenPagoPdf?: string;
}

export class RegistrarSucesionIntestadaDto {
  @IsString()
  colegiadoId: string;

  @IsOptional()
  @IsString()
  tipoBeneficioId?: string;

  @IsOptional()
  @IsNumber()
  tipoBeneficioConfigId?: number;

  @IsNumber()
  @Min(1, { message: 'El monto total debe ser mayor a cero' })
  montoTotal: number;

  @Validate(EsPdfBase64)
  @IsString()
  sustentoPdf: string; // Documento obligatorio

  @IsOptional()
  @IsString()
  numeroPartidaRegistral?: string;

  @IsOptional()
  @IsString()
  notariaJuzgado?: string;

  @IsOptional()
  @IsDateString()
  fechaEmisionDocumento?: string;

  @IsOptional()
  @IsIn(['BORRADOR', 'ENVIADO', 'OBSERVADO', 'PAGADA'])
  estado?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'Debe ingresar al menos 1 beneficiario' })
  @ArrayMaxSize(20, { message: 'No se permiten más de 20 beneficiarios' })
  @Type(() => HerederoSucesionItemDto)
  herederos: HerederoSucesionItemDto[];

  // Documentos complementarios del expediente FAM
  @Validate(EsPdfBase64)
  @IsOptional()
  actaDefuncion?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  solicitudAsignacion?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  fichaAdmisibilidad?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  cartaRemision?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  memorando?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  ordenPago?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  otrosDocumentos?: string;

  @IsOptional()
  @IsDateString()
  fechaSolicitud?: string;

  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @IsOptional()
  @IsDateString()
  fechaDefuncion?: string;

  @IsOptional()
  @IsString()
  causaFallecimiento?: string;

  @IsOptional()
  @IsString()
  expedienteNumero?: string;

  @IsOptional()
  @IsString()
  cartaNumero?: string;

  @IsOptional()
  @IsDateString()
  cartaFecha?: string;

  @IsOptional()
  @IsString()
  memorandoNumero?: string;

  @IsOptional()
  @IsDateString()
  memorandoFecha?: string;

  @IsOptional()
  @IsString()
  banco?: string;

  @IsOptional()
  @IsString()
  formaPago?: string;
}

export class ModificarDistribucionSucesionDto {
  @IsString()
  motivoModificacion: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @Type(() => HerederoSucesionItemDto)
  herederos: HerederoSucesionItemDto[];
}
