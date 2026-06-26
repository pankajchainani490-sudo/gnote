// api-client.js - Light HTTP Client for NoteFlow backend sync
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const apiClient = {
  getServerUrl() {
    return localStorage.getItem('noteflow_server_url') || '';
  },

  getApiKey() {
    return localStorage.getItem('noteflow_api_key') || '';
  },

  configure({ serverUrl, apiKey }) {
    if (serverUrl) {
      // Clean up serverUrl trailing slash
      const cleanUrl = serverUrl.replace(/\/$/, '');
      localStorage.setItem('noteflow_server_url', cleanUrl);
    } else {
      localStorage.removeItem('noteflow_server_url');
    }

    if (apiKey) {
      localStorage.setItem('noteflow_api_key', apiKey);
    } else {
      localStorage.removeItem('noteflow_api_key');
    }
  },

  isConfigured() {
    return !!this.getServerUrl() && !!this.getApiKey();
  },

  async request(method, path, body = null) {
    if (!this.isConfigured()) {
      return null;
    }

    const url = `${this.getServerUrl()}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.getApiKey()
    };

    if (Capacitor.isNativePlatform()) {
      try {
        const options = {
          url,
          method,
          headers,
          data: body // CapacitorHttp expects data for body
        };
        const response = await CapacitorHttp.request(options);
        if (response.status < 200 || response.status >= 300) {
          console.warn(`CapacitorHttp API Request failed with status ${response.status}`);
          if (response.status === 401) {
            window.dispatchEvent(new CustomEvent('sync-auth-failed'));
          }
          return null;
        }
        return response.data;
      } catch (err) {
        console.warn(`CapacitorHttp native error during API Request to ${url}:`, err);
        return null;
      }
    } else {
      const options = {
        method,
        headers
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          console.warn(`API Request failed with status ${response.status}: ${response.statusText}`);
          if (response.status === 401) {
            // Trigger event for invalid configuration
            window.dispatchEvent(new CustomEvent('sync-auth-failed'));
          }
          return null;
        }
        return await response.json();
      } catch (err) {
        console.warn(`Network error during API Request to ${url}:`, err);
        return null;
      }
    }
  },

  async testConnection(serverUrl, apiKey) {
    const cleanUrl = serverUrl.replace(/\/$/, '');
    const url = `${cleanUrl}/api/ping`;
    
    if (Capacitor.isNativePlatform()) {
      try {
        const response = await CapacitorHttp.request({
          url,
          method: 'GET',
          headers: {
            'X-API-Key': apiKey
          }
        });
        if (response.status >= 200 && response.status < 300) {
          return { success: true, data: response.data };
        }
        return { success: false, error: `HTTP ${response.status}` };
      } catch (err) {
        return { success: false, error: err.message || '网络连接失败' };
      }
    } else {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey
          }
        });
        if (response.ok) {
          const data = await response.json();
          return { success: true, data };
        }
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      } catch (err) {
        return { success: false, error: err.message || '网络连接失败' };
      }
    }
  },

  async sync(lastSyncAt, changes) {
    return await this.request('POST', '/api/sync', { lastSyncAt, changes });
  }
};

