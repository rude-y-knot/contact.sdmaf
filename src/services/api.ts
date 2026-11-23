import type { CompanySettings, Employee } from '../types';

// In-memory Bearer session token (never persisted to localStorage/sessionStorage)
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401 && authToken) {
    authToken = null;
  }

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    let message = `Ошибка запроса (${res.status})`;
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => null);
      if (data?.error) message = data.error;
    }
    throw new ApiError(message, res.status);
  }

  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export interface AuthStatusResponse {
  needsSetup: boolean;
  authSource: 'env' | 'db' | 'none';
  authenticated: boolean;
}

export const api = {
  getAuthStatus(): Promise<AuthStatusResponse> {
    return apiFetch<AuthStatusResponse>('/api/auth/status');
  },

  async setupAdminPassword(password: string): Promise<{ token: string; expiresAt: string }> {
    const data = await apiFetch<{ token: string; expiresAt: string }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async login(password: string): Promise<{ token: string; expiresAt: string }> {
    const data = await apiFetch<{ token: string; expiresAt: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthToken(null);
    }
  },

  getPublicCard(id: string): Promise<{ employee: Employee; settings: CompanySettings }> {
    return apiFetch<{ employee: Employee; settings: CompanySettings }>(
      `/api/cards/${encodeURIComponent(id)}`
    );
  },

  getPublicSettings(): Promise<CompanySettings> {
    return apiFetch<CompanySettings>('/api/settings/public');
  },

  getEmployees(): Promise<{ employees: Employee[]; settings: CompanySettings }> {
    return apiFetch<{ employees: Employee[]; settings: CompanySettings }>('/api/employees');
  },

  createEmployee(payload: Omit<Employee, 'id'> & { id?: string }): Promise<{ employee: Employee }> {
    return apiFetch<{ employee: Employee }>('/api/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateEmployee(id: string, payload: Omit<Employee, 'id'>): Promise<{ employee: Employee }> {
    return apiFetch<{ employee: Employee }>(`/api/employees/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  setEmployeeArchive(id: string, isActive: boolean): Promise<{ employee: Employee }> {
    return apiFetch<{ employee: Employee }>(
      `/api/employees/${encodeURIComponent(id)}/archive`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }
    );
  },

  deleteEmployee(id: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>(`/api/employees/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  reorderEmployees(items: Array<{ id: string; sortOrder: number }>): Promise<{ employees: Employee[] }> {
    return apiFetch<{ employees: Employee[] }>('/api/employees/reorder', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  importCsvEmployees(
    employees: Array<Omit<Employee, 'id'> & { id?: string }>,
    replaceAll = false
  ): Promise<{ created: number; updated: number; employees: Employee[] }> {
    return apiFetch<{ created: number; updated: number; employees: Employee[] }>(
      '/api/employees/import-csv',
      {
        method: 'POST',
        body: JSON.stringify({ employees, replaceAll }),
      }
    );
  },

  async exportCsvFile(): Promise<Blob> {
    const headers = new Headers();
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
    const res = await fetch('/api/employees/export-csv', { headers });
    if (!res.ok) {
      throw new ApiError('Не удалось выгрузить CSV.', res.status);
    }
    return res.blob();
  },

  updateSettings(settings: CompanySettings): Promise<{ settings: CompanySettings }> {
    return apiFetch<{ settings: CompanySettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
};
