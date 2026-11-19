import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEmail,
  IsIn,
  Matches,
} from 'class-validator';

export class ActualizarEmailConfigDto {
  @IsString({ message: 'El asunto debe ser un texto' })
  @IsNotEmpty({ message: 'El asunto no puede estar vacío' })
  asunto: string;

  @IsString({ message: 'El nombre de remitente debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre de remitente es obligatorio' })
  nombreRemitente: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo remitente debe tener un formato válido' })
  correoRemitente?: string;

  // Paleta de Colores
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color primario debe ser un código HEX válido (ej: #781622 o #3258CA)',
  })
  colorPrimario: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color secundario debe ser un código HEX válido',
  })
  colorSecundario: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color de fondo debe ser un código HEX válido',
  })
  colorFondo: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color de texto debe ser un código HEX válido',
  })
  colorTexto: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color de borde debe ser un código HEX válido',
  })
  colorBorde: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color de alerta de fondo debe ser un código HEX válido',
  })
  colorAlertaBg: string;

  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'El color de texto de alerta debe ser un código HEX válido',
  })
  colorAlertaTexto: string;

  // Textos Institucionales
  @IsString()
  @IsNotEmpty({ message: 'El título institucional es obligatorio' })
  tituloInstitucional: string;

  @IsString()
  @IsNotEmpty({ message: 'El subtítulo institucional es obligatorio' })
  subtituloInstitucional: string;

  @IsString()
  @IsNotEmpty({ message: 'El mensaje de bienvenida es obligatorio' })
  mensajeBienvenida: string;

  @IsString()
  @IsNotEmpty({ message: 'El aviso de seguridad es obligatorio' })
  avisoSeguridad: string;

  @IsString()
  @IsNotEmpty({ message: 'El pie de página es obligatorio' })
  piePagina: string;

  // Logo
  @IsString()
  @IsIn(['default', 'custom', 'none'], {
    message: 'El tipo de logo debe ser default, custom o none',
  })
  logoTipo: 'default' | 'custom' | 'none';

  @IsOptional()
  @IsString()
  logoBase64?: string | null;

  @IsOptional()
  @IsString()
  logoMime?: string | null;

  @IsOptional()
  @IsString()
  logoFilename?: string | null;

  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @IsOptional()
  @IsNumber()
  logoAncho?: number;

  @IsOptional()
  @IsNumber()
  logoAlto?: number;

  // Modo Código HTML
  @IsBoolean()
  usarCodigoPersonalizado: boolean;

  @IsOptional()
  @IsString()
  codigoHtmlPersonalizado?: string | null;
}

export class ProbarEnvioEmailDto {
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico destinatario válido' })
  @IsNotEmpty({ message: 'El correo destinatario es obligatorio' })
  destinatario: string;

  @IsOptional()
  config?: Partial<ActualizarEmailConfigDto>;
}

export class PrevisualizarEmailDto {
  @IsOptional()
  config?: Partial<ActualizarEmailConfigDto>;

  @IsOptional()
  datosPrueba?: Record<string, string>;
}
