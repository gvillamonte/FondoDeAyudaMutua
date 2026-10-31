import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';
import { PrismaClient } from '@prisma/client';
import {
  createLegacyPool,
  queryWithLegacyRetry,
  startLegacyKeepalive,
  closePoolSafely,
} from '../legacy/legacy-sql.helper';

@Injectable()
export class FamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FamService.name);
  private pool: sql.ConnectionPool | null = null;
  private isConnected = false;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private prisma: PrismaClient;

  private parentescosCache: { codigo: string; descripcion: string }[] = [];

  private readonly parentescoMap: Record<string, string> = {};

  private buildParentescoMap(list: { codigo: string; descripcion: string }[]) {
    for (const p of list) {
      this.parentescoMap[p.codigo] = p.descripcion;
    }
  }

  private readonly tipoAsociadoMap: Record<string, string> = {
    '1': 'Ordinario',
    '2': 'Vitalicio',
  };

  constructor(private configService: ConfigService) {
    this.prisma = new PrismaClient();
  }

  async onModuleInit() {
    // No bloquear el arranque del servidor: la conexion legacy se intenta
    // en segundo plano para que app.listen() no dependa de LEGACY_DB.
    void this.initLegacyPool();
    this.keepaliveTimer = startLegacyKeepalive(
      () => this.pingLegacy(),
      (error) => this.logger.warn(`Ping legacy fallo (${error.message}); se reintentara en el proximo ciclo`),
    );
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

  private async initLegacyPool() {
    try {
      const { pool, mode } = await createLegacyPool(this.configService);
      this.pool = pool;
      await this.pool.connect();
      this.isConnected = true;
      const authLabel = mode === 'sql' ? 'SQL' : 'Windows';
      this.logger.log(`FAM conectado a DBCIPCusco (auth: ${authLabel})`);
      await this.cargarParentescos();
    } catch (error: any) {
      this.logger.error(`FAM error conexion: ${error.message}`);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    if (this.pool && this.isConnected) {
      await closePoolSafely(this.pool);
    }
  }

  async cargarParentescos() {
    try {
      this.parentescosCache = await this.obtenerParentescosDesdeLegado();
      this.buildParentescoMap(this.parentescosCache);
      this.logger.log(`Parentescos cargados: ${this.parentescosCache.length}`);
    } catch (e: any) {
      this.logger.warn(`Error cargando parentescos: ${e.message}`);
      this.parentescosCache = [];
    }
  }

  async obtenerParentescosDesdeLegado(): Promise<{ codigo: string; descripcion: string }[]> {
    if (!this.pool || !this.isConnected) return [];
    const request = this.pool.request();
    const query = `
      SELECT cConsValor AS codigo, cConsdescripcion AS descripcion
      FROM TConstante
      WHERE nConsCod = 1110 AND bEstado = 1
        AND cConsValor <> CAST(nConsCod AS VARCHAR(20))
      ORDER BY cConsValor
    `;
    this.enforceReadOnly(query);
    const result = await request.query(query);
    return result.recordset.map((r: any) => ({ codigo: String(r.codigo), descripcion: r.descripcion }));
  }

  async crearPersonaEnLegado(data: {
    nombres: string;
    apPaterno: string;
    apMaterno: string;
    dni: string;
    sexo: 'M' | 'F';
    fechaNac?: string;
    celular?: string;
    email?: string;
    direccion?: string;
    parentescoCod: string;
  }): Promise<{ PERSONA_ID: string; NOMBRE_COMPLETO: string; DNI: string; COD_PARENTESCO: string }> {
    if (!this.pool || !this.isConnected) throw new BadRequestException('Base de datos legacy no disponible');

    if (!data.nombres?.trim()) throw new BadRequestException('Nombres son requeridos');
    if (!data.apPaterno?.trim()) throw new BadRequestException('Apellido Paterno es requerido');
    if (!data.apMaterno?.trim()) throw new BadRequestException('Apellido Materno es requerido');
    if (!data.dni?.trim() || data.dni.trim().length !== 8) throw new BadRequestException('DNI debe tener 8 dígitos');
    if (!data.parentescoCod?.trim()) throw new BadRequestException('Parentesco es requerido');

    const checkDni = this.pool.request();
    checkDni.input('dni', sql.VarChar, data.dni.trim());
    const dniExists = await checkDni.query(`SELECT 1 FROM TDocumentoPersona WHERE cDocumentoIdentidad = @dni`);
    if (dniExists.recordset.length > 0) throw new BadRequestException('El DNI ya existe en la base de datos');

    const checkPar = this.pool.request();
    checkPar.input('cod', sql.VarChar, data.parentescoCod.trim());
    const parExists = await checkPar.query(
      `SELECT 1 FROM TConstante WHERE nConsCod = 1110 AND cConsValor = @cod AND cConsValor <> CAST(nConsCod AS VARCHAR(20))`,
    );
    if (parExists.recordset.length === 0) throw new BadRequestException('Parentesco inválido');

    const transaction = new sql.Transaction(this.pool);
    await transaction.begin();

    try {
      const request = transaction.request();
      request.input('nombres', sql.VarChar, data.nombres.trim());
      request.input('apPaterno', sql.VarChar, data.apPaterno.trim());
      request.input('apMaterno', sql.VarChar, data.apMaterno.trim());
      request.input('dni', sql.VarChar, data.dni.trim());
      request.input('sexo', sql.Char, data.sexo);
      request.input('fechaNac', sql.DateTime, data.fechaNac ? new Date(data.fechaNac) : null);
      request.input('celular', sql.VarChar, data.celular?.trim() || null);
      request.input('email', sql.VarChar, data.email?.trim() || null);
      request.input('direccion', sql.VarChar, data.direccion?.trim() || null);

      const personaResult = await request.query(`
        INSERT INTO TPersona (cNombres, cApPaterno, cApMaterno, dFechaNacCreacion, cNroCelular1, cCorreoElectronico1, cDireccion)
        OUTPUT INSERTED.nIdPersona
        VALUES (@nombres, @apPaterno, @apMaterno, @fechaNac, @celular, @email, @direccion)
      `);
      const personaId = String(personaResult.recordset[0].nIdPersona);

      await request.query(`
        INSERT INTO TDocumentoPersona (nIdPersona, cDocumentoIdentidad, nIdTipoDocumento)
        VALUES (${personaId}, @dni, 1)
      `);

      await request.query(`
        INSERT INTO TPersonaNatural (nIdPersona, cConsValorSexo)
        VALUES (${personaId}, @sexo)
      `);

      await transaction.commit();

      const nombreCompleto = `${data.apPaterno} ${data.apMaterno} ${data.nombres}`.trim();
      return {
        PERSONA_ID: personaId,
        NOMBRE_COMPLETO: nombreCompleto,
        DNI: data.dni.trim(),
        COD_PARENTESCO: data.parentescoCod.trim(),
      };
    } catch (e: any) {
      try { await transaction.rollback(); } catch {}
      throw new BadRequestException(`Error al crear persona: ${e.message}`);
    }
  }

  private enforceReadOnly(query: string) {
    const writeRegex = /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|MERGE|EXEC|EXECUTE)\b/i;
    if (writeRegex.test(query.trim())) {
      throw new Error('Escritura prohibida en LEGACY_DB');
    }
  }

  /**
   * Garantiza un pool vivo antes de consultar. Si el pool cayo, lo recrea.
   */
  async ensureConnected(): Promise<boolean> {
    if (this.isConnected && this.pool) return true;
    try {
      await this.initLegacyPool();
    } catch {
      // initLegacyPool() ya loguea el error
    }
    return this.isConnected && this.pool !== null;
  }

  private async reconnect(): Promise<void> {
    const old = this.pool;
    this.pool = null;
    this.isConnected = false;
    await closePoolSafely(old);
    await this.initLegacyPool();
  }

  /**
   * Ejecuta una consulta con un Request propio y reintento unico si el fallo
   * es reintentable (conexion colgada o timeout de consulta). LEGACY_DB es
   * solo lectura, por lo que reconectar y repetir la consulta es seguro.
   */
  async runQuery<T>(build: (request: sql.Request) => Promise<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      if (!this.pool) {
        throw new BadRequestException('Base de datos legacy no disponible');
      }
      return build(this.pool.request());
    };

    return queryWithLegacyRetry(
      execute,
      () => this.reconnect(),
      (error) => this.logger.warn(`Conexion legacy perdida, reintentando (${error.message})`),
    );
  }

  async search(params: {
    search?: string;
    page?: number;
    limit?: number;
    estado?: string;
    conBeneficiarios?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 25));

    const disponible = await this.ensureConnected();
    if (!disponible) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const search = (params.search || '').trim();
    const offset = (page - 1) * limit;

    let whereClause = '1=1';

    if (search) {
      whereClause += ` AND (
        c.cCodigoCIP = @searchExact
        OR c.cCodigoCIP LIKE @search
        OR doc.cDocumentoIdentidad = @searchExact
        OR doc.cDocumentoIdentidad LIKE @search
        OR pc.cNombres LIKE @search
        OR pc.cApPaterno LIKE @search
        OR pc.cApMaterno LIKE @search
      )`;
    }

    if (params.estado === 'HABILITADO') {
      whereClause += ' AND c.bHabilitado = 1';
    } else if (params.estado === 'NO HABILITADO') {
      whereClause += ' AND (c.bHabilitado = 0 OR c.bHabilitado IS NULL)';
    }

    if (params.conBeneficiarios === 'SI') {
      whereClause += ' AND (SELECT COUNT(*) FROM TBeneficiarioColegiado bx WHERE bx.nIdColegiado = c.nIdColegiado AND bx.bActivo = 1) > 0';
    } else if (params.conBeneficiarios === 'NO') {
      whereClause += ' AND (SELECT COUNT(*) FROM TBeneficiarioColegiado bx WHERE bx.nIdColegiado = c.nIdColegiado AND bx.bActivo = 1) = 0';
    }

    const countQuery = `
      SELECT COUNT(DISTINCT c.nIdColegiado) AS total
      FROM TColegiado c
      INNER JOIN TPersona pc ON c.nIdPersona = pc.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON pc.nIdPersona = doc.nIdPersona
      WHERE ${whereClause}
    `;

    const dataQuery = `
      SELECT
        c.nIdColegiado AS COLEGIADO_ID,
        c.cCodigoCIP AS NUM_COLEGIATURA,
        COALESCE(doc.cDocumentoIdentidad, '') AS DNI,
        (pc.cApPaterno + ' ' + COALESCE(pc.cApMaterno, '') + ' ' + pc.cNombres) AS NOMBRE_COLEGIADO,
        CASE WHEN c.bHabilitado = 1 THEN 'HABILITADO' ELSE 'NO HABILITADO' END AS ESTADO,
        c.cConsValorTipoAsociado AS TIPO_ASOCIADO,
        COALESCE(c.cObservacion, '') AS OBSERVACION,
        c.dFechaRecepcionFAM AS FECHA_FAM,
        c.dFechaUltimoPago AS FECHA_ULTIMO_PAGO,
        cc.dFechaIncorporacionACIP AS FECHA_INGRESO,
        (SELECT COUNT(*) FROM TBeneficiarioColegiado bx WHERE bx.nIdColegiado = c.nIdColegiado AND bx.bActivo = 1) AS NUM_BENEFICIARIOS,
        (SELECT SUM(bx.nPorcentajeBeneficio) FROM TBeneficiarioColegiado bx WHERE bx.nIdColegiado = c.nIdColegiado AND bx.bActivo = 1) AS SUMA_PORCENTAJE
      FROM TColegiado c
      INNER JOIN TPersona pc ON c.nIdPersona = pc.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON pc.nIdPersona = doc.nIdPersona
      LEFT JOIN (
        SELECT nIdColegiado, MAX(dFechaIncorporacionACIP) AS dFechaIncorporacionACIP
        FROM TColegiadoCapitulo
        GROUP BY nIdColegiado
      ) cc ON c.nIdColegiado = cc.nIdColegiado
      WHERE ${whereClause}
      GROUP BY
        c.nIdColegiado, c.cCodigoCIP, doc.cDocumentoIdentidad,
        pc.cApPaterno, pc.cApMaterno, pc.cNombres,
        c.bHabilitado, c.cConsValorTipoAsociado, c.cObservacion, c.dFechaRecepcionFAM, c.dFechaUltimoPago, cc.dFechaIncorporacionACIP
      ORDER BY pc.cApPaterno, pc.cNombres
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    this.enforceReadOnly(countQuery);
    this.enforceReadOnly(dataQuery);

    const bindParams = (request: sql.Request) => {
      if (search) {
        request.input('search', sql.VarChar, `%${search}%`);
        request.input('searchExact', sql.VarChar, search);
      }
      request.input('offset', sql.Int, offset);
      request.input('limit', sql.Int, limit);
      return request;
    };

    // Secuencial y con Request propio por consulta: el pool ODBC de Windows
    // no tolera bien consultas concurrentes y provoca cuelgues de ~90s.
    const countResult = await this.runQuery((request) => bindParams(request).query(countQuery));
    const dataResult = await this.runQuery((request) => bindParams(request).query(dataQuery));

    const total = Number(countResult.recordset[0]?.total || 0);

    return {
      data: dataResult.recordset.map((r: any) => ({
        COLEGIADO_ID: String(r.COLEGIADO_ID),
        NUM_COLEGIATURA: r.NUM_COLEGIATURA,
        DNI: r.DNI,
        NOMBRE_COLEGIADO: r.NOMBRE_COLEGIADO,
        ESTADO: r.ESTADO,
        TIPO_ASOCIADO: this.tipoAsociadoMap[r.TIPO_ASOCIADO] || 'Sin definir',
        OBSERVACION: r.OBSERVACION || '',
        FECHA_FAM: r.FECHA_FAM,
        FECHA_ULTIMO_PAGO: r.FECHA_ULTIMO_PAGO,
        FECHA_INGRESO: r.FECHA_INGRESO,
        NUM_BENEFICIARIOS: Number(r.NUM_BENEFICIARIOS),
        SUMA_PORCENTAJE: Number(r.SUMA_PORCENTAJE),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async buscarColegiadosPorIds(ids: string[]): Promise<Map<string, { NUM_COLEGIATURA: string; DNI: string; NOMBRE_COLEGIADO: string; ESTADO: string; FECHA_ULTIMO_PAGO: string | null }>> {
    const mapa = new Map<string, { NUM_COLEGIATURA: string; DNI: string; NOMBRE_COLEGIADO: string; ESTADO: string; FECHA_ULTIMO_PAGO: string | null }>();
    if (!ids.length) return mapa;
    if (!(await this.ensureConnected())) return mapa;

    const unicos = [...new Set(ids.map((i) => String(i).trim()).filter(Boolean))].slice(0, 500);

    const placeholders = unicos.map((_, idx) => `@id${idx}`).join(', ');
    const query = `
      SELECT TOP ${unicos.length}
        c.nIdColegiado AS COLEGIADO_ID,
        c.cCodigoCIP AS NUM_COLEGIATURA,
        COALESCE(doc.cDocumentoIdentidad, '') AS DNI,
        (pc.cApPaterno + ' ' + COALESCE(pc.cApMaterno, '') + ' ' + pc.cNombres) AS NOMBRE_COLEGIADO,
        CASE WHEN c.bHabilitado = 1 THEN 'HABILITADO' ELSE 'NO HABILITADO' END AS ESTADO,
        c.dFechaUltimoPago AS FECHA_ULTIMO_PAGO
      FROM TColegiado c
      INNER JOIN TPersona pc ON c.nIdPersona = pc.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON pc.nIdPersona = doc.nIdPersona
      WHERE CAST(c.nIdColegiado AS VARCHAR) IN (${placeholders})
    `;

    this.enforceReadOnly(query);
    const result = await this.runQuery((request) => {
      unicos.forEach((id, idx) => request.input(`id${idx}`, sql.VarChar, id));
      return request.query(query);
    });
    result.recordset.forEach((r: any) => {
      mapa.set(String(r.COLEGIADO_ID), {
        NUM_COLEGIATURA: r.NUM_COLEGIATURA,
        DNI: r.DNI,
        NOMBRE_COLEGIADO: r.NOMBRE_COLEGIADO,
        ESTADO: r.ESTADO,
        FECHA_ULTIMO_PAGO: r.FECHA_ULTIMO_PAGO ? String(r.FECHA_ULTIMO_PAGO) : null,
      });
    });
    return mapa;
  }

  async buscarPersonas(term: string) {
    if (!term || term.trim().length < 2) return [];
    if (!(await this.ensureConnected())) return [];

    const query = `
      SELECT TOP 20
        p.nIdPersona AS PERSONA_ID,
        p.cNombres AS NOMBRES,
        p.cApPaterno AS APELLIDO_PATERNO,
        p.cApMaterno AS APELLIDO_MATERNO,
        (p.cApPaterno + ' ' + COALESCE(p.cApMaterno, '') + ' ' + p.cNombres) AS NOMBRE_COMPLETO,
        COALESCE(doc.cDocumentoIdentidad, '') AS DNI,
        c.nIdColegiado AS COLEGIADO_ID
      FROM TPersona p
      LEFT JOIN TColegiado c ON p.nIdPersona = c.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON p.nIdPersona = doc.nIdPersona
      WHERE
        p.cNombres LIKE @term
        OR p.cApPaterno LIKE @term
        OR p.cApMaterno LIKE @term
        OR doc.cDocumentoIdentidad LIKE @term
        OR (p.cApPaterno + ' ' + COALESCE(p.cApMaterno, '') + ' ' + p.cNombres) LIKE @term
      ORDER BY p.cApPaterno, p.cNombres
    `;

    this.enforceReadOnly(query);
    const result = await this.runQuery((request) => {
      request.input('term', sql.VarChar, `%${term.trim()}%`);
      return request.query(query);
    });

    return result.recordset.map((r: any) => ({
      PERSONA_ID: String(r.PERSONA_ID),
      NOMBRE_COMPLETO: r.NOMBRE_COMPLETO,
      DNI: r.DNI,
      NOMBRES: r.NOMBRES,
      APELLIDO_PATERNO: r.APELLIDO_PATERNO,
      APELLIDO_MATERNO: r.APELLIDO_MATERNO || '',
      COLEGIADO_ID: r.COLEGIADO_ID ? String(r.COLEGIADO_ID) : undefined,
    }));
  }

  async getColegiadoById(colegiadoId: string) {
    const mapa = await this.buscarColegiadosPorIds([colegiadoId]);
    const info = mapa.get(colegiadoId);
    if (!info) return null;
    const beneficiarios = await this.getBeneficiariosByColegiado(colegiadoId);
    return {
      COLEGIADO_ID: colegiadoId,
      NUM_COLEGIATURA: info.NUM_COLEGIATURA,
      DNI: info.DNI,
      NOMBRE_COLEGIADO: info.NOMBRE_COLEGIADO,
      ESTADO: info.ESTADO,
      FECHA_ULTIMO_PAGO: info.FECHA_ULTIMO_PAGO,
      beneficiarios,
    };
  }

  async getBeneficiariosByColegiado(colegiadoId: string) {
    // Fuente 1: LEGACY_DB (padron historico de beneficiarios FAM)
    const legacy: any[] = [];
    if (await this.ensureConnected()) {
      try {
        const query = `
          SELECT
            b.nIdBeneficiario AS FAM_ID,
            (pb.cApPaterno + ' ' + COALESCE(pb.cApMaterno, '') + ' ' + pb.cNombres) AS NOMBRE_BENEFICIARIO,
            COALESCE(docb.cDocumentoIdentidad, '') AS DNI_BENEFICIARIO,
            b.cConsValorParentezco AS COD_PARENTESCO,
            b.nPorcentajeBeneficio AS PORCENTAJE,
            b.bActivo AS ACTIVO
          FROM TBeneficiarioColegiado b
          INNER JOIN TPersona pb ON b.nIdPersona = pb.nIdPersona
          LEFT JOIN TDocumentoPersona docb ON pb.nIdPersona = docb.nIdPersona
          WHERE CAST(b.nIdColegiado AS VARCHAR) = @id AND b.bActivo = 1
          ORDER BY b.nPorcentajeBeneficio DESC
        `;

        this.enforceReadOnly(query);
        const result = await this.runQuery((request) => {
          request.input('id', sql.VarChar, colegiadoId.trim());
          return request.query(query);
        });
        legacy.push(...result.recordset);
      } catch {
        // Si la fuente legada falla, continuamos con la del sistema
      }
    }

    const mapLegacy = legacy.map((r) => ({
      FAM_ID: r.FAM_ID,
      NOMBRE_BENEFICIARIO: r.NOMBRE_BENEFICIARIO,
      DNI: r.DNI_BENEFICIARIO,
      PARENTESCO: this.parentescoMap[r.COD_PARENTESCO] || 'Desconocido',
      PORCENTAJE: Number(r.PORCENTAJE),
      ORIGEN: 'LEGADO',
    }));

    // Fuente 2: APP_DB (beneficiarios registrados desde este sistema)
    const sistema = await this.prisma.famBeneficiario.findMany({
      where: { colegiadoId: String(colegiadoId).trim(), activo: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, nombre: true, dni: true, parentesco: true, porcentaje: true },
    });

    const clave = (n?: string | null, d?: string | null) =>
      `${(n || '').trim().toLowerCase()}|${(d || '').trim()}`;
    const clavesLegacy = new Set(mapLegacy.map((m) => clave(m.NOMBRE_BENEFICIARIO, m.DNI)));

    const mapSistema = sistema
      .filter((s) => !clavesLegacy.has(clave(s.nombre, s.dni)))
      .map((s) => ({
        FAM_ID: s.id,
        NOMBRE_BENEFICIARIO: s.nombre,
        DNI: s.dni || '',
        PARENTESCO: s.parentesco,
        PORCENTAJE: Number(s.porcentaje),
        ORIGEN: 'SISTEMA',
      }));

    return [...mapLegacy, ...mapSistema];
  }

  async getImagenesBeneficiario(beneficiarioId: string) {
    if (!this.pool || !this.isConnected) return {};

    const request = this.pool.request();
    request.input('id', sql.VarChar, beneficiarioId.trim());

    const query = `
      SELECT
        b.cDNICara AS DNI_CARA,
        b.cDNIReverso AS DNI_REVERSO,
        b.cCartaDeclaratoria AS CARTA_DECLARATORIA,
        b.cSucecionIntestada AS SUCESION_INTESTADA
      FROM TBeneficiarioColegiado b
      WHERE b.nIdBeneficiario = @id
    `;

    this.enforceReadOnly(query);
    const result = await request.query(query);
    const row = result.recordset[0];

    if (!row) return {};

    return {
      dniCara: row.DNI_CARA || null,
      dniReverso: row.DNI_REVERSO || null,
      cartaDeclaratoria: row.CARTA_DECLARATORIA || null,
      sucesionIntestada: row.SUCESION_INTESTADA || null,
    };
  }

  async autocomplete(q: string) {
    if (!this.pool || !this.isConnected || !q || q.trim().length < 1) return [];

    const request = this.pool.request();
    const term = `%${q.trim()}%`;
    const exact = q.trim();
    request.input('term', sql.VarChar, term);
    request.input('exact', sql.VarChar, exact);

    const query = `
      SELECT TOP 15
        c.nIdColegiado AS COLEGIADO_ID,
        c.cCodigoCIP AS NUM_COLEGIATURA,
        COALESCE(doc.cDocumentoIdentidad, '') AS DNI,
        (pc.cApPaterno + ' ' + COALESCE(pc.cApMaterno, '') + ' ' + pc.cNombres) AS NOMBRE_COLEGIADO,
        CASE WHEN c.bHabilitado = 1 THEN 'HABILITADO' ELSE 'NO HABILITADO' END AS ESTADO
      FROM TColegiado c
      INNER JOIN TPersona pc ON c.nIdPersona = pc.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON pc.nIdPersona = doc.nIdPersona
      WHERE (
        c.cCodigoCIP = @exact
        OR c.cCodigoCIP LIKE @term
        OR doc.cDocumentoIdentidad = @exact
        OR doc.cDocumentoIdentidad LIKE @term
        OR pc.cNombres LIKE @term
        OR pc.cApPaterno LIKE @term
        OR pc.cApMaterno LIKE @term
        OR (pc.cApPaterno + ' ' + COALESCE(pc.cApMaterno, '') + ' ' + pc.cNombres) LIKE @term
      )
      ORDER BY pc.cApPaterno, pc.cNombres
    `;

    this.enforceReadOnly(query);
    const result = await request.query(query);

    return result.recordset.map((r: any) => ({
      COLEGIADO_ID: String(r.COLEGIADO_ID),
      NUM_COLEGIATURA: r.NUM_COLEGIATURA,
      DNI: r.DNI,
      NOMBRE_COLEGIADO: r.NOMBRE_COLEGIADO,
      ESTADO: r.ESTADO,
    }));
  }

  async exportar(params: {
    search?: string;
    estado?: string;
    conBeneficiarios?: string;
  }) {
    if (!this.pool || !this.isConnected) return [];

    const search = (params.search || '').trim();
    let whereClause = '1=1';

    if (search) {
      whereClause += ` AND (
        c.cCodigoCIP = @searchExact
        OR c.cCodigoCIP LIKE @search
        OR doc.cDocumentoIdentidad = @searchExact
        OR doc.cDocumentoIdentidad LIKE @search
        OR pc.cNombres LIKE @search
        OR pc.cApPaterno LIKE @search
        OR pc.cApMaterno LIKE @search
      )`;
    }

    if (params.estado === 'HABILITADO') {
      whereClause += ' AND c.bHabilitado = 1';
    } else if (params.estado === 'NO HABILITADO') {
      whereClause += ' AND (c.bHabilitado = 0 OR c.bHabilitado IS NULL)';
    }

    if (params.conBeneficiarios === 'SI') {
      whereClause += ' AND (SELECT COUNT(*) FROM TBeneficiarioColegiado bx WHERE bx.nIdColegiado = c.nIdColegiado AND bx.bActivo = 1) > 0';
    } else if (params.conBeneficiarios === 'NO') {
      whereClause += ' AND (SELECT COUNT(*) FROM TBeneficiarioColegiado bx WHERE bx.nIdColegiado = c.nIdColegiado AND bx.bActivo = 1) = 0';
    }

    const query = `
      SELECT
        c.cCodigoCIP AS NUM_COLEGIATURA,
        COALESCE(doc.cDocumentoIdentidad, '') AS DNI,
        (pc.cApPaterno + ' ' + COALESCE(pc.cApMaterno, '') + ' ' + pc.cNombres) AS NOMBRE_COLEGIADO,
        CASE WHEN c.bHabilitado = 1 THEN 'HABILITADO' ELSE 'NO HABILITADO' END AS ESTADO,
        c.cConsValorTipoAsociado AS TIPO_ASOCIADO,
        COALESCE(c.cObservacion, '') AS OBSERVACION,
        c.dFechaUltimoPago AS FECHA_ULTIMO_PAGO,
        cc2.dFechaIncorporacionACIP AS FECHA_INGRESO,
        (SELECT COUNT(*) FROM TBeneficiarioColegiado bx WHERE bx.nIdColegiado = c.nIdColegiado AND bx.bActivo = 1) AS NUM_BENEFICIARIOS,
        (SELECT SUM(bx.nPorcentajeBeneficio) FROM TBeneficiarioColegiado bx WHERE bx.nIdColegiado = c.nIdColegiado AND bx.bActivo = 1) AS SUMA_PORCENTAJE
      FROM TColegiado c
      INNER JOIN TPersona pc ON c.nIdPersona = pc.nIdPersona
      LEFT JOIN TDocumentoPersona doc ON pc.nIdPersona = doc.nIdPersona
      LEFT JOIN (
        SELECT nIdColegiado, MAX(dFechaIncorporacionACIP) AS dFechaIncorporacionACIP
        FROM TColegiadoCapitulo
        GROUP BY nIdColegiado
      ) cc2 ON c.nIdColegiado = cc2.nIdColegiado
      WHERE ${whereClause}
      GROUP BY
        c.nIdColegiado, c.cCodigoCIP, doc.cDocumentoIdentidad,
        pc.cApPaterno, pc.cApMaterno, pc.cNombres,
        c.bHabilitado, c.cConsValorTipoAsociado, c.cObservacion, c.dFechaUltimoPago, cc2.dFechaIncorporacionACIP
      ORDER BY pc.cApPaterno, pc.cNombres
    `;

    this.enforceReadOnly(query);

    const request = this.pool.request();
    if (search) {
      request.input('search', sql.VarChar, `%${search}%`);
      request.input('searchExact', sql.VarChar, search);
    }

    const result = await request.query(query);

    return result.recordset.map((r: any) => ({
      CIP: r.NUM_COLEGIATURA,
      DNI: r.DNI,
      COLEGIADO: r.NOMBRE_COLEGIADO,
      ESTADO: r.ESTADO,
      TIPO_ASOCIADO: this.tipoAsociadoMap[r.TIPO_ASOCIADO] || 'Sin definir',
      OBSERVACION: r.OBSERVACION || '',
      ULTIMO_PAGO: r.FECHA_ULTIMO_PAGO ? new Date(r.FECHA_ULTIMO_PAGO).toISOString().slice(0, 10) : '',
      INCORPORACION: r.FECHA_INGRESO ? new Date(r.FECHA_INGRESO).toISOString().slice(0, 10) : '',
      NUM_BENEFICIARIOS: Number(r.NUM_BENEFICIARIOS),
      SUMA_PORCENTAJE: Number(r.SUMA_PORCENTAJE),
    }));
  }

  async getResumen() {
    const disponible = await this.ensureConnected();
    if (!disponible) {
      return { resumen: {}, porParentesco: [], porColegiado: [], porTipoAsociado: [] };
    }

    const totalQuery = `
      SELECT
        COUNT(*) AS total_beneficiarios,
        COUNT(DISTINCT b.nIdColegiado) AS total_colegiados,
        SUM(b.nPorcentajeBeneficio) AS suma_porcentajes
      FROM TBeneficiarioColegiado b WHERE b.bActivo = 1
    `;

    const porParentescoQuery = `
      SELECT
        b.cConsValorParentezco,
        COUNT(*) AS cantidad,
        AVG(CAST(b.nPorcentajeBeneficio AS FLOAT)) AS promedio_porcentaje
      FROM TBeneficiarioColegiado b WHERE b.bActivo = 1
      GROUP BY b.cConsValorParentezco ORDER BY cantidad DESC
    `;

    const porColegiadoQuery = `
      SELECT TOP 10
        c.cCodigoCIP AS NUM_COLEGIATURA,
        (pc.cApPaterno + ' ' + COALESCE(pc.cApMaterno, '') + ' ' + pc.cNombres) AS NOMBRE_COLEGIADO,
        COUNT(*) AS num_beneficiarios,
        SUM(b.nPorcentajeBeneficio) AS suma_porcentaje
      FROM TBeneficiarioColegiado b
      INNER JOIN TColegiado c ON b.nIdColegiado = c.nIdColegiado
      INNER JOIN TPersona pc ON c.nIdPersona = pc.nIdPersona
      WHERE b.bActivo = 1
      GROUP BY c.cCodigoCIP, pc.cApPaterno, pc.cApMaterno, pc.cNombres
      HAVING COUNT(*) > 1
      ORDER BY num_beneficiarios DESC
    `;

    const porTipoQuery = `
      SELECT
        c.cConsValorTipoAsociado AS tipo,
        COUNT(DISTINCT c.nIdColegiado) AS cantidad
      FROM TBeneficiarioColegiado b
      INNER JOIN TColegiado c ON b.nIdColegiado = c.nIdColegiado
      WHERE b.bActivo = 1
      GROUP BY c.cConsValorTipoAsociado
    `;

    const resumen = await this.runQuery((request) => request.query(totalQuery));
    const porParentesco = await this.runQuery((request) => request.query(porParentescoQuery));
    const porColegiado = await this.runQuery((request) => request.query(porColegiadoQuery));
    const porTipo = await this.runQuery((request) => request.query(porTipoQuery));

    return {
      resumen: resumen.recordset[0] || {},
      porParentesco: porParentesco.recordset.map((r: any) => ({
        COD_PARENTESCO: r.cConsValorParentezco,
        PARENTESCO: this.parentescoMap[r.cConsValorParentezco] || 'Desconocido',
        cantidad: r.cantidad,
        promedio_porcentaje: Number(r.promedio_porcentaje),
      })),
      porColegiado: porColegiado.recordset.map((r: any) => ({
        NUM_COLEGIATURA: r.NUM_COLEGIATURA,
        NOMBRE_COLEGIADO: r.NOMBRE_COLEGIADO,
        num_beneficiarios: r.num_beneficiarios,
        suma_porcentaje: Number(r.suma_porcentaje),
      })),
      porTipoAsociado: porTipo.recordset.map((r: any) => ({
        TIPO: this.tipoAsociadoMap[r.tipo] || 'Sin definir',
        cantidad: r.cantidad,
      })),
    };
  }

  async crearBeneficiario(
    colegiadoId: string,
    data: {
      nombre: string;
      dni?: string;
      parentesco: string;
      porcentaje: number;
      observaciones?: string;
      imagenes?: {
        dniCara?: string;
        dniReverso?: string;
        cartaDeclaratoria?: string;
        sucesionIntestada?: string;
      };
    },
  ) {
    if (!data.nombre || !data.parentesco || data.porcentaje === undefined) {
      throw new BadRequestException('nombre, parentesco y porcentaje son requeridos');
    }

    if (data.porcentaje < 0 || data.porcentaje > 100) {
      throw new BadRequestException('El porcentaje debe estar entre 0 y 100');
    }

    const id = require('crypto').randomUUID();

    await this.prisma.famBeneficiario.create({
      data: {
        id,
        colegiadoId,
        nombre: data.nombre,
        dni: data.dni || null,
        parentesco: data.parentesco,
        porcentaje: data.porcentaje,
        observaciones: data.observaciones || null,
        imagenes: data.imagenes
          ? {
              create: {
                id: require('crypto').randomUUID(),
                dniCara: data.imagenes.dniCara || null,
                dniReverso: data.imagenes.dniReverso || null,
                cartaDeclaratoria: data.imagenes.cartaDeclaratoria || null,
                sucesionIntestada: data.imagenes.sucesionIntestada || null,
              },
            }
          : undefined,
      },
      include: { imagenes: true },
    });

    return { id, message: 'Beneficiario creado exitosamente' };
  }

  async actualizarBeneficiario(
    id: string,
    data: {
      nombre?: string;
      dni?: string;
      parentesco?: string;
      porcentaje?: number;
      activo?: boolean;
      observaciones?: string;
    },
  ) {
    const existing = await this.prisma.famBeneficiario.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Beneficiario no encontrado');

    if (data.porcentaje !== undefined && (data.porcentaje < 0 || data.porcentaje > 100)) {
      throw new BadRequestException('El porcentaje debe estar entre 0 y 100');
    }

    await this.prisma.famBeneficiario.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.dni !== undefined && { dni: data.dni }),
        ...(data.parentesco !== undefined && { parentesco: data.parentesco }),
        ...(data.porcentaje !== undefined && { porcentaje: data.porcentaje }),
        ...(data.activo !== undefined && { activo: data.activo }),
        ...(data.observaciones !== undefined && { observaciones: data.observaciones }),
      },
    });

    return { message: 'Beneficiario actualizado exitosamente' };
  }

  async actualizarImagenes(
    beneficiarioId: string,
    data: {
      dniCara?: string;
      dniReverso?: string;
      cartaDeclaratoria?: string;
      sucesionIntestada?: string;
    },
  ) {
    const existing = await this.prisma.famBeneficiario.findUnique({ where: { id: beneficiarioId } });
    if (!existing) throw new BadRequestException('Beneficiario no encontrado');

    const existingImg = await this.prisma.famImagenBeneficiario.findUnique({
      where: { beneficiarioId },
    });

    if (existingImg) {
      await this.prisma.famImagenBeneficiario.update({
        where: { beneficiarioId },
        data: {
          ...(data.dniCara !== undefined && { dniCara: data.dniCara }),
          ...(data.dniReverso !== undefined && { dniReverso: data.dniReverso }),
          ...(data.cartaDeclaratoria !== undefined && { cartaDeclaratoria: data.cartaDeclaratoria }),
          ...(data.sucesionIntestada !== undefined && { sucesionIntestada: data.sucesionIntestada }),
        },
      });
    } else {
      await this.prisma.famImagenBeneficiario.create({
        data: {
          id: require('crypto').randomUUID(),
          beneficiarioId,
          dniCara: data.dniCara || null,
          dniReverso: data.dniReverso || null,
          cartaDeclaratoria: data.cartaDeclaratoria || null,
          sucesionIntestada: data.sucesionIntestada || null,
        },
      });
    }

    return { message: 'Imagenes actualizadas exitosamente' };
  }

  async eliminarBeneficiario(id: string) {
    const existing = await this.prisma.famBeneficiario.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Beneficiario no encontrado');

    await this.prisma.famBeneficiario.update({
      where: { id },
      data: { activo: false },
    });

    return { message: 'Beneficiario desactivado exitosamente' };
  }

  async cargaMasiva(data: {
    cip: string;
    nombre: string;
    dni?: string;
    parentesco: string;
    porcentaje: number;
    observaciones?: string;
  }) {
    if (!this.pool || !this.isConnected) {
      throw new BadRequestException('Base de datos no disponible');
    }

    if (!data.cip || !data.nombre || !data.parentesco || data.porcentaje <= 0) {
      throw new BadRequestException('CIP, nombre, parentesco y porcentaje son requeridos');
    }

    const request = this.pool.request();
    request.input('cip', sql.VarChar, data.cip.trim());

    const findQuery = `
      SELECT c.nIdColegiado
      FROM TColegiado c
      WHERE c.cCodigoCIP = @cip
    `;
    this.enforceReadOnly(findQuery);
    const result = await request.query(findQuery);

    if (result.recordset.length === 0) {
      throw new BadRequestException(`Colegiado con CIP ${data.cip} no encontrado`);
    }

    const colegiadoId = String(result.recordset[0].nIdColegiado);
    return this.crearBeneficiario(colegiadoId, {
      nombre: data.nombre,
      dni: data.dni,
      parentesco: data.parentesco,
      porcentaje: data.porcentaje,
      observaciones: data.observaciones,
    });
  }
}
