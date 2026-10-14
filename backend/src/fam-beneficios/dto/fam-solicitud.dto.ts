import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  IsIn,
  ValidateNested,
  ArrayMaxSize,
  Min,
  Max,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';

const PDF_BASE64_MAX_LENGTH = 14_000_000; // ~10MB de archivo binario

@ValidatorConstraint({ name: 'pdfBase64', async: false })
export class EsPdfBase64 implements ValidatorConstraintInterface {
  validate(value: string | undefined | null, args: ValidationArguments) {
    if (value === undefined || value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    if (value.length > PDF_BASE64_MAX_LENGTH) return false;
    const base64 = value.includes(',') ? value.split(',')[1] : value;
    return base64.startsWith('JVBERi'); // magic bytes "%PDF" en base64
  }
  defaultMessage(args: ValidationArguments) {
    return `${args.property} debe ser un archivo PDF en base64 (maximo 10MB)`;
  }
}

export class DocumentoExpedienteDto {
  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  fichaAdmisibilidad?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  solicitudAsignacion?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  cartaRemision?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  memorando?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  ordenPago?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  sucesionIntestada?: string;
}

export class BeneficiarioRegistroDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  nombre: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsString()
  parentesco: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  colegioadoId?: string;

  @IsOptional()
  @IsInt()
  orden?: number;
}

export class CrearRegistroFamDto {
  @IsString()
  colegiadoId: string;

  @ValidateNested({ each: true })
  @Type(() => BeneficiarioRegistroDto)
  @ArrayMaxSize(20)
  beneficiarios: BeneficiarioRegistroDto[];

  @IsOptional()
  @IsString()
  tipoBeneficioId?: string;

  @IsOptional()
  @IsNumber()
  tipoBeneficioConfigId?: number;

  @IsNumber()
  @Min(0)
  monto: number;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsIn(['PENDIENTE', 'PAGADA'])
  estado?: string;

  @IsOptional()
  @IsDateString()
  fechaSolicitud?: string; // Fecha de recepcion de la solicitud en CIP

  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @IsOptional()
  @IsBoolean()
  documentacionCompleta?: boolean;

  @IsOptional()
  @IsString()
  documentacionObservacion?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  fichaAdmisibilidad?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  solicitudAsignacion?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  cartaRemision?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  memorando?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  ordenPago?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  cartaNumero?: string;

  @IsOptional()
  @IsString()
  expedienteNumero?: string;

  @IsOptional()
  @IsString()
  modalidadBeneficio?: string; // 'monto_unico' | 'monto_compartido' | 'opcion_sucesiva'

  // Solicitante: beneficiario registrado (radio) o manual (caso sucesion intestada)
  @IsOptional()
  @IsString()
  solicitanteBeneficiarioId?: string;

  // Indice del beneficiario dentro de la lista enviada (para registros de origen legado sin id)
  @IsOptional()
  @IsInt()
  @Min(0)
  solicitanteIndice?: number;

  @IsOptional()
  @IsString()
  solicitanteNombre?: string;

  @IsOptional()
  @IsString()
  solicitanteDni?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  sucesionIntestada?: string;

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
  formaPago?: string;

  @IsOptional()
  @IsString()
  banco?: string;

  @IsOptional()
  @IsDateString()
  ordenPagoFecha?: string;
}

export class CrearFamSolicitudDto {
  @IsString()
  colegiadoId: string;

  @IsString()
  tipoBeneficioId: string;

  @IsNumber()
  @Min(0)
  monto: number;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  fichaAdmisibilidad?: string;

  @IsOptional()
  @IsString()
  solicitudAsignacion?: string;

  @IsOptional()
  @IsString()
  cartaRemision?: string;

  @IsOptional()
  @IsString()
  cartaNumero?: string;

  @IsOptional()
  @IsString()
  expedienteNumero?: string;

  @IsOptional()
  @IsDateString()
  cartaFecha?: string;

  @IsOptional()
  @IsString()
  memorando?: string;

  @IsOptional()
  @IsString()
  memorandoNumero?: string;

  @IsOptional()
  @IsDateString()
  memorandoFecha?: string;

  @IsOptional()
  @IsString()
  ordenPago?: string;

  @IsOptional()
  @IsString()
  formaPago?: string;

  @IsOptional()
  @IsString()
  banco?: string;

  @IsOptional()
  @IsDateString()
  ordenPagoFecha?: string;
}

export class ActualizarFamSolicitudDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  monto?: number;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsDateString()
  fechaSolicitud?: string;

  @IsOptional()
  @IsDateString()
  fechaPago?: string;

  @IsOptional()
  @IsBoolean()
  documentacionCompleta?: boolean;

  @IsOptional()
  @IsString()
  documentacionObservacion?: string;

  @IsOptional()
  @IsString()
  tipoBeneficioId?: string;

  @IsOptional()
  @IsNumber()
  tipoBeneficioConfigId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['monto_unico', 'monto_compartido', 'opcion_sucesiva'])
  modalidadBeneficio?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  descuentoCovid?: number;

  @IsOptional()
  @IsString()
  solicitanteNombre?: string;

  @IsOptional()
  @IsString()
  solicitanteDni?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  sucesionIntestada?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  fichaAdmisibilidad?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  solicitudAsignacion?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  cartaRemision?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  memorando?: string;

  @Validate(EsPdfBase64)
  @IsOptional()
  @IsString()
  ordenPago?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsString()
  cartaNumero?: string;

  @IsOptional()
  @IsString()
  expedienteNumero?: string;

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
  formaPago?: string;

  @IsOptional()
  @IsString()
  banco?: string;

  @IsOptional()
  @IsDateString()
  ordenPagoFecha?: string;
}
