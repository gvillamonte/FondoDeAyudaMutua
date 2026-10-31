import { IsString, IsNotEmpty, IsOptional, IsEmail, Matches, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class VerificarCipDto {
  @IsString({ message: 'El CIP debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El número de CIP es obligatorio' })
  cip: string;
}

export class ConsultarColegiadoDto {
  @IsString({ message: 'El CIP debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El número de CIP es obligatorio' })
  cip: string;

  @IsString({ message: 'El DNI debe ser una cadena de texto' })
  @Matches(/^\d{8}$/, { message: 'El DNI debe contener exactamente 8 dígitos numéricos' })
  dni: string;
}

export class ActualizarDatosColegiadoDto {
  @IsString()
  @IsNotEmpty({ message: 'El número de CIP es obligatorio' })
  cip: string;

  @IsString()
  @Matches(/^\d{8}$/, { message: 'El DNI debe contener exactamente 8 dígitos numéricos' })
  dni: string;

  @IsEmail({}, { message: 'El correo electrónico no tiene un formato válido' })
  email: string;

  @IsString()
  @Matches(/^9\d{8}$/, { message: 'El celular debe ser un número peruano de 9 dígitos que comience con 9' })
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
