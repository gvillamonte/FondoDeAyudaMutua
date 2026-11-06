import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

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
   * Envía la constancia oficial de actualización de datos al correo registrado del colegiado.
   */
  async enviarConstanciaActualizacion(datos: DatosActualizadosEmailParams): Promise<boolean> {
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
      const m = f.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return m ? `${m[3]}/${m[2]}/${m[1]}` : f;
    };
    const fechaIngresoTxt = formatearFecha(fechaIngreso);
    const fechaUltimoPagoTxt = formatearFecha(fechaUltimoPago);

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

    const sexoTexto = sexo === 'M' ? 'Masculino' : sexo === 'F' ? 'Femenino' : (sexo || 'No especificado');

    // Logo institucional
    const logo = await this.obtenerLogoCip();
    const attachments: any[] = [];
    let logoHtml = '';

    if (logo) {
      attachments.push({
        filename: logo.filename,
        content: logo.buffer,
        cid: 'logo_cip',
      });
      logoHtml = `
        <div style="margin-bottom: 12px;">
          <img src="cid:logo_cip" alt="Logo CIP" style="max-height: 75px; max-width: 180px; height: auto; display: inline-block;" />
        </div>
      `;
    } else {
      logoHtml = `
        <div style="display: inline-block; background-color: #FFFFFF; color: #781622; font-weight: bold; font-size: 14px; padding: 6px 14px; border-radius: 6px; letter-spacing: 1px; margin-bottom: 12px;">
          CIP
        </div>
      `;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Constancia de Actualización de Datos</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8FAFC; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Encabezado Institucional: Rojo Granate #781622 con Logo -->
          <tr>
            <td style="background-color: #781622; padding: 28px 30px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    ${logoHtml}
                    <h1 style="color: #FFFFFF; margin: 0; font-size: 20px; font-weight: 700; line-height: 1.3;">
                      COLEGIO DE INGENIEROS DEL PERÚ
                    </h1>
                    <p style="color: #FEE2E2; margin: 4px 0 0 0; font-size: 13px;">
                      Consejo Departamental Cusco — Fondo de Ayuda Mutua
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
              <p style="font-size: 15px; margin: 0 0 16px 0; line-height: 1.5; color: #1E293B;">
                Estimado(a) Ing. <strong>${nombres}</strong>,
              </p>
              <p style="font-size: 13px; margin: 0 0 24px 0; line-height: 1.6; color: #64748B;">
                Le confirmamos que sus datos de contacto, residencia y filiación han sido actualizados satisfactoriamente en el padrón del Colegio de Ingenieros del Perú. A continuación, se detalla el resumen de la información registrada:
              </p>

              <!-- Tabla de Datos -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; width: 38%; background-color: #F8FAFC;">N° de CIP</td>
                  <td style="padding: 10px 12px; color: #1E293B; font-weight: bold; font-family: monospace; font-size: 14px;">${cip}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">DNI</td>
                  <td style="padding: 10px 12px; color: #1E293B; font-weight: bold; font-family: monospace;">${dni}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Colegiado</td>
                  <td style="padding: 10px 12px; color: #1E293B; font-weight: 600;">${nombres}</td>
                </tr>
                ${fechaIngresoTxt ? `
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Fecha de Colegiatura</td>
                  <td style="padding: 10px 12px; color: #1E293B; font-weight: 600;">${fechaIngresoTxt}</td>
                </tr>` : ''}
                ${fechaUltimoPagoTxt ? `
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Fecha Último Pago</td>
                  <td style="padding: 10px 12px; color: #1E293B; font-weight: 600;">${fechaUltimoPagoTxt}</td>
                </tr>` : ''}
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Correo Electrónico</td>
                  <td style="padding: 10px 12px; color: #781622; font-weight: 600;">${email}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Número Celular</td>
                  <td style="padding: 10px 12px; color: #15803D; font-weight: bold; font-family: monospace;">${celular}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Fecha de Nacimiento</td>
                  <td style="padding: 10px 12px; color: #1E293B;">${fechaNacimiento || 'No especificada'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Sexo</td>
                  <td style="padding: 10px 12px; color: #1E293B;">${sexoTexto}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Estado Civil</td>
                  <td style="padding: 10px 12px; color: #1E293B; font-weight: 600;">${estadoCivil || 'No especificado'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Departamento</td>
                  <td style="padding: 10px 12px; color: #1E293B;">${departamento || 'No especificado'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Provincia</td>
                  <td style="padding: 10px 12px; color: #1E293B;">${provincia || 'No especificada'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Distrito</td>
                  <td style="padding: 10px 12px; color: #1E293B;">${distrito || 'No especificado'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Dirección Domiciliaria</td>
                  <td style="padding: 10px 12px; color: #1E293B;">${direccion || 'No especificada'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #F1F5F9;">
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Referencia de Dirección</td>
                  <td style="padding: 10px 12px; color: #1E293B;">${referencia || 'No especificada'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; color: #64748B; font-weight: 600; background-color: #F8FAFC;">Fecha y Hora de Registro</td>
                  <td style="padding: 10px 12px; color: #1E293B;">${fechaFormateada}</td>
                </tr>
              </table>

              <!-- Nota de Seguridad: Rojo Granate -->
              <div style="background-color: #FEF2F2; border-left: 4px solid #781622; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #991B1B; line-height: 1.5;">
                <strong>Aviso de Seguridad:</strong> Si usted no reconoció esta operación o detecta alguna inconsistencia, por favor comuníquese de inmediato con las oficinas del Colegio de Ingenieros del Perú.
              </div>

              <!-- Código de Operación -->
              <p style="margin: 20px 0 0 0; font-size: 11px; color: #94A3B8; text-align: center;">
                Código de Operación: <span style="font-family: monospace;">${idOperacion}</span>
              </p>
            </td>
          </tr>

          <!-- Footer Institucional -->
          <tr>
            <td style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 30px; text-align: center; font-size: 11px; color: #94A3B8; line-height: 1.5;">
              Colegio de Ingenieros del Perú — Consejo Departamental Cusco<br>
              Sistema de Gestión y Actualización de Datos de Colegiados<br>
              Este mensaje ha sido generado automáticamente, por favor no responda a esta dirección de correo.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') ||
      '"Colegio de Ingenieros del Perú" <notificaciones@cipcusco.org.pe>';

    const mailOptions: any = {
      from: fromAddress,
      to: email,
      subject: `Constancia de Actualización de Datos - CIP ${cip} (${nombres})`,
      html: htmlContent,
      text: `Estimado(a) Ing. ${nombres},\n\n` +
        `Le confirmamos que sus datos han sido actualizados satisfactoriamente en el padrón del Colegio de Ingenieros del Perú.\n\n` +
        `RESUMEN DE INFORMACIÓN REGISTRADA:\n` +
        `• N° de CIP: ${cip}\n` +
        `• DNI: ${dni}\n` +
        `• Colegiado: ${nombres}\n` +
        `• Correo Electrónico: ${email}\n` +
        `• Celular: ${celular}\n` +
        `• Fecha de Nacimiento: ${fechaNacimiento || 'No especificada'}\n` +
        `• Sexo: ${sexoTexto}\n` +
        `• Estado Civil: ${estadoCivil || 'No especificado'}\n` +
        `• Departamento: ${departamento || 'No especificado'}\n` +
        `• Provincia: ${provincia || 'No especificada'}\n` +
        `• Distrito: ${distrito || 'No especificado'}\n` +
        `• Dirección Domiciliaria: ${direccion || 'No especificada'}\n` +
        `• Referencia: ${referencia || 'No especificada'}\n` +
        `• Fecha y Hora: ${fechaFormateada}\n` +
        `• Código de Operación: ${idOperacion}\n\n` +
        `Colegio de Ingenieros del Perú — Consejo Departamental Cusco`,
    };

    if (attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        this.logger.log(`✓ Constancia de actualización enviada a ${email} (MessageId: ${info.messageId})`);
        return true;
      } catch (err: any) {
        this.logger.error(`Error al enviar correo vía SMTP a ${email}: ${err.message}`);
        return false;
      }
    } else {
      this.logger.log(
        `[SIMULACIÓN ENVÍO EMAIL] Para: ${email} | Asunto: Constancia Actualización CIP ${cip} (${nombres})`,
      );
      return false;
    }
  }
}
