import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

const GRUPOS_VALIDOS = ['MONTO_FAM', 'METODO_PAGO', 'ESTADO_SOLICITUD', 'TIPO_BENEFICIO', 'MONEDA', 'GENERAL'];

export class CrearConfiguracionDto {
  @IsString()
  clave: string;

  @IsString()
  valor: string;

  @IsOptional()
  @IsString()
  @IsIn(GRUPOS_VALIDOS, { message: `Grupo debe ser uno de: ${GRUPOS_VALIDOS.join(', ')}` })
  grupo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarConfiguracionDto {
  @IsOptional()
  @IsString()
  valor?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
