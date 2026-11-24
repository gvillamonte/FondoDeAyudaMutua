import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:3001/api';
const prisma = new PrismaClient();

interface TestStep {
  name: string;
  status: 'PASSED' | 'FAILED';
  details: string;
  durationMs: number;
}

const steps: TestStep[] = [];

async function recordStep(name: string, fn: () => Promise<string>) {
  const start = Date.now();
  try {
    const details = await fn();
    const duration = Date.now() - start;
    steps.push({ name, status: 'PASSED', details, durationMs: duration });
    console.log(`[PASS] ${name} (${duration}ms): ${details}`);
  } catch (err: any) {
    const duration = Date.now() - start;
    const errorMsg = err.message || JSON.stringify(err);
    steps.push({ name, status: 'FAILED', details: errorMsg, durationMs: duration });
    console.error(`[FAIL] ${name} (${duration}ms): ${errorMsg}`);
  }
}

async function runTraceabilitySuite() {
  console.log('===============================================================');
  console.log('INICIANDO BATERÍA DE PRUEBAS DE TRAZABILIDAD Y REGRESIÓN (E2E)');
  console.log(`Fecha: ${new Date().toISOString()} | Target: ${API_BASE}`);
  console.log('===============================================================\n');

  // PASO 1: Catálogos públicos
  await recordStep('1. Consulta de Catálogos (Ubigeos y Estados Civiles)', async () => {
    const res = await fetch(`${API_BASE}/actualizacion-datos/catalogos`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data: any = await res.json();
    if (!data.ubigeos || data.ubigeos.length === 0) {
      throw new Error('No se retornaron ubigeos');
    }
    return `Recibidos ${data.ubigeos.length} ubigeos y ${data.estadosCiviles?.length || 0} estados civiles. HTTP 200.`;
  });

  // PASO 2: Verificación de CIP (Paso 1 del Portal)
  await recordStep('2. Verificación de Existencia de CIP (Paso 1)', async () => {
    const res = await fetch(`${API_BASE}/actualizacion-datos/verificar-cip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cip: '15549' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data: any = await res.json();
    if (!data.valido) {
      throw new Error('El CIP 15549 debería ser válido en el padrón');
    }
    return `CIP 15549 validado: valido=${data.valido}, cip=${data.cip}, nombreEnmascarado=${data.nombreEnmascarado}. HTTP 201.`;
  });

  // PASO 3: Consulta DNI estándar
  await recordStep('3. Consulta Colegiado por CIP y DNI Estándar', async () => {
    const res = await fetch(`${API_BASE}/actualizacion-datos/consultar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cip: '15549', dni: '23962567' }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data: any = await res.json();
    if (data.dni !== '23962567' || !data.nombres) {
      throw new Error('Datos de colegiado incompletos');
    }
    return `Colegiado recuperado: ${data.nombreCompleto}, Especialidad: ${data.especialidad}.`;
  });

  // PASO 4: Robustez ante ceros a la izquierda y espacios
  await recordStep('4. Consulta con Ceros a la Izquierda y Espacios (Robustez)', async () => {
    const res = await fetch(`${API_BASE}/actualizacion-datos/consultar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cip: ' 015549 ',
        dni: ' 23962567 ',
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText}`);
    }
    const data: any = await res.json();
    if (data.cip !== '15549') {
      throw new Error('Fallo la normalización de CIP con ceros o espacios');
    }
    return `Normalización exitosa: CIP recibido='15549', Nombre=${data.nombreCompleto}.`;
  });

  // PASO 5: Colegiado extranjero con Carnet de Extranjería
  await recordStep('5. Consulta con Carnet de Extranjería (CE)', async () => {
    const res = await fetch(`${API_BASE}/actualizacion-datos/consultar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cip: '1801',
        dni: '1241131', // En la base de datos está como 001241131
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data: any = await res.json();
    if (data.tipoDocumento !== 'CE') {
      throw new Error(`Esperado tipoDocumento='CE', recibido='${data.tipoDocumento}'`);
    }
    return `Carnet de Extranjería resuelto: ${data.nombreCompleto}, Tipo: ${data.tipoDocumentoNombre}.`;
  });

  // PASO 6: Trazabilidad Completa de Actualización de Datos (Fusión + Persistencia)
  const testCip = '15549';
  const testDni = '23962567';
  const timestamp = Date.now();
  const testEmail = `colegiado.update.${timestamp}@cipcusco.org.pe`;
  const testCelular = '+51 984123456';
  const testDireccion = `Av. De La Cultura ${Math.floor(Math.random() * 900 + 100)}`;

  await recordStep('6. Envío de Actualización con Teléfono Internacional y Validación', async () => {
    const res = await fetch(`${API_BASE}/actualizacion-datos/actualizar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cip: testCip,
        dni: testDni,
        email: testEmail,
        celular: testCelular,
        fechaNacimiento: '1942-07-08',
        sexo: 'M',
        direccion: testDireccion,
        referencia: 'Frente al campus universitario',
        departamento: 'CUSCO',
        provincia: 'CUSCO',
        distrito: 'SAN SEBASTIAN',
        estadoCivil: 'Conviviente',
        aceptoTerminos: true,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`HTTP ${res.status}: ${errBody}`);
    }
    const data: any = await res.json();
    if (!data.success) {
      throw new Error(`Respuesta no exitosa: ${JSON.stringify(data)}`);
    }
    return `Actualización registrada exitosamente. ActualizacionId=${data.actualizacionId || 'OK'}.`;
  });

  // PASO 7: Verificación de Trazabilidad en APP_DB (Prisma)
  await recordStep('7. Trazabilidad en APP_DB (Persistencia Inmutable)', async () => {
    const registro = await prisma.colegiadoActualizacion.findFirst({
      where: { emailNuevo: testEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (!registro) {
      throw new Error('No se encontró el registro en la tabla colegiado_actualizaciones de APP_DB');
    }
    if (registro.celularNuevo?.replace(/\s+/g, '') !== testCelular.replace(/\s+/g, '')) {
      throw new Error(`El celular almacenado (${registro.celularNuevo}) no coincide con el enviado (${testCelular})`);
    }

    return `Registro verificado en APP_DB: id=${registro.id}, cip=${registro.cip}, celularNuevo=${registro.celularNuevo}, emailNuevo=${registro.emailNuevo}, timestamp=${registro.createdAt.toISOString()}`;
  });

  // PASO 8: Verificación de Fusión de Datos en Consulta Posterior
  await recordStep('8. Verificación de Fusión de Datos en Consultas Futuras', async () => {
    const res = await fetch(`${API_BASE}/actualizacion-datos/consultar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cip: testCip, dni: testDni }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    if (data.email !== testEmail) {
      throw new Error(`El email retornado (${data.email}) no refleja la versión actualizada (${testEmail})`);
    }
    if (!data.tieneActualizacionPrevia) {
      throw new Error('tieneActualizacionPrevia debería ser true');
    }
    return `Fusión validada: el portal presenta automáticamente los datos actualizados (${data.email}, ${data.celular}) y tieneActualizacionPrevia=true.`;
  });

  // PASO 9: Verificación de No Regresión en Módulos Protegidos y Health Check
  await recordStep('9. Verificación de No Regresión: Health Check del Backend', async () => {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    return `Health Check operativo: status=${data.status || 'OK'}. HTTP 200.`;
  });

  await recordStep('10. Verificación de No Regresión: Seguridad y RBAC en Módulos de Beneficios', async () => {
    // Probar que los módulos protegidos por JWT sigan respondiendo 401 Unauthorized sin token
    const resColegiados = await fetch(`${API_BASE}/colegiados/search?limit=1`);
    const resPagos = await fetch(`${API_BASE}/pagos`);
    const resFamCovid = await fetch(`${API_BASE}/fam-covid`);

    if (resColegiados.status !== 401 && resColegiados.status !== 403) {
      throw new Error(`Colegiados no está debidamente protegido: HTTP ${resColegiados.status}`);
    }
    if (resPagos.status !== 401 && resPagos.status !== 403) {
      throw new Error(`Pagos no está debidamente protegido: HTTP ${resPagos.status}`);
    }
    if (resFamCovid.status !== 401 && resFamCovid.status !== 403) {
      throw new Error(`Fam-covid no está debidamente protegido: HTTP ${resFamCovid.status}`);
    }

    return `Guards y RBAC operativos: /colegiados/search (HTTP ${resColegiados.status}), /pagos (HTTP ${resPagos.status}), /fam-covid (HTTP ${resFamCovid.status}).`;
  });

  console.log('\n===============================================================');
  console.log('RESUMEN DE PRUEBAS DE TRAZABILIDAD:');
  const allPassed = steps.every((s) => s.status === 'PASSED');
  console.log(`TOTAL PRUEBAS: ${steps.length} | PASARON: ${steps.filter((s) => s.status === 'PASSED').length} | FALLARON: ${steps.filter((s) => s.status === 'FAILED').length}`);
  console.log(`ESTADO GLOBAL: ${allPassed ? '✅ TODOS LOS TESTS PASARON EXITOSAMENTE' : '❌ HUBO FALLOS EN LAS PRUEBAS'}`);
  console.log('===============================================================\n');

  await prisma.$disconnect();
  process.exit(allPassed ? 0 : 1);
}

runTraceabilitySuite().catch(async (e) => {
  console.error('Error fatal durante la suite de trazabilidad:', e);
  await prisma.$disconnect();
  process.exit(1);
});
