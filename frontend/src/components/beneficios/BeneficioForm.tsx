'use client';

import { useState } from 'react';
import ColegiadoSearch from './ColegiadoSearch';
import Button from '../ui/Button';

interface BeneficioFormProps {
  beneficio?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function BeneficioForm({ beneficio, onSubmit, onCancel, loading }: BeneficioFormProps) {
  const [selectedColegiado, setSelectedColegiado] = useState<any>(null);
  const [formData, setFormData] = useState({
    motivo: '',
    montoSolicitado: beneficio?.montoBase || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedColegiado) return;

    onSubmit({
      beneficioId: beneficio?.id,
      colegiadoId: selectedColegiado.COLEGIADO_ID,
      montoSolicitado: formData.montoSolicitado,
      motivo: formData.motivo,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label-field">Colegiado *</label>
        <ColegiadoSearch
          onSelect={setSelectedColegiado}
          selectedColegiado={selectedColegiado}
        />
      </div>

      {beneficio && (
        <div className="p-3 bg-bg-layout rounded-lg border border-border-main">
          <p className="text-sm text-text-sec">Beneficio seleccionado</p>
          <p className="font-medium text-text-main">{beneficio.nombre}</p>
          <p className="text-sm text-text-sec">
            Tipo: {beneficio.tipo} | Monto base: S/ {beneficio.montoBase}
          </p>
        </div>
      )}

      <div>
        <label className="label-field">Monto Solicitado (S/) *</label>
        <input
          type="number"
          step="0.01"
          min="0"
          max={beneficio?.montoBase || 999999}
          value={formData.montoSolicitado}
          onChange={(e) => setFormData({ ...formData, montoSolicitado: parseFloat(e.target.value) })}
          className="input-field"
          required
        />
      </div>

      <div>
        <label className="label-field">Motivo de la Solicitud *</label>
        <textarea
          value={formData.motivo}
          onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
          className="input-field"
          rows={3}
          placeholder="Describa el motivo de la solicitud..."
          required
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border-main">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading} disabled={!selectedColegiado}>
          Registrar Solicitud
        </Button>
      </div>
    </form>
  );
}
