'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

interface FilaExcel {
  CIP: string;
  DNI_COLEGIADO: string;
  NOMBRE_BENEFICIARIO: string;
  DNI_BENEFICIARIO: string;
  PARENTESCO: string;
  PORCENTAJE: number;
  observaciones?: string;
  _fila: number;
  _error?: string;
  _status?: 'ok' | 'error' | 'pendiente';
}

const PARENTESCO_MAP: Record<string, string> = {
  'CONYUGUE': 'Conyugue', 'CONYUGE': 'Conyugue',
  'MADRE': 'Madre',
  'PADRE': 'Padre',
  'HIJO': 'Hijo(a)', 'HIJA': 'Hijo(a)', 'HIJO(A)': 'Hijo(a)',
  'HERMANO': 'Hermano(a)', 'HERMANA': 'Hermano(a)', 'HERMANO(A)': 'Hermano(a)',
  'TIO': 'Tio(a)', 'TIA': 'Tio(a)', 'TIO(A)': 'Tio(a)',
  'PRIMO': 'Primo(a)', 'PRIMA': 'Primo(a)', 'PRIMO(A)': 'Primo(a)',
  'ABUELO': 'Abuelo(a)', 'ABUELA': 'Abuelo(a)', 'ABUELO(A)': 'Abuelo(a)',
  'OTROS': 'Otros',
};

