import { Injectable, Logger, Optional, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ActualizarEmailConfigDto } from './dto/actualizacion-datos-email-config.dto';

export interface DatosActualizadosEmailParams {
  cip: string;
  dni: string;
  nombres: string;
  fechaIngreso?: string | null;
  fechaUltimoPago?: string | null;
  email: string;
  celular: string;
  fechaNacimiento?: string | null;
  sexo?: string | null;
  estadoCivil?: string | null;
  departamento?: string | null;
  provincia?: string | null;
  distrito?: string | null;
  direccion?: string | null;
  referencia?: string | null;
  fechaRegistro: Date | string;
  idOperacion: string;
}

export interface ActualizacionEmailConfig {
  asunto: string;
  nombreRemitente: string;
  correoRemitente?: string;
  colorPrimario: string;
  colorSecundario: string;
  colorFondo: string;
  colorTexto: string;
  colorBorde: string;
  colorAlertaBg: string;
  colorAlertaTexto: string;
  tituloInstitucional: string;
  subtituloInstitucional: string;
  mensajeBienvenida: string;
  avisoSeguridad: string;
  piePagina: string;
  logoTipo: 'default' | 'custom' | 'none';
  logoBase64?: string | null;
  logoMime?: string | null;
  logoFilename?: string | null;
  logoUrl?: string | null;
  logoAncho?: number;
  logoAlto?: number;
  usarCodigoPersonalizado: boolean;
  codigoHtmlPersonalizado?: string | null;
  updatedAt?: string;
  updatedBy?: string;
}

export const CONFIG_EMAIL_CLAVE = 'ACTUALIZACION_DATOS_EMAIL_CONFIG';

export const CONFIG_EMAIL_DEFAULT: ActualizacionEmailConfig = {
  asunto: 'Constancia de Actualización de Datos - CIP {{cip}} ({{nombres}})',
  nombreRemitente: 'Colegio de Ingenieros del Perú - CD Cusco',
  correoRemitente: '',
  colorPrimario: '#781622', // Rojo Granate CIP Cusco
  colorSecundario: '#1E293B',
  colorFondo: '#F8FAFC',
  colorTexto: '#1E293B',
  colorBorde: '#E2E8F0',
  colorAlertaBg: '#FEF2F2',
  colorAlertaTexto: '#991B1B',
  tituloInstitucional: 'COLEGIO DE INGENIEROS DEL PERÚ',
  subtituloInstitucional: 'Consejo Departamental Cusco',
  mensajeBienvenida:
    'Le confirmamos que sus datos de contacto, residencia y filiación han sido actualizados satisfactoriamente en el padrón del Colegio de Ingenieros del Perú. A continuación, se detalla el resumen de la información registrada:',
  avisoSeguridad:
    'Aviso de Seguridad: Si usted no reconoció esta operación o detecta alguna inconsistencia, por favor comuníquese de inmediato con las oficinas del Colegio de Ingenieros del Perú.',
  piePagina:
    'Colegio de Ingenieros del Perú — Consejo Departamental Cusco\nSistema de Gestión y Actualización de Datos de Colegiados\nEste mensaje ha sido generado automáticamente, por favor no responda a esta dirección de correo.',
  logoTipo: 'default',
  logoBase64: null,
  logoMime: 'image/jpeg',
  logoFilename: 'logo-cip.jpeg',
  logoUrl: null,
  logoAncho: 180,
  logoAlto: 75,
  usarCodigoPersonalizado: false,
  codigoHtmlPersonalizado: null,
};

@Injectable()
export class ActualizacionDatosEmailService {
  private readonly logger = new Logger(ActualizacionDatosEmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private configService: ConfigService,
    @Optional() private prisma?: PrismaService,
  ) {
    this.initTransporter();
  }

