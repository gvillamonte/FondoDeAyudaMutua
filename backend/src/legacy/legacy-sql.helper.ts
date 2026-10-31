import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';

const POOL = { min: 2, max: 10, idleTimeoutMillis: 30000 };
const REQUEST_TIMEOUT = 20000;
const CONNECTION_TIMEOUT = 10000;

export type LegacyAuthMode = 'sql' | 'windows';

function boolEnv(config: ConfigService, key: string, defaultValue: boolean): boolean {
  const raw = config.get<string>(key);
  if (raw === undefined || raw === '') return defaultValue;
  return raw.toLowerCase() !== 'false';
}

/**
 * Construye el pool de conexion a LEGACY_DB (SQL Server, solo lectura).
 *
 * Orden de prioridad:
 * 1. LEGACY_DB_URL estilo tedious (sqlserver://user:pass@host:port;database=...)
 * 2. LEGACY_DB_USER + LEGACY_DB_PASSWORD + LEGACY_DB_SERVER (autenticacion SQL)
 * 3. Autenticacion de Windows (solo dev Windows, requiere msnodesqlv8 opcional)
 *
 * En Linux/produccion se debe usar autenticacion SQL (2 o 1).
 */
export async function createLegacyPool(config: ConfigService): Promise<{
  pool: sql.ConnectionPool;
  mode: LegacyAuthMode;
}> {
  const server = config.get<string>('LEGACY_DB_SERVER');
  const database = config.get<string>('LEGACY_DB_NAME', 'DBCIPCusco');
  const envUrl = config.get<string>('LEGACY_DB_URL');
  const user = config.get<string>('LEGACY_DB_USER');
  const password = config.get<string>('LEGACY_DB_PASSWORD');
  const port = Number(config.get<string>('LEGACY_DB_PORT') || 1433);
  const encrypt = boolEnv(config, 'LEGACY_DB_ENCRYPT', true);
  const trustCert = boolEnv(config, 'LEGACY_DB_TRUST_CERT', true);

  if (envUrl && /^\s*(sqlserver|dbserver):\/\//i.test(envUrl)) {
    const pool = new sql.ConnectionPool({
      connectionString: envUrl,
      pool: POOL,
      requestTimeout: REQUEST_TIMEOUT,
      connectionTimeout: CONNECTION_TIMEOUT,
    } as unknown as sql.config);
    return { pool, mode: 'sql' };
  }

  if (user && password && server) {
    const pool = new sql.ConnectionPool({
      user,
      password,
      server,
      database,
      port,
      options: {
        encrypt,
        trustServerCertificate: trustCert,
        enableArithAbort: true,
      },
      pool: POOL,
      requestTimeout: REQUEST_TIMEOUT,
      connectionTimeout: CONNECTION_TIMEOUT,
    });
    return { pool, mode: 'sql' };
  }

  let mssqlv8: typeof sql;
  try {
    mssqlv8 = await import('mssql/msnodesqlv8');
  } catch {
    throw new Error(
      'LEGACY_DB no configurado: defina LEGACY_DB_USER y LEGACY_DB_PASSWORD (autenticacion SQL). ' +
        'La autenticacion de Windows solo esta disponible en Windows con el paquete opcional msnodesqlv8.',
    );
  }

  const legacyServer = server || 'localhost\\SQLEXPRESS';
  const connStr =
    envUrl && envUrl.includes('Trusted_Connection')
      ? envUrl
      : `Driver={ODBC Driver 18 for SQL Server};Server=${legacyServer};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`;

  const pool = new mssqlv8.ConnectionPool({
    connectionString: connStr,
    options: { trustedConnection: true, enableArithAbort: true },
    pool: POOL,
    requestTimeout: REQUEST_TIMEOUT,
    connectionTimeout: CONNECTION_TIMEOUT,
  } as any);

  return { pool, mode: 'windows' };
}

/**
 * Clasifica errores de LEGACY_DB. LEGACY_DB es SOLO LECTURA (SELECT), por lo
 * que reconectar el pool y reintentar la consulta es siempre seguro.
 *
 * Se reintenta:
 * - fallos de conexion/pool (ENOTOPEN, ESOCKET, etc.)
 * - timeout de consulta (`Query timeout expired` / ETIMEOUT): el sintoma
 *   tipico de una conexion colgada en el pool (driver ODBC + autenticacion de
 *   Windows). Sin reintento el cliente espera 20s y recibe un HTTP 500.
 *
 * NO se reintenta: errores de SQL (EREQUEST) ni de parametros (EINPUT).
 */
export function isLegacyRetryableError(error: any): boolean {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();

  // msnodesqlv8 marca TODO error de sentencia como EREQUEST, incluido el
  // timeout de consulta: por eso el mensaje se evalua antes que el codigo.
  const esTimeout =
    code === 'ETIMEOUT' ||
    msg.includes('timeout expired') ||
    msg.includes('timeout') // query_timeout / login timeout del driver ODBC
  if (esTimeout) return true;

  if (code === 'EREQUEST' || code === 'EINPUT') return false;
  if (['ENOTOPEN', 'ESOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(code)) return true;

  return (
    msg.includes('connection is closed') ||
    msg.includes('connection was closed') ||
    msg.includes('connection pool') ||
    msg.includes('unable to connect') ||
    msg.includes('socket hang up') ||
    msg.includes('econnreset') ||
    msg.includes('connection terminated')
  );
}

/**
 * Cierra el pool legacy sin bloquear la peticion del usuario: si alguna
 * conexion quedo colgada, pool.close() puede no resolver nunca.
 */
export async function closePoolSafely(
  pool: { close: () => Promise<void> } | null,
  timeoutMs = 5000,
): Promise<void> {
  if (!pool) return;
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => pool.close()).catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        if (typeof timer.unref === 'function') timer.unref();
      }),
    ]);
  } catch {
    // Ignorar errores al cerrar el pool caido
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Peso del ping de keepalive: por debajo de idleTimeoutMillis (30s). */
export const LEGACY_KEEPALIVE_MS = 25000;

/**
 * Mantiene vivas las conexiones ociosas del pool legacy.
 *
 * El driver ODBC (msnodesqlv8) con autenticacion de Windows puede dejar
 * conexiones "colgadas" tras un periodo de inactividad: la primera consulta
 * posterior agota los 20s de requestTimeout en lugar de detectar la conexion
 * muerta y responde con `Query timeout expired`. Con un ping periodico las
 * conexiones nunca quedan ociosas y los buscadores responden en milisegundos.
 */
export function startLegacyKeepalive(
  ping: () => Promise<void>,
  onError: (error: any) => void,
  intervalMs: number = LEGACY_KEEPALIVE_MS,
): NodeJS.Timeout {
  const timer = setInterval(() => {
    void Promise.resolve()
      .then(() => ping())
      .catch((error) => onError(error));
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

/**
 * Ejecuta una consulta sobre LEGACY_DB y, si el fallo es reintentable
 * (conexion o timeout de consulta), reconecta el pool una vez y reintenta.
 * Un Request por ejecucion.
 */
export async function queryWithLegacyRetry<T>(
  execute: () => Promise<T>,
  reconnect: () => Promise<void>,
  onRetry: (error: any) => void,
): Promise<T> {
  try {
    return await execute();
  } catch (error: any) {
    if (!isLegacyRetryableError(error)) throw error;
    onRetry(error);
    await reconnect();
    return await execute();
  }
}
