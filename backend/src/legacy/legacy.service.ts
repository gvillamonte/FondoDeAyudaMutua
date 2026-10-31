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
import {
  createLegacyPool,
  queryWithLegacyRetry,
  startLegacyKeepalive,
  closePoolSafely,
} from './legacy-sql.helper';

@Injectable()
export class LegacyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LegacyService.name);
  private pool: sql.ConnectionPool | null = null;
  private isConnected = false;
  private keepaliveTimer: NodeJS.Timeout | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // No bloquear el arranque del servidor: si LEGACY_DB esta caido o mal
    // configurado, app.listen() no se ejecutaria y el puerto 3001 nunca
    // estaria disponible. La conexion se intenta en segundo plano.
    void this.connect();
    this.keepaliveTimer = startLegacyKeepalive(
      () => this.pingLegacy(),
      (error) => this.logger.warn(`Ping legacy fallo (${error.message}); se reintentara en el proximo ciclo`),
    );
  }

  async onModuleDestroy() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    await this.disconnect();
  }

  /**
   * Ping periodico: evita que las conexiones del pool ODBC queden ociosas y
   * se cuelguen (primera consulta tras inactividad = `Query timeout expired`).
   */
  private async pingLegacy(): Promise<void> {
    if (!this.isConnected || !this.pool) return;
    try {
      await this.runQuery((request) => request.query('SELECT 1 AS ok'));
    } catch (error: any) {
      this.logger.warn(`Ping legacy fallo (${error.message}); reconectando pool`);
      try {
        await this.reconnect();
      } catch (e: any) {
        this.logger.error(`No se pudo reconectar el pool legacy (${e.message})`);
      }
    }
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
      await closePoolSafely(this.pool);
      this.isConnected = false;
      this.logger.log('Desconectado de SQL Server legacy');
    }
  }

  get databaseAvailable(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Garantiza un pool vivo antes de consultar. Si el pool cayo, lo recrea.
   */
  async ensureConnected(): Promise<boolean> {
    if (this.isConnected && this.pool) return true;
    try {
      await this.connect();
    } catch {
      // connect() ya loguea el error
    }
    return this.isConnected && this.pool !== null;
  }

  private async reconnect(): Promise<void> {
    const old = this.pool;
    this.pool = null;
    this.isConnected = false;
    await closePoolSafely(old);
    await this.connect();
  }

  /**
   * Ejecuta una consulta con un Request propio y reintento unico si el fallo
   * es reintentable (conexion colgada o timeout de consulta). LEGACY_DB es
   * solo lectura, por lo que reconectar y repetir la consulta es seguro.
   */
  async runQuery<T>(build: (request: sql.Request) => Promise<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      if (!this.pool) {
        throw new Error('LEGACY_DB no disponible');
      }
      return build(this.pool.request());
    };

    return queryWithLegacyRetry(
      execute,
      () => this.reconnect(),
      (error) => this.logger.warn(`Conexion legacy perdida, reintentando (${error.message})`),
    );
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
    const disponible = await this.ensureConnected();
    if (!disponible) {
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
      LEFT JOIN (
        SELECT nIdPersona, MAX(cDocumentoIdentidad) AS cDocumentoIdentidad
        FROM TDocumentoPersona
        GROUP BY nIdPersona
      ) doc ON p.nIdPersona = doc.nIdPersona
      WHERE ${whereClause}
      OPTION (MAX_GRANT_PERCENT = 1)
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
      LEFT JOIN (
        SELECT nIdPersona, MAX(cDocumentoIdentidad) AS cDocumentoIdentidad
        FROM TDocumentoPersona
        GROUP BY nIdPersona
      ) doc ON p.nIdPersona = doc.nIdPersona
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
      OPTION (MAX_GRANT_PERCENT = 1)
    `;

    this.enforceReadOnly(countQuery);
    this.enforceReadOnly(dataQuery);

    const bindSearch = (request: sql.Request) => {
      if (search) {
        request.input('searchExact', sql.VarChar(50), search);
        request.input('searchLike', sql.VarChar(200), `%${search}%`);
      }
      return request;
    };

    // Secuencial y con Request propio por consulta: el pool ODBC de Windows
    // no tolera bien consultas concurrentes y provoca cuelgues de ~90s.
    const countResult = await this.runQuery((request) =>
      bindSearch(request).query(countQuery),
    );
    const dataResult = await this.runQuery((request) =>
      bindSearch(request).query(dataQuery),
    );

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
    if (!(await this.ensureConnected())) {
      throw new NotFoundException('Base de datos no disponible');
    }

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
        pn.cConsValorSexo AS SEXO,
        pn.cConsValorEstadoCivil AS ESTADO_CIVIL_COD,
        COALESCE(ec.cConsdescripcion, '') AS ESTADO_CIVIL
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
      LEFT JOIN TConstante ec ON ec.nConsCod = 1021 AND (
        ec.cConsValor = pn.cConsValorEstadoCivil
        OR LTRIM(RTRIM(ec.cConsValor)) = LTRIM(RTRIM(pn.cConsValorEstadoCivil))
        OR (
          TRY_CAST(pn.cConsValorEstadoCivil AS INT) IS NOT NULL 
          AND TRY_CAST(ec.cConsValor AS INT) = TRY_CAST(pn.cConsValorEstadoCivil AS INT)
        )
      )
      WHERE CAST(c.nIdColegiado AS VARCHAR) = @id OR c.cCodigoCIP = @id
    `;

    this.enforceReadOnly(query);
    const result = await this.runQuery((request) => {
      request.input('id', sql.VarChar, String(id).trim());
      return request.query(query);
    });
    const colegiado = result.recordset[0];
    if (!colegiado) {
      throw new NotFoundException(`Colegiado con ID ${id} no encontrado`);
    }

    return colegiado;
  }

  async getColegiadoByNumero(numeroColegiatura: string) {
    if (!(await this.ensureConnected())) {
      throw new NotFoundException('Base de datos no disponible');
    }

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
        COALESCE(p.cReferenciaDireccion, '') AS REFERENCIA,
        p.cCodUbigeoDepartamentoResidencia AS COD_DEPARTAMENTO,
        p.cCodUbigeoProvinciaResidencia AS COD_PROVINCIA,
        p.cCodUbigeoDistritoResidencia AS COD_DISTRITO,
        COALESCE(u.cDepartamento, '') AS DEPARTAMENTO,
        COALESCE(u.cProvincia, '') AS PROVINCIA,
        COALESCE(u.cDistrito, '') AS DISTRITO,
        pn.cConsValorEstadoCivil AS ESTADO_CIVIL_COD,
        COALESCE(ec.cConsdescripcion, '') AS ESTADO_CIVIL,
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
      LEFT JOIN TUbigeo u ON 
        p.cCodUbigeoDepartamentoResidencia = u.cDepCod 
        AND p.cCodUbigeoProvinciaResidencia = u.cProcod 
        AND p.cCodUbigeoDistritoResidencia = u.cDiscod
      LEFT JOIN TConstante ec ON ec.nConsCod = 1021 AND (
        ec.cConsValor = pn.cConsValorEstadoCivil
        OR LTRIM(RTRIM(ec.cConsValor)) = LTRIM(RTRIM(pn.cConsValorEstadoCivil))
        OR (
          TRY_CAST(pn.cConsValorEstadoCivil AS INT) IS NOT NULL 
          AND TRY_CAST(ec.cConsValor AS INT) = TRY_CAST(pn.cConsValorEstadoCivil AS INT)
        )
      )
      WHERE c.cCodigoCIP = @numero
    `;

    this.enforceReadOnly(query);
    const result = await this.runQuery((request) => {
      request.input('numero', sql.VarChar, numeroColegiatura.trim());
      return request.query(query);
    });
    const colegiado = result.recordset[0];
    if (!colegiado) {
      throw new NotFoundException(`Colegiado con N° Colegiatura ${numeroColegiatura} no encontrado`);
    }

    return colegiado;
  }

  async getColegiadoByCipAndDni(cip: string, dni: string) {
    if (!(await this.ensureConnected())) {
      throw new NotFoundException('Base de datos no disponible');
    }

    const cipRaw = (cip || '').trim();
    const dniRaw = (dni || '').trim();
    const cipNum = cipRaw.replace(/^0+/, '');
    const cipPadded = cipNum.padStart(6, '0');

    const query = `
      SELECT TOP 1
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
        COALESCE(p.cReferenciaDireccion, '') AS REFERENCIA,
        p.cCodUbigeoDepartamentoResidencia AS COD_DEPARTAMENTO,
        p.cCodUbigeoProvinciaResidencia AS COD_PROVINCIA,
        p.cCodUbigeoDistritoResidencia AS COD_DISTRITO,
        COALESCE(u.cDepartamento, '') AS DEPARTAMENTO,
        COALESCE(u.cProvincia, '') AS PROVINCIA,
        COALESCE(u.cDistrito, '') AS DISTRITO,
        pn.cConsValorEstadoCivil AS ESTADO_CIVIL_COD,
        COALESCE(ec.cConsdescripcion, '') AS ESTADO_CIVIL,
        cc.dFechaIncorporacionACIP AS FECHA_INGRESO,
        p.dFechaNacCreacion AS FECHA_NACIMIENTO,
        pn.cConsValorSexo AS SEXO
      FROM TColegiado c
      INNER JOIN TPersona p ON c.nIdPersona = p.nIdPersona
      LEFT JOIN (
        SELECT nIdPersona, MAX(cDocumentoIdentidad) AS cDocumentoIdentidad
        FROM TDocumentoPersona
        GROUP BY nIdPersona
      ) doc ON p.nIdPersona = doc.nIdPersona
      LEFT JOIN (
        SELECT nIdColegiado, MAX(nIdCapitulo) AS nIdCapitulo, MAX(dFechaIncorporacionACIP) AS dFechaIncorporacionACIP
        FROM TColegiadoCapitulo
        GROUP BY nIdColegiado
      ) cc ON c.nIdColegiado = cc.nIdColegiado
      LEFT JOIN TCapitulo cap ON cc.nIdCapitulo = cap.nIdCapitulo
      LEFT JOIN TPersonaNatural pn ON p.nIdPersona = pn.nIdPersona
      LEFT JOIN TUbigeo u ON 
        p.cCodUbigeoDepartamentoResidencia = u.cDepCod 
        AND p.cCodUbigeoProvinciaResidencia = u.cProcod 
        AND p.cCodUbigeoDistritoResidencia = u.cDiscod
      LEFT JOIN TConstante ec ON ec.nConsCod = 1021 AND (
        ec.cConsValor = pn.cConsValorEstadoCivil
        OR LTRIM(RTRIM(ec.cConsValor)) = LTRIM(RTRIM(pn.cConsValorEstadoCivil))
        OR (
          TRY_CAST(pn.cConsValorEstadoCivil AS INT) IS NOT NULL 
          AND TRY_CAST(ec.cConsValor AS INT) = TRY_CAST(pn.cConsValorEstadoCivil AS INT)
        )
      )
      WHERE (c.cCodigoCIP = @cip OR c.cCodigoCIP = @cipPadded OR c.cCodigoCIP = @cipNum)
        AND doc.cDocumentoIdentidad = @dni
    `;

    this.enforceReadOnly(query);
    const result = await this.runQuery((request) => {
      request.input('cip', sql.VarChar, cipRaw);
      request.input('cipPadded', sql.VarChar, cipPadded);
      request.input('cipNum', sql.VarChar, cipNum);
      request.input('dni', sql.VarChar, dniRaw);
      return request.query(query);
    });

    const colegiado = result.recordset[0];
    if (!colegiado) {
      throw new NotFoundException(`No se encontró ningún colegiado con CIP ${cipRaw} y DNI ${dniRaw}`);
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
    this.enforceReadOnly(query);
    const disponible = await this.ensureConnected();
    if (!disponible) {
      return [];
    }
    const result = await this.runQuery((request) => {
      for (const input of inputs) {
        request.input(input.name, input.type, input.value);
      }
      return request.query(query);
    });
    return (result.recordset || []) as T[];
  }

  /**
   * Obtiene el catálogo completo de TUbigeo (departamento, provincia, distrito)
   */
  async getUbigeosCatalog() {
    if (!(await this.ensureConnected())) {
      return [];
    }
    const query = `
      SELECT 
        cDepCod AS depCod,
        cProcod AS proCod,
        cDiscod AS disCod,
        RTRIM(cDepartamento) AS departamento,
        RTRIM(cProvincia) AS provincia,
        RTRIM(cDistrito) AS distrito
      FROM TUbigeo
      ORDER BY cDepartamento, cProvincia, cDistrito
    `;
    this.enforceReadOnly(query);
    const res = await this.runQuery((req) => req.query(query));
    return res.recordset || [];
  }

  /**
   * Actualiza los datos de contacto y filiación del colegiado directamente
   * en las tablas maestras de DBCIPCusco (TPersona y TPersonaNatural).
   * EXCEPCIÓN CONTROLADA: Exclusivamente invocada por el módulo de Actualización de Datos.
   */
  async actualizarDatosColegiado(
    cip: string,
    datos: {
      email?: string;
      celular?: string;
      fechaNacimiento?: string | null;
      sexo?: string | null;
      direccion?: string | null;
      referencia?: string | null;
      departamento?: string | null;
      provincia?: string | null;
      distrito?: string | null;
      estadoCivil?: string | null;
    },
  ) {
    const disponible = await this.ensureConnected();
    if (!disponible) {
      throw new Error('Base de datos legado no disponible para actualizar');
    }

    const cipNormalized = String(cip).trim();
    const colegiadoResult = await this.runQuery((request) =>
      request
        .input('cip', sql.VarChar(50), cipNormalized)
        .input('cipPadded', sql.VarChar(50), cipNormalized.padStart(6, '0'))
        .query(`
          SELECT TOP 1 c.nIdColegiado, c.nIdPersona
          FROM TColegiado c
          WHERE c.cCodigoCIP = @cip OR c.cCodigoCIP = @cipPadded
        `),
    );

    const colegiado = colegiadoResult.recordset?.[0];
    if (!colegiado || !colegiado.nIdPersona) {
      throw new NotFoundException(`Colegiado con CIP ${cip} no encontrado en base de datos`);
    }

    const nIdPersona = Number(colegiado.nIdPersona);
    const updatedFields: string[] = [];

    // Normalizar sexo para TPersonaNatural ('1' = Masculino, '2' = Femenino)
    let sexoCodigo: string | null = null;
    if (datos.sexo) {
      const s = String(datos.sexo).toUpperCase().trim();
      if (s === '1' || s.startsWith('M')) sexoCodigo = '1';
      else if (s === '2' || s.startsWith('F')) sexoCodigo = '2';
    }

    // Normalizar estado civil para TPersonaNatural ('1'=Soltero, '2'=Casado, '3'=Viudo, '4'=Divorciado, '5'=Conviviente)
    let estadoCivilCodigo: string | null = null;
    if (datos.estadoCivil) {
      const ec = String(datos.estadoCivil).toUpperCase().trim();
      if (['1', '2', '3', '4', '5'].includes(ec)) estadoCivilCodigo = ec;
      else if (ec === '01' || ec === 'S' || ec.startsWith('SOL')) estadoCivilCodigo = '1';
      else if (ec === '02' || ec === 'C' || ec.startsWith('CAS')) estadoCivilCodigo = '2';
      else if (ec === '03' || ec === 'V' || ec.startsWith('VIU')) estadoCivilCodigo = '3';
      else if (ec === '04' || ec === 'D' || ec.startsWith('DIV')) estadoCivilCodigo = '4';
      else if (ec === '05' || ec.startsWith('CONV') || ec.includes('UNION')) estadoCivilCodigo = '5';
    }

    // Resolver códigos de ubigeo si se proporcionaron departamento y distrito
    let ubigeoCodigos: { depCod: string; proCod: string; disCod: string } | null = null;
    if (datos.departamento && datos.distrito) {
      try {
        const ubigeoRes = await this.runQuery((request) =>
          request
            .input('dep', sql.VarChar(60), datos.departamento!.trim())
            .input('prov', sql.VarChar(60), (datos.provincia || '').trim())
            .input('dist', sql.VarChar(60), datos.distrito!.trim())
            .query(`
              SELECT TOP 1 cDepCod AS depCod, cProcod AS proCod, cDiscod AS disCod
              FROM TUbigeo
              WHERE (cDepartamento = @dep OR cDepCod = @dep)
                AND (cProvincia = @prov OR cProcod = @prov OR @prov = '')
                AND (cDistrito = @dist OR cDiscod = @dist)
            `),
        );
        if (ubigeoRes.recordset?.[0]) {
          ubigeoCodigos = ubigeoRes.recordset[0];
        }
      } catch (err: any) {
        this.logger.warn(`No se pudo resolver códigos de ubigeo: ${err.message}`);
      }
    }

    // Actualizar TPersona (email, celular, fechaNacimiento, direccion, referencia, ubigeos)
    await this.runQuery(async (request) => {
      request.input('nIdPersona', sql.Int, nIdPersona);

      const setClauses: string[] = [];

      if (datos.email !== undefined && datos.email !== null && datos.email.trim() !== '') {
        request.input('email', sql.VarChar(100), datos.email.trim());
        setClauses.push('cCorreoElectronico1 = @email');
        updatedFields.push('cCorreoElectronico1');
      }

      if (datos.celular !== undefined && datos.celular !== null && datos.celular.trim() !== '') {
        request.input('celular', sql.VarChar(15), datos.celular.trim().replace(/\D/g, ''));
        setClauses.push('cNroCelular1 = @celular');
        updatedFields.push('cNroCelular1');
      }

      if (datos.fechaNacimiento && datos.fechaNacimiento.trim() !== '') {
        try {
          const f = datos.fechaNacimiento.trim().slice(0, 10);
          const parsedDate = new Date(`${f}T00:00:00`);
          if (!isNaN(parsedDate.getTime())) {
            request.input('fechaNac', sql.DateTime, parsedDate);
            setClauses.push('dFechaNacCreacion = @fechaNac');
            updatedFields.push('dFechaNacCreacion');
          }
        } catch {}
      }

      if (datos.direccion !== undefined && datos.direccion !== null && datos.direccion.trim() !== '') {
        request.input('direccion', sql.VarChar(200), datos.direccion.trim().slice(0, 200));
        setClauses.push('cDireccion = @direccion');
        updatedFields.push('cDireccion');
      }

      if (datos.referencia !== undefined && datos.referencia !== null && datos.referencia.trim() !== '') {
        request.input('referencia', sql.VarChar(200), datos.referencia.trim().slice(0, 200));
        setClauses.push('cReferenciaDireccion = @referencia');
        updatedFields.push('cReferenciaDireccion');
      }

      if (ubigeoCodigos) {
        request.input('depCod', sql.VarChar(4), ubigeoCodigos.depCod);
        request.input('proCod', sql.VarChar(4), ubigeoCodigos.proCod);
        request.input('disCod', sql.VarChar(4), ubigeoCodigos.disCod);
        setClauses.push('cCodUbigeoDepartamentoResidencia = @depCod');
        setClauses.push('cCodUbigeoProvinciaResidencia = @proCod');
        setClauses.push('cCodUbigeoDistritoResidencia = @disCod');
        updatedFields.push('cCodUbigeoDepartamentoResidencia', 'cCodUbigeoProvinciaResidencia', 'cCodUbigeoDistritoResidencia');
      }

      if (setClauses.length > 0) {
        const updateSql = `
          UPDATE TPersona
          SET ${setClauses.join(', ')}
          WHERE nIdPersona = @nIdPersona
        `;
        await request.query(updateSql);
      }
    });

    // Actualizar TPersonaNatural (sexo, estado civil)
    if (sexoCodigo || estadoCivilCodigo) {
      await this.runQuery((request) => {
        request.input('nIdPersona', sql.Int, nIdPersona);
        const setPnClauses: string[] = [];
        const insertCols: string[] = ['nIdPersona'];
        const insertVals: string[] = ['@nIdPersona'];

        if (sexoCodigo) {
          request.input('sexo', sql.VarChar(20), sexoCodigo);
          setPnClauses.push('cConsValorSexo = @sexo');
          insertCols.push('cConsValorSexo');
          insertVals.push('@sexo');
          updatedFields.push('cConsValorSexo');
        }

        if (estadoCivilCodigo) {
          request.input('estadoCivil', sql.VarChar(20), estadoCivilCodigo);
          setPnClauses.push('cConsValorEstadoCivil = @estadoCivil');
          insertCols.push('cConsValorEstadoCivil');
          insertVals.push('@estadoCivil');
          updatedFields.push('cConsValorEstadoCivil');
        }

        return request.query(`
          IF EXISTS (SELECT 1 FROM TPersonaNatural WHERE nIdPersona = @nIdPersona)
          BEGIN
            UPDATE TPersonaNatural
            SET ${setPnClauses.join(', ')}
            WHERE nIdPersona = @nIdPersona;
          END
          ELSE
          BEGIN
            INSERT INTO TPersonaNatural (${insertCols.join(', ')})
            VALUES (${insertVals.join(', ')});
          END
        `);
      });
    }

    this.logger.log(
      `[ACTUALIZACION DATOS] Actualizado en DBCIPCusco para nIdPersona ${nIdPersona} (CIP ${cip}): ${updatedFields.join(', ')}`,
    );

    return {
      nIdPersona,
      updatedFields,
    };
  }
}