  private initTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<number>('SMTP_PORT', 587));
    const secure = this.configService.get<string>('SMTP_SECURE', 'false') === 'true' || port === 465;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
        },
      });
      this.logger.log(`Servicio SMTP configurado para host: ${host}:${port}`);
    } else {
      this.logger.warn(
        'Variables SMTP_HOST, SMTP_USER o SMTP_PASS no configuradas. Los correos se registrarán en modo simulación.',
      );
    }
  }

  /**
   * Obtiene la configuración del correo desde fam_configuracion,
   * o retorna la predeterminada si no existe.
   */
  async obtenerConfiguracion(): Promise<ActualizacionEmailConfig> {
    if (this.prisma) {
      try {
        const item = await this.prisma.famConfiguracion.findUnique({
          where: { clave: CONFIG_EMAIL_CLAVE },
        });
        if (item?.valor) {
          const parsed = JSON.parse(item.valor);
          const config: ActualizacionEmailConfig = {
            ...CONFIG_EMAIL_DEFAULT,
            ...parsed,
          };
          if (config.subtituloInstitucional && config.subtituloInstitucional.includes('Fondo de Ayuda Mutua')) {
            config.subtituloInstitucional = config.subtituloInstitucional
              .replace(/\s*[—–-]\s*Fondo de Ayuda Mutua/gi, '')
              .replace(/Fondo de Ayuda Mutua/gi, '')
              .trim();
          }
          return config;
        }
      } catch (err: any) {
        this.logger.warn(`Error al leer configuración de correo: ${err.message}`);
      }
    }
    return { ...CONFIG_EMAIL_DEFAULT };
  }

  /**
   * Guarda o actualiza la configuración del correo.
   */
  async guardarConfiguracion(
    dto: ActualizarEmailConfigDto,
    username: string,
  ): Promise<ActualizacionEmailConfig> {
    if (!this.prisma) {
      throw new BadRequestException('Base de datos no disponible');
    }

    const configCompleta: ActualizacionEmailConfig = {
      ...CONFIG_EMAIL_DEFAULT,
      ...dto,
      updatedAt: new Date().toISOString(),
      updatedBy: username,
    };

    const valorJson = JSON.stringify(configCompleta);

    await this.prisma.famConfiguracion.upsert({
      where: { clave: CONFIG_EMAIL_CLAVE },
      update: {
        valor: valorJson,
        descripcion: 'Configuración y plantilla del correo de actualización de datos de colegiados',
        activo: true,
      },
      create: {
        clave: CONFIG_EMAIL_CLAVE,
        valor: valorJson,
        grupo: 'ACTUALIZACION_DATOS',
        descripcion: 'Configuración y plantilla del correo de actualización de datos de colegiados',
        activo: true,
      },
    });

    this.logger.log(`Configuración de correo de actualización guardada por ${username}`);
    return configCompleta;
  }

  /**
   * Restaura la configuración a los valores de fábrica.
   */
  async restaurarConfiguracion(username: string): Promise<ActualizacionEmailConfig> {
    if (!this.prisma) {
      return { ...CONFIG_EMAIL_DEFAULT };
    }

    const configDefault: ActualizacionEmailConfig = {
      ...CONFIG_EMAIL_DEFAULT,
      updatedAt: new Date().toISOString(),
      updatedBy: username,
    };

    await this.prisma.famConfiguracion.upsert({
      where: { clave: CONFIG_EMAIL_CLAVE },
      update: {
        valor: JSON.stringify(configDefault),
        activo: true,
      },
      create: {
        clave: CONFIG_EMAIL_CLAVE,
        valor: JSON.stringify(configDefault),
        grupo: 'ACTUALIZACION_DATOS',
        descripcion: 'Configuración y plantilla del correo de actualización de datos de colegiados',
        activo: true,
      },
    });

    return configDefault;
  }

  /**
   * Obtiene el logo institucional del CIP (mismo origen que Estados de Habilidad)
   */
  async obtenerLogoCip(): Promise<{ buffer: Buffer; filename: string; mime: string } | null> {
    if (this.prisma) {
      try {
        const cfg = await this.prisma.famConfiguracion.findUnique({
          where: { clave: 'LOGO_CIP' },
        });
        if (cfg?.valor) {
          const parsed = JSON.parse(cfg.valor);
          if (parsed?.data) {
            return {
              buffer: Buffer.from(parsed.data, 'base64'),
              filename: parsed.filename || 'Logo.jpeg',
              mime: parsed.mime || 'image/jpeg',
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`No se pudo leer LOGO_CIP de la base de datos: ${err.message}`);
      }
    }

    const posiblesRutas = [
      path.join(process.cwd(), 'assets', 'logo-cip.jpeg'),
      path.join(process.cwd(), '..', 'frontend', 'public', 'logo-cip.jpeg'),
      path.join(__dirname, '..', '..', 'assets', 'logo-cip.jpeg'),
    ];

    for (const ruta of posiblesRutas) {
      try {
        if (fs.existsSync(ruta)) {
          return {
            buffer: fs.readFileSync(ruta),
            filename: 'Logo.jpeg',
            mime: 'image/jpeg',
          };
        }
      } catch {}
    }

    return null;
  }

  /**
   * Resuelve el logo según la configuración: custom, default, o none.
   */
  async resolverLogo(
    config: ActualizacionEmailConfig,
    paraVistaPreviaWeb = false,
  ): Promise<{
    html: string;
    attachments: any[];
    srcParaHtml?: string;
  }> {
    if (config.logoTipo === 'none') {
      return { html: '', attachments: [] };
    }

    const ancho = config.logoAncho || 180;
    const alto = config.logoAlto || 75;

    // Caso 1: Logo Custom en Base64 o URL
    if (config.logoTipo === 'custom') {
      if (config.logoBase64) {
        const mime = config.logoMime || 'image/png';
        const filename = config.logoFilename || 'logo-personalizado.png';

        if (paraVistaPreviaWeb) {
          const dataUri = `data:${mime};base64,${config.logoBase64}`;
          return {
            html: `
              <div style="margin-bottom: 12px; text-align: center;">
                <img src="${dataUri}" alt="Logo CIP" style="max-height: ${alto}px; max-width: ${ancho}px; height: auto; width: auto; display: inline-block; object-fit: contain;" />
              </div>
            `,
            attachments: [],
            srcParaHtml: dataUri,
          };
        }

        const buffer = Buffer.from(config.logoBase64, 'base64');
        return {
          html: `
            <div style="margin-bottom: 12px; text-align: center;">
              <img src="cid:logo_personalizado" alt="Logo CIP" style="max-height: ${alto}px; max-width: ${ancho}px; height: auto; width: auto; display: inline-block; object-fit: contain;" />
            </div>
          `,
          attachments: [
            {
              filename,
              content: buffer,
              cid: 'logo_personalizado',
            },
          ],
          srcParaHtml: 'cid:logo_personalizado',
        };
      } else if (config.logoUrl) {
        return {
          html: `
            <div style="margin-bottom: 12px; text-align: center;">
              <img src="${config.logoUrl}" alt="Logo CIP" style="max-height: ${alto}px; max-width: ${ancho}px; height: auto; width: auto; display: inline-block; object-fit: contain;" />
            </div>
          `,
          attachments: [],
          srcParaHtml: config.logoUrl,
        };
      }
    }

    // Caso 2: Logo Default Institucional
    const logoCip = await this.obtenerLogoCip();
    if (logoCip) {
      if (paraVistaPreviaWeb) {
        const dataUri = `data:${logoCip.mime};base64,${logoCip.buffer.toString('base64')}`;
        return {
          html: `
            <div style="margin-bottom: 12px; text-align: center;">
              <img src="${dataUri}" alt="Logo CIP" style="max-height: ${alto}px; max-width: ${ancho}px; height: auto; width: auto; display: inline-block; object-fit: contain;" />
            </div>
          `,
          attachments: [],
          srcParaHtml: dataUri,
        };
      }

      return {
        html: `
          <div style="margin-bottom: 12px; text-align: center;">
            <img src="cid:logo_cip" alt="Logo CIP" style="max-height: ${alto}px; max-width: ${ancho}px; height: auto; width: auto; display: inline-block; object-fit: contain;" />
          </div>
        `,
        attachments: [
          {
            filename: logoCip.filename,
            content: logoCip.buffer,
            cid: 'logo_cip',
          },
        ],
        srcParaHtml: 'cid:logo_cip',
      };
    }

    // Fallback texto sobrio
    return {
      html: `
        <div style="display: inline-block; background-color: #FFFFFF; color: ${config.colorPrimario}; font-weight: bold; font-size: 15px; padding: 6px 14px; border-radius: 6px; letter-spacing: 1.5px; margin-bottom: 12px;">
          CIP
        </div>
      `,
      attachments: [],
      srcParaHtml: '',
    };
  }

  /**
   * Genera el HTML completo reemplazando placeholders y aplicando diseño visual.
   */
  async generarHtml(
    config: ActualizacionEmailConfig,
    datos: DatosActualizadosEmailParams,
    paraVistaPreviaWeb = false,
  ): Promise<{ html: string; attachments: any[]; subject: string }> {
    const {
      cip,
      dni,
      nombres,
      fechaIngreso,
      fechaUltimoPago,
      email,
      celular,
      fechaNacimiento,
      sexo,
      estadoCivil,
      departamento,
      provincia,
      distrito,
      direccion,
      referencia,
      fechaRegistro,
      idOperacion,
    } = datos;

    const formatearFecha = (f?: string | null) => {
      if (!f) return null;
      const m = String(f).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
    };
    const fechaIngresoTxt = formatearFecha(fechaIngreso) || 'No especificada';
    const fechaUltimoPagoTxt = formatearFecha(fechaUltimoPago) || 'No registrado';

    const fechaFormateada = new Date(fechaRegistro).toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const sexoTexto =
      sexo === 'M' || sexo === 'MASCULINO'
        ? 'Masculino'
        : sexo === 'F' || sexo === 'FEMENINO'
        ? 'Femenino'
        : sexo || 'No especificado';

    const logoRes = await this.resolverLogo(config, paraVistaPreviaWeb);

    // Mapeo de variables
    const variables: Record<string, string> = {
      '{{cip}}': cip || '',
      '{{dni}}': dni || '',
      '{{nombres}}': nombres || '',
      '{{email}}': email || '',
      '{{celular}}': celular || '',
      '{{fechaIngreso}}': fechaIngresoTxt,
      '{{fechaUltimoPago}}': fechaUltimoPagoTxt,
      '{{fechaNacimiento}}': fechaNacimiento || 'No especificada',
      '{{sexo}}': sexoTexto,
      '{{estadoCivil}}': estadoCivil || 'No especificado',
      '{{departamento}}': departamento || 'No especificado',
      '{{provincia}}': provincia || 'No especificada',
      '{{distrito}}': distrito || 'No especificado',
      '{{direccion}}': direccion || 'No especificada',
      '{{referencia}}': referencia || 'No especificada',
      '{{fechaRegistro}}': fechaFormateada,
      '{{idOperacion}}': idOperacion || '',
      '{{logoHtml}}': logoRes.html,
      '{{logoSrc}}': logoRes.srcParaHtml || '',
      '{{tituloInstitucional}}': config.tituloInstitucional,
      '{{subtituloInstitucional}}': config.subtituloInstitucional,
      '{{mensajeBienvenida}}': config.mensajeBienvenida,
      '{{avisoSeguridad}}': config.avisoSeguridad,
      '{{piePagina}}': config.piePagina.replace(/\n/g, '<br>'),
      '{{colorPrimario}}': config.colorPrimario,
      '{{colorSecundario}}': config.colorSecundario,
      '{{colorFondo}}': config.colorFondo,
      '{{colorTexto}}': config.colorTexto,
      '{{colorBorde}}': config.colorBorde,
      '{{colorAlertaBg}}': config.colorAlertaBg,
      '{{colorAlertaTexto}}': config.colorAlertaTexto,
    };

    // Reemplazo en Asunto
    let subject = config.asunto || CONFIG_EMAIL_DEFAULT.asunto;
    for (const [k, v] of Object.entries(variables)) {
      subject = subject.split(k).join(v);
    }

    // Modo 1: Código HTML Personalizado
    if (config.usarCodigoPersonalizado && config.codigoHtmlPersonalizado?.trim()) {
      let customHtml = config.codigoHtmlPersonalizado;
      for (const [k, v] of Object.entries(variables)) {
        customHtml = customHtml.split(k).join(v);
      }
      return {
        html: customHtml,
        attachments: logoRes.attachments,
        subject,
      };
    }

    // Modo 2: Plantilla Estructurada Corporativa
    const defaultTemplate = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Constancia de Actualización de Datos</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${config.colorFondo}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${config.colorTexto};">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${config.colorFondo}; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #FFFFFF; border: 1px solid ${config.colorBorde}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Encabezado Institucional -->
          <tr>
            <td style="background-color: ${config.colorPrimario}; padding: 28px 30px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    ${logoRes.html}
                    <h1 style="color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 700; line-height: 1.3; letter-spacing: 0.5px;">
                      ${config.tituloInstitucional}
                    </h1>
                    <p style="color: #F8FAFC; opacity: 0.92; margin: 5px 0 0 0; font-size: 13px;">
                      ${config.subtituloInstitucional}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Banner de Estado -->
          <tr>
            <td style="background-color: #F0FDF4; border-bottom: 1px solid #BBF7D0; padding: 14px 30px; text-align: center;">
              <span style="color: #166534; font-weight: 600; font-size: 13px;">
                ✓ ACTUALIZACIÓN DE DATOS REGISTRADA CON ÉXITO
              </span>
            </td>
          </tr>

          <!-- Cuerpo del Mensaje -->
          <tr>
            <td style="padding: 30px;">
              <p style="font-size: 15px; margin: 0 0 16px 0; line-height: 1.5; color: ${config.colorTexto};">
                Estimado(a) Ing. <strong>${nombres}</strong>,
              </p>
              <p style="font-size: 13px; margin: 0 0 24px 0; line-height: 1.6; color: #64748B;">
                ${config.mensajeBienvenida}
              </p>

              <!-- Tabla de Datos -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; width: 38%; background-color: ${config.colorFondo};">N° de CIP</td>
                  <td style="padding: 10px 12px; color: ${config.colorPrimario}; font-weight: bold; font-family: monospace; font-size: 14px;">${cip}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">DNI</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto}; font-weight: bold; font-family: monospace;">${dni}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Colegiado</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto}; font-weight: 600;">${nombres}</td>
                </tr>
                ${
                  fechaIngresoTxt !== 'No especificada'
                    ? `
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Fecha de Colegiatura</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto}; font-weight: 600;">${fechaIngresoTxt}</td>
                </tr>`
                    : ''
                }
                ${
                  fechaUltimoPagoTxt !== 'No registrado'
                    ? `
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Fecha Último Pago</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto}; font-weight: 600;">${fechaUltimoPagoTxt}</td>
                </tr>`
                    : ''
                }
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Correo Electrónico</td>
                  <td style="padding: 10px 12px; color: ${config.colorPrimario}; font-weight: 600;">${email}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Número Celular</td>
                  <td style="padding: 10px 12px; color: #15803D; font-weight: bold; font-family: monospace;">${celular}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Fecha de Nacimiento</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto};">${fechaNacimiento || 'No especificada'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Sexo</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto};">${sexoTexto}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Estado Civil</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto}; font-weight: 600;">${estadoCivil || 'No especificado'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Departamento</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto};">${departamento || 'No especificado'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Provincia</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto};">${provincia || 'No especificada'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Distrito</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto};">${distrito || 'No especificado'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Dirección Domiciliaria</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto};">${direccion || 'No especificada'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Referencia de Dirección</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto};">${referencia || 'No especificada'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: ${config.colorFondo};">Fecha y Hora de Registro</td>
                  <td style="padding: 10px 12px; color: ${config.colorTexto};">${fechaFormateada}</td>
                </tr>
              </table>

              <!-- Nota de Seguridad -->
              <div style="background-color: ${config.colorAlertaBg}; border-left: 4px solid ${config.colorPrimario}; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: ${config.colorAlertaTexto}; line-height: 1.5;">
                ${config.avisoSeguridad}
              </div>

              <!-- Código de Operación -->
              <p style="margin: 20px 0 0 0; font-size: 11px; color: #94A3B8; text-align: center;">
                Código de Operación: <span style="font-family: monospace;">${idOperacion}</span>
              </p>
            </td>
          </tr>

          <!-- Footer Institucional -->
          <tr>
            <td style="background-color: ${config.colorFondo}; border-top: 1px solid ${config.colorBorde}; padding: 20px 30px; text-align: center; font-size: 11px; color: #94A3B8; line-height: 1.5;">
              ${config.piePagina.replace(/\n/g, '<br>')}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return {
      html: defaultTemplate,
      attachments: logoRes.attachments,
      subject,
    };
  }

  /**
   * Genera datos simulados estándar para pruebas y preview.
   */
  obtenerDatosEjemplo(datosCustom?: Record<string, string>): DatosActualizadosEmailParams {
    return {
      cip: datosCustom?.cip || '102934',
      dni: datosCustom?.dni || '45892134',
      nombres: datosCustom?.nombres || 'ING. JUAN CARLOS PÉREZ GÓMEZ',
      fechaIngreso: datosCustom?.fechaIngreso || '2015-04-18',
      fechaUltimoPago: datosCustom?.fechaUltimoPago || '2026-10-30',
      email: datosCustom?.email || 'jperez.cip@ejemplo.org.pe',
      celular: datosCustom?.celular || '984123456',
      fechaNacimiento: datosCustom?.fechaNacimiento || '15/08/1988',
      sexo: datosCustom?.sexo || 'M',
      estadoCivil: datosCustom?.estadoCivil || 'Casado(a)',
      departamento: datosCustom?.departamento || 'CUSCO',
      provincia: datosCustom?.provincia || 'CUSCO',
      distrito: datosCustom?.distrito || 'WANCHAQ',
      direccion: datosCustom?.direccion || 'Av. Manuel Prado N° 450 - Dpto 302',
      referencia: datosCustom?.referencia || 'A media cuadra del Parque Marcavalle',
      fechaRegistro: new Date(),
      idOperacion: 'OP-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    };
  }

  /**
   * Previsualización para el navegador web (devuelve HTML seguro para iframe).
   */
  async previsualizarHtml(
    configOverride?: Partial<ActualizacionEmailConfig>,
    datosCustom?: Record<string, string>,
  ): Promise<{ html: string; subject: string }> {
    const configGuardada = await this.obtenerConfiguracion();
    const configFinal: ActualizacionEmailConfig = {
      ...configGuardada,
      ...(configOverride || {}),
    };

    const datosSimulados = this.obtenerDatosEjemplo(datosCustom);
    const resultado = await this.generarHtml(configFinal, datosSimulados, true);
    return {
      html: resultado.html,
      subject: resultado.subject,
    };
  }

  /**
   * Envía un correo de prueba con la configuración especificada.
   */
  async probarEnvio(
    destinatario: string,
    configOverride?: Partial<ActualizacionEmailConfig>,
  ): Promise<{ success: boolean; simulado: boolean; message: string; messageId?: string }> {
    const configGuardada = await this.obtenerConfiguracion();
    const configFinal: ActualizacionEmailConfig = {
      ...configGuardada,
      ...(configOverride || {}),
    };

    const datosSimulados = this.obtenerDatosEjemplo({ email: destinatario });
    const { html, attachments, subject } = await this.generarHtml(configFinal, datosSimulados, false);

    const fromAddress =
      configFinal.correoRemitente && configFinal.nombreRemitente
        ? `"${configFinal.nombreRemitente}" <${configFinal.correoRemitente}>`
        : this.configService.get<string>('SMTP_FROM') ||
          `"${configFinal.nombreRemitente}" <notificaciones@cipcusco.org.pe>`;

    const mailOptions: any = {
      from: fromAddress,
      to: destinatario,
      subject: `[PRUEBA] ${subject}`,
      html,
      text: `Correo de prueba del sistema de actualización de datos CIP.\nDestinatario: ${destinatario}`,
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        this.logger.log(`✓ Correo de prueba enviado a ${destinatario} (MessageId: ${info.messageId})`);
        return {
          success: true,
          simulado: false,
          message: `Correo de prueba enviado satisfactoriamente a ${destinatario}`,
          messageId: info.messageId,
        };
      } catch (err: any) {
        this.logger.error(`Error al enviar correo de prueba a ${destinatario}: ${err.message}`);
        return {
          success: false,
          simulado: false,
          message: `Error al enviar correo vía SMTP: ${err.message}`,
        };
      }
    } else {
      this.logger.log(`[SIMULACIÓN PRUEBA EMAIL] Destinatario: ${destinatario} | Asunto: [PRUEBA] ${subject}`);
      return {
        success: true,
        simulado: true,
        message: `Servicio SMTP no configurado en el servidor (.env). El correo de prueba fue simulado y registrado en los logs del backend.`,
      };
    }
  }

  /**
   * Envía la constancia oficial de actualización de datos al correo registrado del colegiado.
   */
  async enviarConstanciaActualizacion(datos: DatosActualizadosEmailParams): Promise<boolean> {
    const config = await this.obtenerConfiguracion();
    const { html, attachments, subject } = await this.generarHtml(config, datos, false);

    const fromAddress =
      config.correoRemitente && config.nombreRemitente
        ? `"${config.nombreRemitente}" <${config.correoRemitente}>`
        : this.configService.get<string>('SMTP_FROM') ||
          `"${config.nombreRemitente}" <notificaciones@cipcusco.org.pe>`;

    const mailOptions: any = {
      from: fromAddress,
      to: datos.email,
      subject,
      html,
      text:
        `Estimado(a) Ing. ${datos.nombres},\n\n` +
        `${config.mensajeBienvenida}\n\n` +
        `RESUMEN DE INFORMACIÓN REGISTRADA:\n` +
        `• N° de CIP: ${datos.cip}\n` +
        `• DNI: ${datos.dni}\n` +
        `• Colegiado: ${datos.nombres}\n` +
        `• Correo Electrónico: ${datos.email}\n` +
        `• Celular: ${datos.celular}\n` +
        `• Fecha y Hora: ${new Date(datos.fechaRegistro).toLocaleString('es-PE')}\n` +
        `• Código de Operación: ${datos.idOperacion}\n\n` +
        `${config.piePagina}`,
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        this.logger.log(`✓ Constancia de actualización enviada a ${datos.email} (MessageId: ${info.messageId})`);
        return true;
      } catch (err: any) {
        this.logger.error(`Error al enviar correo vía SMTP a ${datos.email}: ${err.message}`);
        return false;
      }
    } else {
      this.logger.log(
        `[SIMULACIÓN ENVÍO EMAIL] Para: ${datos.email} | Asunto: ${subject}`,
      );
      return false;
    }
  }
}
