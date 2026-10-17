import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { createLegacyPool } from './legacy-sql.helper';

@Injectable()
export class LegacyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LegacyService.name);
  private pool: sql.ConnectionPool | null = null;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // No bloquear el arranque del servidor: si LEGACY_DB esta caido o mal
    // configurado, app.listen() no se ejecutaria y el puerto 3001 nunca
    // estaria disponible. La conexion se intenta en segundo plano.
    void this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect() {
    try {
      const { pool, mode } = await createLegacyPool(this.configService);
      this.pool = pool;

      await this.pool.connect();
      this.isConnected = true;
      const server = this.configService.get<string>('LEGACY_DB_SERVER', 'localhost');
      const database = this.configService.get<string>('LEGACY_DB_NAME', 'DBCIPCusco');
      const authLabel = mode === 'sql' ? 'Autenticacion SQL' : 'Autenticacion de Windows';
      this.logger.log(`Conectado exitosamente a SQL Server (${database} en ${server}) con ${authLabel}`);
    } catch (error: any) {
      this.logger.error(`Error conectando a SQL Server legacy (${error.message})`, error.stack);
      this.isConnected = false;
    }
  }

  async disconnect() {
    if (this.pool && this.isConnected) {
      try {
        await this.pool.close();
      } catch {
        // Ignorar errores al cerrar
      }
      this.isConnected = false;
      this.logger.log('Desconectado de SQL Server legacy');
    }
  }

  get databaseAvailable(): boolean {
    return this.isConnected && this.pool !== null;
  }

  private enforceReadOnly(query: string) {
    const writeRegex = /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|MERGE|EXEC|EXECUTE)\b/i;
    if (writeRegex.test(query.trim())) {
      this.logger.error(`Intento de escritura bloqueado en LEGACY_DB: ${query.substring(0, 100)}`);
      throw new ForbiddenException('Operaciones de escritura estan estrictamente prohibidas en LEGACY_DB');
    }
  }

  async searchColegiados(params: {
    search?: string;
    page?: number;
    limit?: number;
    estado?: string;
  }) {
    if (!this.pool || !this.isConnected) {
      return { data: [], total: 0, page: params.page || 1, limit: params.limit || 25, totalPages: 0 };
    }

    const search = (params.search || '').trim();
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 25));
    const offset = (page - 1) * limit;

    let whereClause = '1=1';

    if (search) {
      whereClause += ` AND (
        c.cCodigoCIP = @searchExact OR
        c.cCodigoCIP LIKE @searchLike OR
        doc.cDocumentoIdentidad = @searchExact OR
        doc.cDocumentoIdentidad LIKE @searchLike OR
        p.cNombres LIKE @searchLike OR
        p.cApPaterno LIKE @searchLike OR
        p.cApMaterno LIKE @searchLike OR
        (p.cApPaterno + ' ' + COALESCE(p.cApMaterno, '') + ' ' + p.cNombres) LIKE @searchLike OR
        (p.cNombres + ' ' + p.cApPaterno + ' ' + COALESCE(p.cApMaterno, '')) LIKE @searchLike
      )`;
    }

    if (params.estado) {
      if (params.estado === 'HABILITADO') {
        whereClause += ' AND c.bHabilitado = 1';
      } else if (params.estado === 'NO HABILITADO') {
        whereClause += ' AND (c.bHabilitado = 0 OR c.bHabilitado IS NULL)';
      }
    }

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM TColegiado c
      INNER JOIN TPersona p ON c.nIdPersona = p.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON p.nIdPersona = doc.nIdPersona
      WHERE ${whereClause}
    `;

    const dataQuery = `
      SELECT
        c.nIdColegiado AS COLEGIADO_ID,
        c.cCodigoCIP AS NUM_COLEGIATURA,
        COALESCE(doc.cDocumentoIdentidad, '') AS DNI,
        p.cNombres AS NOMBRES,
        p.cApPaterno AS APELLIDO_PATERNO,
        COALESCE(p.cApMaterno, '') AS APELLIDO_MATERNO,
        CASE WHEN c.bHabilitado = 1 THEN 'HABILITADO' ELSE 'NO HABILITADO' END AS ESTADO_COLEGIATURA,
        COALESCE(c.bHabilitado, 0) AS HABILITADO,
        c.dFechaUltimoPago AS FECHA_ULTIMO_PAGO,
        c.dFechaHabilitado AS FECHA_HABILITADO,
        COALESCE(cap.cNombreCap, '') AS ESPECIALIDAD,
        COALESCE(p.cNroCelular1, p.cTelefonoFijo, '') AS TELEFONO,
        COALESCE(p.cCorreoElectronico1, '') AS EMAIL,
        COALESCE(p.cDireccion, '') AS DIRECCION,
        cc.dFechaIncorporacionACIP AS FECHA_INGRESO,
        p.dFechaNacCreacion AS FECHA_NACIMIENTO,
        pn.cConsValorSexo AS SEXO
      FROM TColegiado c
      INNER JOIN TPersona p ON c.nIdPersona = p.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON p.nIdPersona = doc.nIdPersona
      LEFT JOIN (
        SELECT nIdColegiado, MAX(nIdCapitulo) AS nIdCapitulo, MAX(dFechaIncorporacionACIP) AS dFechaIncorporacionACIP
        FROM TColegiadoCapitulo
        GROUP BY nIdColegiado
      ) cc ON c.nIdColegiado = cc.nIdColegiado
      LEFT JOIN TCapitulo cap ON cc.nIdCapitulo = cap.nIdCapitulo
      LEFT JOIN TPersonaNatural pn ON p.nIdPersona = pn.nIdPersona
      WHERE ${whereClause}
      ORDER BY 
        CASE WHEN c.cCodigoCIP IS NOT NULL AND c.cCodigoCIP <> '' THEN 0 ELSE 1 END,
        p.cApPaterno ASC, p.cNombres ASC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    this.enforceReadOnly(countQuery);
    this.enforceReadOnly(dataQuery);

    const countRequest = this.pool.request();
    if (search) {
      countRequest.input('searchExact', sql.VarChar, search);
      countRequest.input('searchLike', sql.VarChar, `%${search}%`);
    }

    const dataRequest = this.pool.request();
    if (search) {
      dataRequest.input('searchExact', sql.VarChar, search);
      dataRequest.input('searchLike', sql.VarChar, `%${search}%`);
    }

    const [countResult, dataResult] = await Promise.all([
      countRequest.query(countQuery),
      dataRequest.query(dataQuery),
    ]);

    const total = Number(countResult.recordset[0]?.total || 0);

    return {
      data: dataResult.recordset,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getColegiadoById(id: string | number) {
    if (!this.pool || !this.isConnected) {
      throw new NotFoundException('Base de datos no disponible');
    }

    const request = this.pool.request();
    request.input('id', sql.VarChar, String(id).trim());

    const query = `
      SELECT
        c.nIdColegiado AS COLEGIADO_ID,
        c.cCodigoCIP AS NUM_COLEGIATURA,
        COALESCE(doc.cDocumentoIdentidad, '') AS DNI,
        p.cNombres AS NOMBRES,
        p.cApPaterno AS APELLIDO_PATERNO,
        COALESCE(p.cApMaterno, '') AS APELLIDO_MATERNO,
        CASE WHEN c.bHabilitado = 1 THEN 'HABILITADO' ELSE 'NO HABILITADO' END AS ESTADO_COLEGIATURA,
        COALESCE(c.bHabilitado, 0) AS HABILITADO,
        c.dFechaUltimoPago AS FECHA_ULTIMO_PAGO,
        c.dFechaHabilitado AS FECHA_HABILITADO,
        COALESCE(cap.cNombreCap, '') AS ESPECIALIDAD,
        COALESCE(p.cNroCelular1, p.cTelefonoFijo, '') AS TELEFONO,
        COALESCE(p.cCorreoElectronico1, '') AS EMAIL,
        COALESCE(p.cDireccion, '') AS DIRECCION,
        cc.dFechaIncorporacionACIP AS FECHA_INGRESO,
        p.dFechaNacCreacion AS FECHA_NACIMIENTO,
        pn.cConsValorSexo AS SEXO
      FROM TColegiado c
      INNER JOIN TPersona p ON c.nIdPersona = p.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON p.nIdPersona = doc.nIdPersona
      LEFT JOIN (
        SELECT nIdColegiado, MAX(nIdCapitulo) AS nIdCapitulo, MAX(dFechaIncorporacionACIP) AS dFechaIncorporacionACIP
        FROM TColegiadoCapitulo
        GROUP BY nIdColegiado
      ) cc ON c.nIdColegiado = cc.nIdColegiado
      LEFT JOIN TCapitulo cap ON cc.nIdCapitulo = cap.nIdCapitulo
      LEFT JOIN TPersonaNatural pn ON p.nIdPersona = pn.nIdPersona
      WHERE CAST(c.nIdColegiado AS VARCHAR) = @id OR c.cCodigoCIP = @id
    `;

    this.enforceReadOnly(query);
    const result = await request.query(query);
    const colegiado = result.recordset[0];
    if (!colegiado) {
      throw new NotFoundException(`Colegiado con ID ${id} no encontrado`);
    }

    return colegiado;
  }

  async getColegiadoByNumero(numeroColegiatura: string) {
    if (!this.pool || !this.isConnected) {
      throw new NotFoundException('Base de datos no disponible');
    }

    const request = this.pool.request();
    request.input('numero', sql.VarChar, numeroColegiatura.trim());

    const query = `
      SELECT
        c.nIdColegiado AS COLEGIADO_ID,
        c.cCodigoCIP AS NUM_COLEGIATURA,
        COALESCE(doc.cDocumentoIdentidad, '') AS DNI,
        p.cNombres AS NOMBRES,
        p.cApPaterno AS APELLIDO_PATERNO,
        COALESCE(p.cApMaterno, '') AS APELLIDO_MATERNO,
        CASE WHEN c.bHabilitado = 1 THEN 'HABILITADO' ELSE 'NO HABILITADO' END AS ESTADO_COLEGIATURA,
        COALESCE(c.bHabilitado, 0) AS HABILITADO,
        c.dFechaUltimoPago AS FECHA_ULTIMO_PAGO,
        c.dFechaHabilitado AS FECHA_HABILITADO,
        COALESCE(cap.cNombreCap, '') AS ESPECIALIDAD,
        COALESCE(p.cNroCelular1, p.cTelefonoFijo, '') AS TELEFONO,
        COALESCE(p.cCorreoElectronico1, '') AS EMAIL,
        COALESCE(p.cDireccion, '') AS DIRECCION,
        cc.dFechaIncorporacionACIP AS FECHA_INGRESO,
        p.dFechaNacCreacion AS FECHA_NACIMIENTO,
        pn.cConsValorSexo AS SEXO
      FROM TColegiado c
      INNER JOIN TPersona p ON c.nIdPersona = p.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON p.nIdPersona = doc.nIdPersona
      LEFT JOIN (
        SELECT nIdColegiado, MAX(nIdCapitulo) AS nIdCapitulo, MAX(dFechaIncorporacionACIP) AS dFechaIncorporacionACIP
        FROM TColegiadoCapitulo
        GROUP BY nIdColegiado
      ) cc ON c.nIdColegiado = cc.nIdColegiado
      LEFT JOIN TCapitulo cap ON cc.nIdCapitulo = cap.nIdCapitulo
      LEFT JOIN TPersonaNatural pn ON p.nIdPersona = pn.nIdPersona
      WHERE c.cCodigoCIP = @numero
    `;

    this.enforceReadOnly(query);
    const result = await request.query(query);
    const colegiado = result.recordset[0];
    if (!colegiado) {
      throw new NotFoundException(`Colegiado con N° Colegiatura ${numeroColegiatura} no encontrado`);
    }

    return colegiado;
  }

  async getTableColumns(tableName: string) {
    if (!this.pool || !this.isConnected) {
      return { error: 'DB no disponible' };
    }
    const allowedTables = ['TColegiadoHistorialPagos', 'TVenta', 'TVentaDetalle', 'TVentaItem', 'TVentaConcepto', 'TVentaDesglose', 'TCuotaConcepto', 'TCuotaMonto', 'TVentaCuota', 'TVentaDetalleConcepto', 'TColegiadoHistorialPagosDetalle', 'TColegiadoCuota'];
    if (!allowedTables.includes(tableName)) {
      return { error: `Tabla no permitida. Permitidas: ${allowedTables.join(', ')}` };
    }
    const request = this.pool.request();
    const result = await request.query(`
      SELECT TOP 1 *
      FROM [${tableName}]
    `);
    if (result.recordset.length === 0) {
      return { columns: [], rows: [], message: 'Tabla vacía' };
    }
    return {
      columns: Object.keys(result.recordset[0]),
      sampleRow: result.recordset[0],
      totalColumns: Object.keys(result.recordset[0]).length,
    };
  }

  async debugSearchColumns(keyword: string) {
    if (!this.pool || !this.isConnected) {
      return { error: 'DB no disponible' };
    }
    const request = this.pool.request();
    request.input('keyword', sql.VarChar, `%${keyword}%`);
    const result = await request.query(`
      SELECT
        t.name AS TableName,
        c.name AS ColumnName,
        ty.name AS DataType,
        c.max_length
      FROM sys.columns c
      INNER JOIN sys.tables t ON c.object_id = t.object_id
      INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
      WHERE c.name LIKE @keyword
      ORDER BY t.name, c.name
    `);
    return result.recordset;
  }

  async getCuotasColegiado(colegiadoId: string | number) {
    if (!this.pool || !this.isConnected) {
      return [];
    }

    const request = this.pool.request();
    request.input('colegiadoId', sql.VarChar, String(colegiadoId).trim());

    const query = `
      SELECT
        hp.nId AS CUOTA_ID,
        hp.nIdColegiado AS COLEGIADO_ID,
        YEAR(COALESCE(v.dFechaVenta, hp.dFechaUltimoPago, hp.dFechaHabilitado)) AS ANIO,
        MONTH(COALESCE(v.dFechaVenta, hp.dFechaUltimoPago, hp.dFechaHabilitado)) AS MES,
        COALESCE(v.nTotalImporteVenta, 0) AS MONTO,
        CASE WHEN hp.bHabilitado = 1 THEN 'PAGADO' ELSE 'PENDIENTE' END AS ESTADO_PAGO,
        hp.dFechaHabilitado AS FECHA_VENCIMIENTO,
        v.dFechaVenta AS FECHA_PAGO,
        (COALESCE(v.cNroSerie, '') + '-' + COALESCE(v.cNroCorrelativo, '')) AS COMPROBANTE,
        hp.cObservacion AS OBSERVACIONES
      FROM TColegiadoHistorialPagos hp
      LEFT JOIN TVenta v ON hp.nIdVenta = v.nIdVenta
      WHERE CAST(hp.nIdColegiado AS VARCHAR) = @colegiadoId OR hp.cCodigoCIP = @colegiadoId
      ORDER BY hp.dFechaHabilitado DESC, hp.nId DESC
    `;

    this.enforceReadOnly(query);
    const result = await request.query(query);
    return result.recordset;
  }

  /**
   * Ejecuta una consulta SELECT arbitraria sobre LEGACY_DB.
   * Cada llamada crea su propio Request (nunca compartir Requests concurrentes).
   */
  async runReadOnlyQuery<T = any>(
    query: string,
    inputs: { name: string; type: any; value: any }[] = [],
  ): Promise<T[]> {
    if (!this.pool || !this.isConnected) {
      return [];
    }
    this.enforceReadOnly(query);
    const request = this.pool.request();
    for (const input of inputs) {
      request.input(input.name, input.type, input.value);
    }
    const result = await request.query(query);
    return (result.recordset || []) as T[];
  }
}

