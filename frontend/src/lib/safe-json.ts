/**
 * Parsea la respuesta de un fetch de forma segura.
 * Si el backend/Next proxy no responde JSON (ej. texto plano
 * "Internal Server Error" cuando el backend esta caido), lanza un
 * Error con mensaje claro en vez de fallar el JSON.parse.
 */
export async function parseJsonSafe<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (!response.ok) {
      throw new Error('El servidor no esta disponible. Intente nuevamente en unos segundos.');
    }
    throw new Error('Respuesta invalida del servidor. Verifique que el backend este activo.');
  }
}
