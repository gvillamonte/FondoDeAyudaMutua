async function test() {
  const baseUrl = 'http://localhost:3001/api/actualizacion-datos';
  
  console.log('1. Probando catálogos...');
  const catRes = await fetch(`${baseUrl}/catalogos`);
  const cat = await catRes.json();
  console.log(`✓ Catálogos obtenidos: ${cat.ubigeos?.length || 0} ubigeos, ${cat.estadosCiviles?.length || 0} estados civiles.`);

  console.log('2. Verificando CIP 168503...');
  const verRes = await fetch(`${baseUrl}/verificar-cip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cip: '168503' })
  });
  const verData = await verRes.json();
  console.log(`✓ CIP verificado: ${verData.nombreEnmascarado} (Habilitado: ${verData.habilitado})`);

  console.log('3. Consultando datos con CIP y DNI 44187939...');
  const conRes = await fetch(`${baseUrl}/consultar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cip: '168503', dni: '44187939' })
  });
  const conData = await conRes.json();
  console.log(`✓ Datos obtenidos: ${conData.nombreCompleto}`);
  console.log(`  Departamento: ${conData.departamento || '(vacío)'}`);
  console.log(`  Provincia: ${conData.provincia || '(vacío)'}`);
  console.log(`  Distrito: ${conData.distrito || '(vacío)'}`);
  console.log(`  Dirección: ${conData.direccion || '(vacío)'}`);
  console.log(`  Referencia: ${conData.referencia || '(vacío)'}`);
  console.log(`  Estado Civil: ${conData.estadoCivil || '(vacío)'}`);

  console.log('4. Probando actualización con departamento, provincia, distrito, referencia y estado civil...');
  const actRes = await fetch(`${baseUrl}/actualizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cip: '168503',
      dni: '44187939',
      email: 'abel.gutierrez@cip.org.pe',
      celular: '984555888',
      departamento: 'CUSCO',
      provincia: 'CUSCO',
      distrito: 'WANCHAQ',
      direccion: 'PSJ. INCA GARCILASO DE LA VEGA E1-22',
      referencia: 'A espaldas del parque Marianito Ferro, portón blanco',
      estadoCivil: 'Soltero(a)',
      sexo: 'M'
    })
  });
  const actData = await actRes.json();
  console.log(`✓ Actualización completada:`, actData.message || actData);
  console.log(`  Guardado con ID: ${actData.data?.id}`);
  console.log(`  Distrito guardado: ${actData.data?.distrito}`);
  console.log(`  Referencia guardada: ${actData.data?.referencia}`);
  console.log(`  Estado Civil guardado: ${actData.data?.estadoCivil}`);
}

test().catch(console.error);
