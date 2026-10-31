import {
  closePoolSafely,
  isLegacyRetryableError,
  queryWithLegacyRetry,
  startLegacyKeepalive,
} from './legacy-sql.helper';

describe('isLegacyRetryableError', () => {
  it('reintenta el timeout de consulta aunque msnodesqlv8 lo marque como EREQUEST', () => {
    // Regresion: el driver ODBC envuelve el timeout como EREQUEST y antes se
    // descartaba, dejando el pool envenenado y los buscadores en 500.
    expect(
      isLegacyRetryableError({
        code: 'EREQUEST',
        message: '[Microsoft][ODBC Driver 18 for SQL Server]Query timeout expired',
      }),
    ).toBe(true);
  });

  it('reintenta el codigo ETIMEOUT', () => {
    expect(isLegacyRetryableError({ code: 'ETIMEOUT', message: 'timeout' })).toBe(true);
  });

  it('no reintenta errores de SQL (EREQUEST sin timeout)', () => {
    expect(
      isLegacyRetryableError({ code: 'EREQUEST', message: "Invalid object name 'TColegiado'." }),
    ).toBe(false);
  });

  it('no reintenta errores de parametros (EINPUT)', () => {
    expect(isLegacyRetryableError({ code: 'EINPUT', message: 'Invalid input parameter' })).toBe(
      false,
    );
  });

  it('reintenta fallos de conexion del pool', () => {
    for (const code of ['ENOTOPEN', 'ESOCKET', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT']) {
      expect(isLegacyRetryableError({ code, message: 'x' })).toBe(true);
    }
  });

  it('reintenta mensajes de conexion cerrada', () => {
    expect(isLegacyRetryableError(new Error('Connection is closed.'))).toBe(true);
    expect(isLegacyRetryableError(new Error('socket hang up'))).toBe(true);
  });

  it('no revienta con errores vacios', () => {
    expect(isLegacyRetryableError({})).toBe(false);
    expect(isLegacyRetryableError(null)).toBe(false);
  });
});

describe('queryWithLegacyRetry', () => {
  it('reconecta y reintenta una vez despues de un timeout', async () => {
    const execute = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Query timeout expired'), { code: 'EREQUEST' }),
      )
      .mockResolvedValueOnce({ recordset: [] });
    const reconnect = jest.fn().mockResolvedValue(undefined);
    const onRetry = jest.fn();

    await expect(queryWithLegacyRetry(execute, reconnect, onRetry)).resolves.toEqual({
      recordset: [],
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('no reconecta ante un error de SQL', async () => {
    const error = Object.assign(new Error("Invalid column name 'foo'."), { code: 'EREQUEST' });
    const execute = jest.fn().mockRejectedValue(error);
    const reconnect = jest.fn();

    await expect(queryWithLegacyRetry(execute, reconnect, jest.fn())).rejects.toBe(error);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('propaga el error si el reintento tambien falla', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('Query timeout expired'));
    const reconnect = jest.fn().mockResolvedValue(undefined);

    await expect(queryWithLegacyRetry(execute, reconnect, jest.fn())).rejects.toThrow(
      'Query timeout expired',
    );

    expect(execute).toHaveBeenCalledTimes(2);
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('devuelve el resultado al primer intento sin reconectar', async () => {
    const execute = jest.fn().mockResolvedValue('ok');
    const reconnect = jest.fn();

    await expect(queryWithLegacyRetry(execute, reconnect, jest.fn())).resolves.toBe('ok');
    expect(reconnect).not.toHaveBeenCalled();
  });
});

describe('closePoolSafely', () => {
  it('no bloquea si el pool nunca termina de cerrar', async () => {
    jest.useFakeTimers();
    try {
      const pool = { close: jest.fn(() => new Promise<void>(() => undefined)) };
      const cierre = closePoolSafely(pool, 1000);

      await Promise.resolve();
      jest.advanceTimersByTime(1000);

      await expect(cierre).resolves.toBeUndefined();
      expect(pool.close).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignora los errores del cierre', async () => {
    await expect(
      closePoolSafely({ close: () => Promise.reject(new Error('boom')) }),
    ).resolves.toBeUndefined();
  });

  it('acepta un pool nulo', async () => {
    await expect(closePoolSafely(null)).resolves.toBeUndefined();
  });
});

describe('startLegacyKeepalive', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('ejecuta el ping en cada intervalo', async () => {
    const ping = jest.fn().mockResolvedValue(undefined);
    const timer = startLegacyKeepalive(ping, jest.fn(), 1000);

    await jest.advanceTimersByTimeAsync(3000);

    expect(ping).toHaveBeenCalledTimes(3);
    clearInterval(timer);
  });

  it('reporta el error sin detener el intervalo', async () => {
    const ping = jest.fn().mockRejectedValue(new Error('ping fallo'));
    const onError = jest.fn();
    const timer = startLegacyKeepalive(ping, onError, 1000);

    await jest.advanceTimersByTimeAsync(2000);

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0][0].message).toBe('ping fallo');
    clearInterval(timer);
  });

  it('deja de ejecutar pings al limpiar el intervalo', async () => {
    const ping = jest.fn().mockResolvedValue(undefined);
    const timer = startLegacyKeepalive(ping, jest.fn(), 1000);

    await jest.advanceTimersByTimeAsync(1000);
    clearInterval(timer);
    await jest.advanceTimersByTimeAsync(5000);

    expect(ping).toHaveBeenCalledTimes(1);
  });
});
