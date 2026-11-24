import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches, IsIn, IsInt, Min, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class VerificarCipDto {
  @IsString({ message: 'El CIP debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El número de CIP es obligatorio' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  cip: string;
}

export class ConsultarColegiadoDto {
  @IsString({ message: 'El CIP debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El número de CIP es obligatorio' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  cip: string;

  @IsString({ message: 'El documento de identidad debe ser una cadena de texto' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, '') : value))
  @Matches(/^[0-9a-zA-Z-]{4,15}$/, { message: 'El documento de identidad debe contener entre 4 y 15 caracteres alfanuméricos' })
  dni: string;
}

export class ActualizarDatosColegiadoDto {
  @IsString()
  @IsNotEmpty({ message: 'El número de CIP es obligatorio' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  cip: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, '') : value))
  @Matches(/^[0-9a-zA-Z-]{4,15}$/, { message: 'El documento de identidad debe contener entre 4 y 15 caracteres alfanuméricos' })
  dni: string;

  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @Matches(/^\+?[0-9\s-]{6,20}$/, { message: 'El celular debe contener entre 6 y 15 dígitos con o sin código de país (+XX)' })
  celular: string;

  @IsOptional()
  @IsString()
  fechaNacimiento?: string;

  @IsOptional()
  @IsIn(['M', 'F', 'MASCULINO', 'FEMENINO', 'Masc', 'Fem', ''], {
    message: 'El sexo debe ser M (Masculino) o F (Femenino)',
  })
  sexo?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  departamento?: string;

  @IsOptional()
  @IsString()
  provincia?: string;

  @IsOptional()
  @IsString()
  distrito?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  estadoCivil?: string;

  @IsOptional()
  @IsBoolean()
  aceptoTerminos?: boolean;
}

export class FiltroActualizacionesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  agrupado?: string;
}
