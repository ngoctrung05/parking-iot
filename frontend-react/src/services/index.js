import apiClient from './api';
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
} from 'date-fns';

export const authService = {
  async login(username, password, rememberMe = false) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('remember_me', rememberMe);

    const response = await apiClient.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    
    if (response.data.access_token) {
      localStorage.setItem('authToken', response.data.access_token);
    }
    
    return response.data;
  },

  logout() {
    localStorage.removeItem('authToken');
  },

  isAuthenticated() {
    return !!localStorage.getItem('authToken');
  },
};

export const slotsService = {
  async getAll() {
    const response = await apiClient.get('/api/slots');
    return response.data;
  },

  async getById(slotId) {
    const response = await apiClient.get(`/api/slots/${slotId}`);
    return response.data;
  },
};

export const cardsService = {
  async getAll() {
    const response = await apiClient.get('/api/cards');
    return response.data;
  },

  async getById(cardUid) {
    const response = await apiClient.get(`/api/cards/${cardUid}`);
    return response.data;
  },

  async create(cardData) {
    const response = await apiClient.post('/api/cards', cardData);
    return response.data;
  },

  async update(cardUid, cardData) {
    const response = await apiClient.put(`/api/cards/${cardUid}`, cardData);
    return response.data;
  },

  async delete(cardUid) {
    const response = await apiClient.delete(`/api/cards/${cardUid}`);
    return response.data;
  },

  async toggleStatus(cardUid, isActive) {
    // Backend does not provide a dedicated /status endpoint; use update
    return this.update(cardUid, { is_active: isActive });
  },

  async getRecentUnknown() {
    const response = await apiClient.get('/api/cards/recent-unknown');
    return response.data;
  },
};

export const logsService = {
  async getAll(params = {}) {
    const response = await apiClient.get('/api/logs', { params });
    return response.data;
  },

  async getRecent(limit = 20) {
    const response = await apiClient.get(`/api/logs/recent?limit=${limit}`);
    return response.data;
  },
};

export const statsService = {
  async get() {
    const response = await apiClient.get('/api/stats');
    return response.data;
  },

  async getRevenueByDay(days = 30) {
    const response = await apiClient.get('/api/stats/revenue-by-day', {
      params: { days },
    });
    return response.data;
  },

  async getUsage(period = 'daily') {
    // Backend doesn't expose a usage aggregation endpoint; build it client-side
    // by querying logs over a recent window.
    const today = new Date();

    const windowDays =
      period === 'weekly' ? 56 : period === 'monthly' ? 365 : 7;

    const start = startOfDay(subDays(today, windowDays - 1));
    const end = endOfDay(today);

    const params = {
      start_date: format(start, 'yyyy-MM-dd'),
      end_date: format(end, 'yyyy-MM-dd'),
      skip: 0,
      limit: 5000,
    };

    const response = await apiClient.get('/api/logs', { params });
    const logs = response.data || [];

    const bucketKey = (dateObj) => {
      if (period === 'weekly') {
        return format(startOfWeek(dateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      }
      if (period === 'monthly') {
        return format(startOfMonth(dateObj), 'yyyy-MM');
      }
      return format(dateObj, 'yyyy-MM-dd');
    };

    const buckets = new Map();
    for (const log of logs) {
      const ts = log?.timestamp ? new Date(log.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;

      const key = bucketKey(ts);
      if (!buckets.has(key)) {
        buckets.set(key, { date: key, entries: 0, exits: 0 });
      }

      const item = buckets.get(key);
      if (log.action === 'entry') item.entries += 1;
      if (log.action === 'exit') item.exits += 1;
    }

    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  },
};

export const commandsService = {
  async openBarrier(gate) {
    const response = await apiClient.post('/api/commands/open-barrier', { gate });
    return response.data;
  },

  async emergencyMode(enable) {
    const response = await apiClient.post('/api/commands/emergency', { enable });
    return response.data;
  },

  async syncCards() {
    const response = await apiClient.post('/api/cards/sync-to-esp32');
    return response.data;
  },

  async scanMode(enable = true, gate = 'entrance') {
    const response = await apiClient.post('/api/commands/scan-mode', { enable, gate });
    return response.data;
  },

  async resetSlot(slotId) {
    // No backend endpoint for reset-slot; keep method for compatibility but fail clearly.
    throw new Error(`resetSlot is not supported by backend API (slotId=${slotId})`);
  },
};

export const settingsService = {
  async getPricing() {
    const response = await apiClient.get('/api/settings/pricing');
    return response.data;
  },

  async updatePricing(update) {
    const response = await apiClient.put('/api/settings/pricing', update);
    return response.data;
  },
};
