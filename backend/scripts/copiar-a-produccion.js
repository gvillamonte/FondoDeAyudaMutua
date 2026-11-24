/**
 * ==============================================================================
 * SCRIPT DE COPIA / SINCRONIZACIÓN DE DBCIPBeneficios A PRODUCCIÓN
 * Origen:  SQL Server Local (DBCIPBeneficios)
 * Destino: Servidor Real VPS (161.97.67.133 / DBCIPBeneficios)
 * ==============================================================================
 */

const sql = require('mssql');

// Configuración Origen (Local)
const LOCAL_CONFIG = {
  server: process.env.LOCAL_DB_SERVER || 'localhost',
  port: Number(process.env.LOCAL_DB_PORT) || 1433,
  database: 'DBCIPBeneficios',
  user: process.env.LOCAL_DB_USER || 'usuario_ubuntu',
  password: process.env.LOCAL_DB_PASSWORD || 'cip2026cusco',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 10000,
  },
};

// Configuración Destino (Producción VPS)
const PROD_CONFIG = {
  server: process.env.PROD_DB_SERVER || '161.97.67.133',
  port: Number(process.env.PROD_DB_PORT) || 1433,
  database: 'DBCIPBeneficios',
  user: process.env.PROD_DB_USER || 'UserColegiados',
  password: process.env.PROD_DB_PASSWORD || 'U$3rC0l3g1ad0$01',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
  },
};

// Orden de sincronización respetando claves foráneas
const TABLES_ORDER = [
  // 1. Catálogos base
  'usuarios',
  'monedas',
  'estados_solicitud',
  'metodos_pago',
  'montos_fam',
  'tipos_beneficio_config',
  'tipos_beneficio',
  'fam_configuracion',
  'cartas',
  'memorandos',
  'expediente_sla_config',
  // 2. Entidades principales
  'beneficios',
  'fam_beneficiarios',
  'fam_covid_asignaciones',
  'fam_duplicados',
  'colegiado_actualizaciones',
  // 3. Entidades secundarias
  'refresh_tokens',
  'datos_beneficios',
  'solicitudes_beneficio',
  'fam_solicitud_beneficio',
  'fam_imagenes_beneficiario',
  'fam_covid_asignacion_beneficiarios',
  'fam_duplicado_documentos',
  // 4. Detalle y transacciones
  'pagos',
  'fam_solicitud_beneficiarios',
  'fam_depositos_beneficiario',
  'fam_sucesiones_intestadas',
  'fam_reembolso_comprobantes',
  'expediente_beneficiario_audit',
  // 5. Versiones y auditoría
  'fam_sucesion_beneficiarios',
  'fam_sucesion_versiones',
  'audit_logs',
];

async function connectWithFallback(config) {
  try {
    return await sql.connect(config);
  } catch (err) {
    // Si falla autenticación SQL local, intentar sin usuario/password (Windows Auth) si es localhost
    if (config.server === 'localhost' || config.server.includes('SQLEXPRESS')) {
      const winConfig = {
        server: '.\\SQLEXPRESS',
        database: 'DBCIPBeneficios',
        driver: 'msnodesqlv8',
        options: { trustedConnection: true, trustServerCertificate: true },
      };
      return await sql.connect(winConfig);
    }
    throw err;
  }
}

async function getPrimaryKeys(pool, tableName) {
  const q = `
    SELECT c.name as column_name
    FROM sys.indexes i
    INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
    WHERE i.is_primary_key = 1 AND i.object_id = OBJECT_ID('${tableName}')
    ORDER BY ic.key_ordinal
  `;
  const res = await pool.request().query(q);
  return res.recordset.map((r) => r.column_name);
}

async function hasIdentityColumn(pool, tableName) {
  const q = `SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('${tableName}') AND is_identity = 1`;
  const res = await pool.request().query(q);
  return res.recordset.length > 0;
}

