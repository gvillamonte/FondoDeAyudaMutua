import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import DataTable from '@/components/ui/DataTable';

const columnas = [{ key: 'DNI', label: 'DNI', sortable: true }];

const montar = (onSearch = vi.fn()) => {
  render(
    <DataTable
      columns={columnas as any}
      data={[]}
      totalItems={0}
      currentPage={1}
      pageSize={25}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
      onSearch={onSearch}
    />,
  );
  return { onSearch, input: screen.getByPlaceholderText(/Buscar por DNI/i) as HTMLInputElement };
};

describe('DataTable - buscador', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('no consulta al servidor en cada tecla (debounce 450ms)', () => {
    const { onSearch, input } = montar();

    fireEvent.change(input, { target: { value: 'v' } });
    fireEvent.change(input, { target: { value: 'va' } });
    fireEvent.change(input, { target: { value: 'val' } });

    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(449);
    });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('val');
  });

  it('mantiene el texto escrito mientras espera la consulta', () => {
    const { input } = montar();
    fireEvent.change(input, { target: { value: 'valdez' } });
    expect(input.value).toBe('valdez');
  });

  it('envia la busqueda vacia al limpiar el campo', () => {
    const { onSearch, input } = montar();

    fireEvent.change(input, { target: { value: 'valdez' } });
    fireEvent.change(input, { target: { value: '' } });

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('');
  });
});
