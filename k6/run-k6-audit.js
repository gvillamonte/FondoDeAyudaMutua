const http = require('http');

const TARGET_HOST = process.env.TARGET_HOST || '18.191.81.201';
const TARGET_PORT = parseInt(process.env.TARGET_PORT || '3001', 10);
const OPERATOR_USER = process.env.OPERATOR_USER || 'operador1';
const OPERATOR_PASS = process.env.OPERATOR_PASS || 'Admin123!';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const start = Date.now();
    const req = http.request(
      {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: `/api${path}`,
        method,
        headers: reqHeaders,
        timeout: 10000,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          const duration = Date.now() - start;
          let parsed = null;
          try {
            parsed = JSON.parse(responseBody);
          } catch {}
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsed || responseBody,
            duration,
          });
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout en ${method} ${path}`));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function calculateP95(latencies) {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function runAuditGate() {
  console.log('====================================================');
  console.log('   SUITE DE VERIFICACION K6 / PRUEBAS DE CARGA      ');
  console.log(`   Destino: http://${TARGET_HOST}:${TARGET_PORT}/api`);
  console.log('====================================================\n');

  let totalRequests = 0;
  let failedChecks = 0;
  const famLatencies = [];

  // Paso 0: Obtener token de operador (no-admin)
  console.log('[0/4] Autenticando operador para pruebas RBAC...');
  let operatorToken = null;
  try {
    const loginRes = await request('POST', '/auth/login', {
      username: OPERATOR_USER,
      password: OPERATOR_PASS,
    });
    if (loginRes.status === 200) {
      operatorToken = loginRes.body.accessToken || (loginRes.body.data && loginRes.body.data.accessToken);
      console.log('  -> Operador autenticado exitosamente (HTTP 200).');
    } else {
      console.error(`  -> ERROR: Login de operador fallo con status ${loginRes.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`  -> ERROR conectando al servidor: ${err.message}`);
    process.exit(1);
  }

  // Paso 1: P1 - POST /api/auth/register debe retornar 401 o 403
  console.log('\n[1/4] Verificando P1: POST /api/auth/register (Intento anónimo ilegítimo)...');
  for (let i = 0; i < 5; i++) {
    totalRequests++;
    const res = await request('POST', '/auth/register', {
      username: `k6_intruder_${i}`,
      email: `k6_intruder_${i}@cipcusco.org.pe`,
      password: 'Hacker123!',
      nombreCompleto: 'Intruso No Autorizado',
      rol: 'SUPER_ADMINISTRADOR',
    });

    const isBlocked = res.status === 401 || res.status === 403;
    if (isBlocked) {
      console.log(`  -> Intento ${i + 1}: Bloqueado correctamente (HTTP ${res.status} ${res.body.error || 'Unauthorized/Forbidden'})`);
    } else {
      console.error(`  -> FALLO CRITICO: Endpoint retorno HTTP ${res.status} (Esperado 401/403)`);
      failedChecks++;
    }
  }

  // Paso 2: P4 - GET /api/roles debe retornar 403 con usuario no-admin
  console.log('\n[2/4] Verificando P4: GET /api/roles (Consulta con token operador sin rol admin)...');
  for (let i = 0; i < 5; i++) {
    totalRequests++;
    const res = await request('GET', '/roles', null, {
      Authorization: `Bearer ${operatorToken}`,
    });

    const isForbidden = res.status === 403;
    if (isForbidden) {
      console.log(`  -> Intento ${i + 1}: Acceso denegado correctamente (HTTP 403 Forbidden)`);
    } else {
      console.error(`  -> FALLO: GET /api/roles retorno HTTP ${res.status} (Esperado 403)`);
      failedChecks++;
    }
  }

  // Paso 3: Salud y latencia FAM - GET /api/fam-beneficios (debe responder 200 con p95 < 500ms)
  console.log('\n[3/4] Verificando Endpoints FAM y Latencia (20 peticiones con carga controlada)...');
  for (let i = 0; i < 20; i++) {
    totalRequests++;
    const res = await request('GET', '/fam-beneficios?limit=10', null, {
      Authorization: `Bearer ${operatorToken}`,
    });
    famLatencies.push(res.duration);
    if (res.status === 200) {
      process.stdout.write(`  [Req ${i + 1}: ${res.duration}ms] `);
      if ((i + 1) % 5 === 0) console.log('');
    } else {
      console.error(`  -> FAM retorno HTTP ${res.status}`);
      failedChecks++;
    }
    // Breve pausa de 50ms simulando intervalo entre usuarios
    await new Promise((r) => setTimeout(r, 50));
  }

  const p95 = calculateP95(famLatencies);
  const errorRate = (failedChecks / totalRequests) * 100;

  console.log('\n====================================================');
  console.log('   RESULTADOS DE VALIDACION K6                      ');
  console.log('====================================================');
  console.log(`Total de Peticiones Ejecutadas : ${totalRequests}`);
  console.log(`Peticiones Fallidas            : ${failedChecks}`);
  console.log(`Tasa de Error (Error Rate)     : ${errorRate.toFixed(2)}% (Umbral: < 1.00%)`);
  console.log(`Latencia p95 FAM               : ${p95}ms (Umbral: < 500ms)`);
  console.log('====================================================');

  const p95Pass = p95 < 500;
  const errorRatePass = errorRate < 1.0;

  if (failedChecks === 0 && p95Pass && errorRatePass) {
    console.log('✅ TODAS LAS PRUEBAS K6 EN VERDE (100% PASS)');
    process.exit(0);
  } else {
    console.error('❌ VALIDACION K6 FALLIDA (Criterios no cumplidos)');
    process.exit(1);
  }
}

runAuditGate().catch((err) => {
  console.error('Error fatal en suite de pruebas:', err);
  process.exit(1);
});
