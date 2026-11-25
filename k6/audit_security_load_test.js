import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.TARGET_URL || 'http://18.191.81.201:3001';
const OPERATOR_USER = __ENV.OPERATOR_USER || 'operador1';
const OPERATOR_PASS = __ENV.OPERATOR_PASS || 'Admin123!';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '5s', target: 5 },
    { duration: '10s', target: 10 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{endpoint:fam_beneficios}': ['p(95)<500'],
    errors: ['rate<0.01'],
  },
};

export function setup() {
  // Autenticar operador para obtener JWT de prueba
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: OPERATOR_USER, password: OPERATOR_PASS }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const loginSuccess = check(loginRes, {
    'login operador exitoso (200)': (r) => r.status === 200,
  });

  if (!loginSuccess) {
    console.warn(`No se pudo autenticar al operador: status ${loginRes.status}`);
    return { token: null };
  }

  const json = loginRes.json();
  const token = json.accessToken || (json.data && json.data.accessToken);
  return { token };
}

export default function (data) {
  // 1. Verificación P1: POST /api/auth/register anónimo debe ser 401 o 403 (ya no 200/201)
  const regPayload = JSON.stringify({
    username: `testuser_${__VU}_${__ITER}`,
    email: `testuser_${__VU}_${__ITER}@cipcusco.org.pe`,
    password: 'Password123!',
    nombreCompleto: 'Intento Registro Ilegitimo',
    rol: 'ADMINISTRADOR',
  });

  const regRes = http.post(`${BASE_URL}/api/auth/register`, regPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'auth_register' },
  });

  const regBlocked = check(regRes, {
    'P1: POST /api/auth/register denegado (401 o 403)': (r) => r.status === 401 || r.status === 403,
  });
  errorRate.add(!regBlocked);

  // 2. Verificación P4: GET /api/roles con usuario sin rol admin debe ser 403
  if (data.token) {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    };

    const rolesRes = http.get(`${BASE_URL}/api/roles`, {
      headers: authHeaders,
      tags: { endpoint: 'roles_unauthorized' },
    });

    const rolesForbidden = check(rolesRes, {
      'P4: GET /api/roles denegado a no-admin (403)': (r) => r.status === 403,
    });
    errorRate.add(!rolesForbidden);

    // 3. Verificación de Salud Operativa: GET /api/fam-beneficios debe responder 200
    const famRes = http.get(`${BASE_URL}/api/fam-beneficios?limit=10`, {
      headers: authHeaders,
      tags: { endpoint: 'fam_beneficios' },
    });

    const famOk = check(famRes, {
      'FAM: GET /api/fam-beneficios responde 200': (r) => r.status === 200,
    });
    errorRate.add(!famOk);
  }

  sleep(0.5);
}
