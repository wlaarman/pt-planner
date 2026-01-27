import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// Use relative path for Vercel - API routes are at /api/*
const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  register: async (email: string, password: string, name: string) => {
    const { data } = await api.post('/auth/register', { email, password, name });
    return data;
  },
  me: async () => {
    const { data } = await api.get('/auth/me');
    return data;
  },
};

// Trainers API
export const trainersApi = {
  getAll: async () => {
    const { data } = await api.get('/trainers');
    return data;
  },
  getOne: async (id: string) => {
    const { data } = await api.get(`/trainers/${id}`);
    return data;
  },
  create: async (trainer: any) => {
    const { data } = await api.post('/trainers', trainer);
    return data;
  },
  update: async (id: string, trainer: any) => {
    const { data } = await api.put(`/trainers/${id}`, trainer);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/trainers/${id}`);
  },
};

// Participants API
export const participantsApi = {
  getAll: async (search?: string) => {
    const params = search ? { search } : {};
    const { data } = await api.get('/participants', { params });
    return data;
  },
  getOne: async (id: string) => {
    const { data } = await api.get(`/participants/${id}`);
    return data;
  },
  create: async (participant: any) => {
    const { data } = await api.post('/participants', participant);
    return data;
  },
  update: async (id: string, participant: any) => {
    const { data } = await api.put(`/participants/${id}`, participant);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/participants/${id}`);
  },
};

// Training Types API
export const trainingTypesApi = {
  getAll: async () => {
    const { data } = await api.get('/training-types');
    return data;
  },
  getOne: async (id: string) => {
    const { data } = await api.get(`/training-types/${id}`);
    return data;
  },
  create: async (type: any) => {
    const { data } = await api.post('/training-types', type);
    return data;
  },
  update: async (id: string, type: any) => {
    const { data } = await api.put(`/training-types/${id}`, type);
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/training-types/${id}`);
  },
};

// Appointments API
export const appointmentsApi = {
  getAll: async (start?: string, end?: string, trainerId?: string) => {
    const params: any = {};
    if (start) params.start = start;
    if (end) params.end = end;
    if (trainerId) params.trainerId = trainerId;
    const { data } = await api.get('/appointments', { params });
    return data;
  },
  getOne: async (id: string) => {
    const { data } = await api.get(`/appointments/${id}`);
    return data;
  },
  create: async (appointment: any) => {
    const { data } = await api.post('/appointments', appointment);
    return data;
  },
  update: async (id: string, appointment: any) => {
    const { data } = await api.put(`/appointments/${id}`, appointment);
    return data;
  },
  delete: async (id: string, deleteSeries?: boolean) => {
    const params = deleteSeries ? { deleteSeries: 'true' } : {};
    await api.delete(`/appointments/${id}`, { params });
  },
  updateStatus: async (id: string, status: string) => {
    const { data } = await api.patch(`/appointments/${id}`, { status });
    return data;
  },
};

// Reports API
export const reportsApi = {
  get: async (params: {
    participantId?: string;
    trainerId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const { data } = await api.get('/reports', { params });
    return data;
  },
  getParticipants: async () => {
    const { data } = await api.get('/reports/participants');
    return data;
  },
};

// Calendar API (iCal integration)
export const calendarApi = {
  getSettings: async () => {
    const { data } = await api.get('/calendar/ical');
    return data;
  },
  updateSettings: async (settings: { icalUrl?: string | null; showIcalEvents?: boolean }) => {
    const { data } = await api.put('/calendar/ical', settings);
    return data;
  },
  getEvents: async (start: string, end: string) => {
    const { data } = await api.get('/calendar/ical', { params: { start, end } });
    return data;
  },
  disconnect: async () => {
    await api.delete('/calendar/ical');
  },
};

// Invoices API
export const invoicesApi = {
  getAll: async (status?: string, participantId?: string) => {
    const params: any = {};
    if (status) params.status = status;
    if (participantId) params.participantId = participantId;
    const { data } = await api.get('/invoices', { params });
    return data;
  },
  getStats: async () => {
    const { data } = await api.get('/invoices/stats');
    return data;
  },
  getOne: async (id: string) => {
    const { data } = await api.get(`/invoices/${id}`);
    return data;
  },
  create: async (invoice: any) => {
    const { data } = await api.post('/invoices', invoice);
    return data;
  },
  updateStatus: async (id: string, status: string) => {
    const { data } = await api.patch(`/invoices/${id}/status`, { status });
    return data;
  },
  delete: async (id: string) => {
    await api.delete(`/invoices/${id}`);
  },
  getBillable: async (start: string, end: string, trainerId?: string, participantId?: string) => {
    const params: Record<string, string> = { start, end };
    if (trainerId) params.trainerId = trainerId;
    if (participantId) params.participantId = participantId;
    const { data } = await api.get('/invoices/billable', { params });
    return data;
  },
  generate: async (params: {
    participantIds: string[];
    periodStart: string;
    periodEnd: string;
    taxRate?: number;
    dueDays?: number;
  }) => {
    const { data } = await api.post('/invoices/generate', params);
    return data;
  },
};
