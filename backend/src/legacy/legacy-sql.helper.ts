import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';

const POOL = { min: 2, max: 10, idleTimeoutMillis: 30000 };
const REQUEST_TIMEOUT = 90000;
const CONNECTION_TIMEOUT = 30000;

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
