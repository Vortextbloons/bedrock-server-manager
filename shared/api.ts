export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: string;
  errorDetail: { message: string; code: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function parseApiError(body: unknown): string {
  if (!body) return 'Unknown error';
  const b = body as Record<string, unknown>;
  if (typeof b.error === 'string') return b.error;
  if (b.errorDetail && typeof (b.errorDetail as Record<string, unknown>).message === 'string') {
    return (b.errorDetail as Record<string, unknown>).message as string;
  }
  return 'Unknown error';
}

export function isApiSuccess<T>(body: unknown): body is ApiSuccess<T> {
  return (
    body !== null &&
    typeof body === 'object' &&
    (body as Record<string, unknown>).success === true &&
    'data' in (body as Record<string, unknown>)
  );
}