export default function CargaMasivaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<FilaExcel[]>([]);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{ ok: number; error: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

        const parsed: FilaExcel[] = raw.map((row, idx) => {
          const cip = String(row['CIP'] || row['NUM_COLEGIATURA'] || '').trim();
          const dniCol = String(row['DNI_COLEGIADO'] || row['DNI'] || '').trim();
          const nombre = String(row['NOMBRE_BENEFICIARIO'] || row['NOMBRE'] || '').trim();
          const dniBen = String(row['DNI_BENEFICIARIO'] || row['DNI_BEN'] || '').trim();
          const parentescoRaw = String(row['PARENTESCO'] || '').trim().toUpperCase();
          const porcentaje = Number(row['PORCENTAJE'] || row['PORC'] || 0);
          const obs = String(row['OBSERVACIONES'] || row['OBS'] || '').trim();

          const parentescoNormalizado = PARENTESCO_MAP[parentescoRaw] || parentescoRaw;
          const parentescosValidos = Object.values(PARENTESCO_MAP);
          const hasError = !cip || !nombre || !parentescoNormalizado || !parentescosValidos.includes(parentescoNormalizado) || porcentaje <= 0 || porcentaje > 100;

          return {
            CIP: cip,
            DNI_COLEGIADO: dniCol,
            NOMBRE_BENEFICIARIO: nombre,
            DNI_BENEFICIARIO: dniBen,
            PARENTESCO: parentescoNormalizado,
            PORCENTAJE: porcentaje,
            observaciones: obs,
            _fila: idx + 2,
            _error: !cip ? 'CIP requerido' : !nombre ? 'Nombre requerido' : !parentescosValidos.includes(parentescoNormalizado) ? `Parentesco invalido: "${parentescoRaw}"` : porcentaje <= 0 ? 'Porcentaje requerido' : porcentaje > 100 ? 'Porcentaje max 100' : undefined,
            _status: undefined,
          };
        });

        setParsedData(parsed);
        setPreview(true);
      } catch {
        setParsedData([]);
        setPreview(false);
      }
    };
    reader.readAsBinaryString(f);
  };

  const handleUpload = async () => {
    const valid = parsedData.filter((f) => !f._error);
    if (valid.length === 0) return;

    setUploading(true);
    setResults(null);

    const token = localStorage.getItem('accessToken');
    let ok = 0;
    let error = 0;
    const errors: string[] = [];

    for (const fila of valid) {
      try {
        const res = await fetch(`/api/fam/carga-masiva`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            cip: fila.CIP,
            nombre: fila.NOMBRE_BENEFICIARIO,
            dni: fila.DNI_BENEFICIARIO || undefined,
            parentesco: fila.PARENTESCO,
            porcentaje: fila.PORCENTAJE,
            observaciones: fila.observaciones || undefined,
          }),
        });
        if (res.ok) {
          ok++;
        } else {
          let errMsg = 'Error';
          try {
            const err = await res.json();
            errMsg = err.message || err.error || 'Error';
          } catch {
            errMsg = 'Backend no disponible';
          }
          error++;
          errors.push(`Fila ${fila._fila}: ${errMsg}`);
        }
      } catch {
        error++;
        errors.push(`Fila ${fila._fila}: Error de conexion`);
      }
    }

    setResults({ ok, error, errors });
    setUploading(false);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { CIP: '203095', NOMBRE_BENEFICIARIO: 'ROMAN HUAMAN YESSICA', DNI_BENEFICIARIO: '46855200', PARENTESCO: 'HIJO(A)', PORCENTAJE: 50, OBSERVACIONES: '' },
      { CIP: '203095', NOMBRE_BENEFICIARIO: 'ALVAREZ ZEA GERTRUDES', DNI_BENEFICIARIO: '24992188', PARENTESCO: 'OTROS', PORCENTAJE: 50, OBSERVACIONES: '' },
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'Plantilla_Carga_Masiva_FAM.xlsx');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-text-main">Carga Masiva de Beneficiarios FAM</h2>
        <p className="text-text-sec text-sm mt-1">Importar beneficiarios desde un archivo Excel</p>
      </div>

      <div className="bg-white border border-border rounded-lg p-6 space-y-5">
        <div className="flex items-center gap-4">
          <button onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Descargar Plantilla
          </button>

          <div className="flex-1">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
            <button onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Seleccionar Archivo
            </button>
            {file && <span className="ml-3 text-sm text-text-sec">{file.name}</span>}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-sm text-text-sec">
          <p className="font-medium text-text-main mb-1">Formato de la plantilla:</p>
          <p><strong>CIP</strong> (requerido) | <strong>NOMBRE_BENEFICIARIO</strong> (requerido) | <strong>DNI_BENEFICIARIO</strong> | <strong>PARENTESCO</strong> (requerido: Conyugue, Madre, Padre, Hijo(a), Hermano(a), Tio(a), Primo(a), Abuelo(a), Otros) | <strong>PORCENTAJE</strong> (requerido: 0-100) | <strong>OBSERVACIONES</strong></p>
        </div>

        {preview && parsedData.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-main">Vista previa ({parsedData.length} filas)</h3>
              <button onClick={handleUpload} disabled={uploading || parsedData.filter((f) => !f._error).length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {uploading ? (
                  <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Subiendo...</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> Subir Beneficiarios</>
                )}
              </button>
            </div>

            <div className="overflow-x-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-text-sec uppercase">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-text-sec uppercase">CIP</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-text-sec uppercase">Beneficiario</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-text-sec uppercase">DNI</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-text-sec uppercase">Parentesco</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-text-sec uppercase">%</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-text-sec uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {parsedData.map((f, i) => (
                    <tr key={i} className={f._error ? 'bg-red-50' : 'bg-white'}>
                      <td className="px-3 py-2 text-text-sec">{f._fila}</td>
                      <td className="px-3 py-2 font-semibold text-primary">{f.CIP}</td>
                      <td className="px-3 py-2 text-text-main">{f.NOMBRE_BENEFICIARIO}</td>
                      <td className="px-3 py-2 text-text-sec">{f.DNI_BENEFICIARIO || '-'}</td>
                      <td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${f._error && f._error.includes('Parentesco') ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{f.PARENTESCO || '-'}</span></td>
                      <td className="px-3 py-2 text-center font-bold">{f.PORCENTAJE || 0}%</td>
                      <td className="px-3 py-2 text-center">
                        {f._error ? (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            {f._error}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Validado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {results && (
          <div className={`rounded-lg p-4 ${results.error > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
            <h4 className="font-semibold text-sm mb-2">Resultado de la carga:</h4>
            <p className="text-sm">{results.ok} registros subidos exitosamente{results.error > 0 ? `, ${results.error} con errores` : ''}</p>
            {results.errors.length > 0 && (
              <ul className="mt-2 text-xs text-red-600 space-y-1">
                {results.errors.map((e, i) => <li key={i}>- {e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
