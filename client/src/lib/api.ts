import type { ApiResponse, ApiSuccess } from '@shared/api';

function parseErrorBody(body: Record<string, unknown> | null, status: number): string {
  if (!body) return `HTTP ${status}`;
  if (typeof body.error === 'string') return body.error;
  if (body.errorDetail && typeof (body.errorDetail as Record<string, unknown>).message === 'string') {
    return (body.errorDetail as Record<string, unknown>).message as string;
  }
  return `HTTP ${status}`;
}

function unwrap<T>(body: ApiResponse<T> | T): T {
  const b = body as unknown as Record<string, unknown>;
  if (b && typeof b === 'object' && b.success === true && 'data' in b) {
    return (body as ApiSuccess<T>).data;
  }
  return body as T;
}

interface RequestOptions {
  headers?: Record<string, string>;
  body?: string | FormData;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`/api${path}`);
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(parseErrorBody(body, res.status));
    return unwrap<T>(body);
  },

  async post<T>(path: string, payload?: unknown): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: payload !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(parseErrorBody(body, res.status));
    return unwrap<T>(body);
  },

  async put<T>(path: string, payload: unknown): Promise<T> {
    const res = await fetch(`/api${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(parseErrorBody(body, res.status));
    return unwrap<T>(body);
  },

  async del<T>(path: string): Promise<T> {
    const res = await fetch(`/api${path}`, { method: 'DELETE' });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(parseErrorBody(body, res.status));
    return unwrap<T>(body);
  },

  async upload(file: File): Promise<{ filename: string; size: number }> {
    const form = new FormData();
    form.append('zip', file);
    const res = await fetch('/api/update/upload', { method: 'POST', body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(parseErrorBody(body, res.status));
    return unwrap(body);
  },

  async uploadTo<T = { success: boolean }>(path: string, file: File, fieldName = 'file'): Promise<T> {
    const form = new FormData();
    form.append(fieldName, file);
    const res = await fetch(`/api${path}`, { method: 'POST', body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(parseErrorBody(body, res.status));
    return unwrap<T>(body);
  },
};
