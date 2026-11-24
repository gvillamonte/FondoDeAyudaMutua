const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const sql = require('mssql/msnodesqlv8');
  const pool = new sql.ConnectionPool({
    connectionString: process.env.LEGACY_DB_URL,
    options: { trustedConnection: true, enableArithAbort: true },
  });
  await pool.connect();
  const res = await pool.request().query("SELECT c.cCodigoCIP, c.cConsValorEstadoColegiado, c.bHabilitado FROM TColegiado c WHERE c.cCodigoCIP IN ('15549', '408231', '335349')");
  console.table(res.recordset);
  await pool.close();
}
main().catch(console.error);