async function syncTable(localPool, prodPool, tableName) {
  // Obtener columnas de la tabla en producción
  const colRes = await prodPool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = '${tableName}'
  `);
  if (colRes.recordset.length === 0) {
    return { table: tableName, local: 0, prod: 0, copied: 0, status: 'No existe en producción' };
  }
  const prodColumns = new Set(colRes.recordset.map((c) => c.COLUMN_NAME));

  // Obtener llaves primarias
  const pks = await getPrimaryKeys(prodPool, tableName);

  // Leer registros locales
  const localRes = await localPool.request().query(`SELECT * FROM [${tableName}]`);
  const localRows = localRes.recordset;

  // Leer registros en producción
  const prodRes = await prodPool.request().query(`SELECT * FROM [${tableName}]`);
  const prodRows = prodRes.recordset;

  const countLocal = localRows.length;
  const countProd = prodRows.length;

  if (countLocal === 0) {
    return { table: tableName, local: countLocal, prod: countProd, copied: 0, status: 'Sin datos locales' };
  }

  // Filtrar filas locales cuyas columnas coincidan con producción
  const isIdentity = await hasIdentityColumn(prodPool, tableName);
  let copiedCount = 0;

  // Crear índice en memoria de producción por PK para no duplicar
  const prodPkSet = new Set();
  if (pks.length > 0) {
    for (const r of prodRows) {
      const key = pks.map((k) => String(r[k])).join('__');
      prodPkSet.add(key);
    }
  }

  const rowsToInsert = [];
  for (const row of localRows) {
    if (pks.length > 0) {
      const key = pks.map((k) => String(row[k])).join('__');
      if (prodPkSet.has(key)) continue; // ya existe en producción
    }
    rowsToInsert.push(row);
  }

  if (rowsToInsert.length > 0) {
    if (isIdentity) {
      await prodPool.request().query(`SET IDENTITY_INSERT [${tableName}] ON`);
    }

    for (const row of rowsToInsert) {
      const insertCols = Object.keys(row).filter((c) => prodColumns.has(c));
      if (insertCols.length === 0) continue;

      const req = prodPool.request();
      const colNames = insertCols.map((c) => `[${c}]`).join(', ');
      const valPlaceholders = insertCols
        .map((c, i) => {
          req.input(`p${i}`, row[c]);
          return `@p${i}`;
        })
        .join(', ');

      const insertQuery = `INSERT INTO [${tableName}] (${colNames}) VALUES (${valPlaceholders})`;
      try {
        await req.query(insertQuery);
        copiedCount++;
      } catch (insertErr) {
        // En caso de conflicto u omitir duplicados
        console.warn(`    [!] Aviso en ${tableName}: ${insertErr.message.split('\n')[0]}`);
      }
    }

    if (isIdentity) {
      await prodPool.request().query(`SET IDENTITY_INSERT [${tableName}] OFF`);
    }
  }

  const finalProdCount = countProd + copiedCount;
  return {
    table: tableName,
    local: countLocal,
    prod: finalProdCount,
    copied: copiedCount,
    status: copiedCount > 0 ? `+${copiedCount} copiados` : 'Sincronizado',
  };
}

async function main() {
  console.log('================================================================');
  console.log('    COPIAR / SINCRONIZAR DBCIPBeneficios A PRODUCCIÓN');
  console.log(`    Origen:  Local [${LOCAL_CONFIG.server}/${LOCAL_CONFIG.database}]`);
  console.log(`    Destino: Producción [${PROD_CONFIG.server}/${PROD_CONFIG.database}]`);
  console.log('================================================================\n');

  console.log('[1/4] Conectando a Base de Datos Local...');
  let localPool;
  try {
    localPool = await connectWithFallback(LOCAL_CONFIG);
    console.log('  -> Conectado a Local OK.');
  } catch (err) {
    console.error('  [ERROR] No se pudo conectar a la base local:', err.message);
    process.exit(1);
  }

  console.log('[2/4] Conectando a Base de Datos de Producción (161.97.67.133)...');
  let prodPool;
  try {
    const prodSql = new sql.ConnectionPool(PROD_CONFIG);
    prodPool = await prodSql.connect();
    console.log('  -> Conectado a Producción OK.');
  } catch (err) {
    console.error('  [ERROR] No se pudo conectar a Producción:', err.message);
    await localPool.close();
    process.exit(1);
  }

  console.log('\n[3/4] Desactivando temporalmente restricciones en Producción...');
  try {
    await prodPool.request().query('EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT ALL"');
    console.log('  -> Restricciones desactivadas para copia limpia.');
  } catch (err) {
    console.warn('  [!] Advertencia al desactivar restricciones:', err.message);
  }

  console.log('\n[4/4] Sincronizando tablas a Producción...\n');
  const results = [];
  for (const table of TABLES_ORDER) {
    try {
      const res = await syncTable(localPool, prodPool, table);
      results.push(res);
      console.log(`  ✓ ${table.padEnd(35)} : ${String(res.local).padStart(5)} local -> ${String(res.prod).padStart(5)} prod (${res.status})`);
    } catch (err) {
      results.push({ table, local: '?', prod: '?', copied: 0, status: 'ERROR: ' + err.message });
      console.error(`  ✗ Error en ${table}:`, err.message);
    }
  }

  console.log('\n-> Reactivando restricciones en Producción...');
  try {
    await prodPool.request().query('EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL"');
    console.log('  -> Restricciones reactivadas con validación.');
  } catch (err) {
    console.warn('  [!] Advertencia al reactivar restricciones:', err.message);
  }

  await localPool.close();
  await prodPool.close();

  console.log('\n================================================================');
  console.log('   RESUMEN FINAL DE COPIA A PRODUCCIÓN');
  console.log('================================================================');
  const totalCopiados = results.reduce((acc, r) => acc + (r.copied || 0), 0);
  console.log(`Registros nuevos copiados a producción: ${totalCopiados}`);
  console.log('¡Base de datos DBCIPBeneficios en producción actualizada con éxito!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Error fatal durante la sincronización:', err);
  process.exit(1);
});
