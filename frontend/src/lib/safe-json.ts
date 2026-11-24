/**
 * Error HTTP detallado para facilitar diagnóstico de conexión y respuestas erróneas del servidor.
 */
export class ApiHttpError extends Error {
  status: number;
  statusText: string;
  url: string;
  responseBody: string;
  isConnectionError: boolean;
  isHttpError = true;

  constructor(
    message: string,
    details: {
      status: number;
      statusText: string;
      url: string;
      responseBody: string;
      isConnectionError?: boolean;
    },
  ) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = details.status;
    this.statusText = details.statusText;
    this.url = details.url;
    this.responseBody = details.responseBody;
    this.isConnectionError =
      details.isConnectionError ??
      (details.status === 500 ||
        details.status === 502 ||
        details.status === 503 ||
        details.status === 504 ||
        details.status === 0);
  }
}

/**
 * Parsea la respuesta de un fetch de forma segura.
 * Si el backend/Next proxy no responde JSON (ej. texto plano
 * "Internal Server Error" cuando el backend esta caido o proxy falla),
 * lanza un ApiHttpError con información técnica para diagnóstico en pantalla.
 */
export async function parseJsonSafe<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.length > 500 ? text.substring(0, 500) + '...' : text;
    const isConnErr =
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504 ||
      text.includes('ECONNREFUSED') ||
      text.includes('Internal Server Error') ||
      text.includes('Bad Gateway');

    const message = isConnErr
      ? `Error al conectar con el servidor (HTTP ${response.status} ${response.statusText || 'Error de conexión'}). Verifique que el backend esté activo.`
      : `El servidor respondió con código HTTP ${response.status} (${response.statusText || 'Error'}), pero no devolvió JSON válido.`;

    throw new ApiHttpError(message, {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      responseBody: snippet || '(Cuerpo de respuesta vacío)',
      isConnectionError: isConnErr,
    });
  }
}
