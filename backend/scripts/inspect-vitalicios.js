const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const sql = require('mssql/msnodesqlv8');
  const connStr = process.env.LEGACY_DB_URL;
  console.log(`Connecting via ODBC to SQL Server...`);

  const pool = new sql.ConnectionPool({
    connectionString: connStr,
    options: { trustedConnection: true, enableArithAbort: true },
  });

  await pool.connect();
  console.log('Connected!');

  // 1. Check sample vitalicios
  console.log('\n--- 1. Vitalicios (TIPO_ASOCIADO_COD = 2) y sus campos de Ubigeo ---');
  const vitRes = await pool.request().query(`
    SELECT TOP 10
      c.nIdColegiado,
      c.cCodigoCIP,
      c.cConsValorTipoAsociado,
      p.cNombres,
      p.cApPaterno,
      p.cCodUbigeoDepartamentoResidencia AS depCod,
      p.cCodUbigeoProvinciaResidencia AS proCod,
      p.cCodUbigeoDistritoResidencia AS disCod,
      p.cDireccion,
      doc.cDocumentoIdentidad AS DNI,
      doc.cConsValorTipoDocIdentidad AS tipoDoc
    FROM TColegiado c
    INNER JOIN TPersona p ON c.nIdPersona = p.nIdPersona
    LEFT JOIN TDocumentoPersona doc ON p.nIdPersona = doc.nIdPersona
    WHERE c.cConsValorTipoAsociado = '2'
      AND (p.cCodUbigeoDepartamentoResidencia IS NOT NULL OR p.cCodUbigeoDistritoResidencia IS NOT NULL)
  `);
  console.table(vitRes.recordset);

  // 2. Check how TUbigeo stores cDepCod, cProcod, cDiscod
  console.log('\n--- 2. Sample TUbigeo columns ---');
  const ubiRes = await pool.request().query(`
    SELECT TOP 10 cDepCod, cProcod, cDiscod, cDepartamento, cProvincia, cDistrito,
      LEN(cDepCod) AS lenDep, LEN(cProcod) AS lenPro, LEN(cDiscod) AS lenDis
    FROM TUbigeo
    WHERE cDepartamento LIKE '%CUSCO%'
  `);
  console.table(ubiRes.recordset);

  // 3. Check what getColegiadoByCipAndDni returns for a Vitalicio
  if (vitRes.recordset.length > 0) {
    const v = vitRes.recordset[0];
    console.log(`\n--- 3. Testing query for vitalicio CIP=${v.cCodigoCIP}, DNI=${v.DNI} ---`);
    const qRes = await pool.request()
      .input('cip', v.cCodigoCIP)
      .input('dni', v.DNI)
      .query(`
        SELECT 
          p.cCodUbigeoDepartamentoResidencia,
          p.cCodUbigeoProvinciaResidencia,
          p.cCodUbigeoDistritoResidencia,
          u.cDepartamento,
          u.cProvincia,
          u.cDistrito
        FROM TColegiado c
        INNER JOIN TPersona p ON c.nIdPersona = p.nIdPersona
        LEFT JOIN TUbigeo u ON 
          p.cCodUbigeoDepartamentoResidencia = u.cDepCod 
          AND p.cCodUbigeoProvinciaResidencia = u.cProcod 
          AND p.cCodUbigeoDistritoResidencia = u.cDiscod
        WHERE c.cCodigoCIP = @cip
      `);
    console.log('Result:', qRes.recordset);
  }

  // 4. Check Carnet de Extranjería colegiados
  console.log('\n--- 4. Carnet de Extranjería (tipoDoc = 4) ---');
  const ceRes = await pool.request().query(`
    SELECT TOP 5
      c.nIdColegiado,
      c.cCodigoCIP,
      c.cConsValorTipoAsociado,
      p.cNombres,
      p.cApPaterno,
      doc.cDocumentoIdentidad AS docId,
      doc.cConsValorTipoDocIdentidad AS tipoDoc
    FROM TColegiado c
    INNER JOIN TPersona p ON c.nIdPersona = p.nIdPersona
    INNER JOIN TDocumentoPersona doc ON p.nIdPersona = doc.nIdPersona
    WHERE doc.cConsValorTipoDocIdentidad = '4'
  `);
  console.table(ceRes.recordset);

  await pool.close();
}

main().catch(console.error);
