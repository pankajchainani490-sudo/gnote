// dev-settings.js - Developer Mode settings panel controller for NoteFlow sync configuration

import { apiClient } from './api-client.js';
import { SyncEngine } from './sync-engine.js';

export const DevSettings = {
  init() {
    const btnDevSettings = document.getElementById('btn-dev-settings');
    const modalDevSettings = document.getElementById('modal-dev-settings');
    const btnCloseModal = modalDevSettings.querySelector('.btn-close-modal');
    const btnTestConnection = document.getElementById('btn-test-connection');
    const btnSaveDevSettings = document.getElementById('btn-save-dev-settings');
    
    const inputUrl = document.getElementById('dev-server-url');
    const inputKey = document.getElementById('dev-api-key');
    const statusText = document.getElementById('dev-connection-status');
    const statusIndicator = document.getElementById('dev-status-indicator');

    // 1. Show modal and load values
    btnDevSettings.addEventListener('click', () => {
      inputUrl.value = apiClient.getServerUrl();
      inputKey.value = apiClient.getApiKey();
      this.updateStatusDisplay();
      modalDevSettings.classList.remove('hidden');
    });

    // 2. Close modal
    btnCloseModal.addEventListener('click', () => {
      modalDevSettings.classList.add('hidden');
    });

    // 3. Test Connection
    btnTestConnection.addEventListener('click', async () => {
      const url = inputUrl.value.trim();
      const key = inputKey.value.trim();

      if (!url || !key) {
        this.setStatus('error', '请输入完整的服务器地址和 API Key');
        return;
      }

      this.setStatus('testing', '正在测试连接...');
      btnTestConnection.disabled = true;
      btnSaveDevSettings.disabled = true;

      const result = await apiClient.testConnection(url, key);

      btnTestConnection.disabled = false;
      btnSaveDevSettings.disabled = false;

      if (result.success) {
        this.setStatus('success', '连接成功 (API Key 有效)');
      } else {
        this.setStatus('error', `连接失败: ${result.error}`);
      }
    });

    // 4. Save and Force Sync
    btnSaveDevSettings.addEventListener('click', async () => {
      const url = inputUrl.value.trim();
      const key = inputKey.value.trim();

      apiClient.configure({ serverUrl: url, apiKey: key });
      
      modalDevSettings.classList.add('hidden');

      if (apiClient.isConfigured()) {
        SyncEngine.stop();
        SyncEngine.start();
        await SyncEngine.forceSync();
      } else {
        SyncEngine.stop();
        localStorage.removeItem('noteflow_server_revision');
        localStorage.removeItem('noteflow_last_sync_at');
        localStorage.removeItem('noteflow_changelog');
        this.updateStatusDisplay();
      }
    });

    // 5. Register sync status event listeners
    window.addEventListener('sync-status-changed', (e) => {
      const status = e.detail;
      if (status === 'syncing') {
        this.setStatus('syncing', '正在同步中...');
      } else if (status === 'success') {
        this.setStatus('success', '同步已完成');
      } else if (status === 'error') {
        this.setStatus('error', '同步发生错误');
      }
    });

    window.addEventListener('sync-auth-failed', () => {
      this.setStatus('error', '授权失败 (API Key 错误)');
    });

    // Initialize connection status on app start
    this.updateStatusDisplay();
  },

  setStatus(type, message) {
    const statusText = document.getElementById('dev-connection-status');
    const statusIndicator = document.getElementById('dev-status-indicator');
    
    if (!statusText || !statusIndicator) return;

    statusText.textContent = message;

    // Set colors
    if (type === 'success') {
      statusIndicator.style.backgroundColor = '#34C759'; // Green
    } else if (type === 'error') {
      statusIndicator.style.backgroundColor = '#FF3B30'; // Red
    } else if (type === 'syncing' || type === 'testing') {
      statusIndicator.style.backgroundColor = '#FFCC00'; // Yellow
    } else {
      statusIndicator.style.backgroundColor = '#8E8E93'; // Gray
    }
  },

  updateStatusDisplay() {
    if (apiClient.isConfigured()) {
      const rev = localStorage.getItem('noteflow_server_revision');
      const lastSync = localStorage.getItem('noteflow_last_sync_at');
      if (rev && parseInt(rev, 10) > 0) {
        this.setStatus('success', `已连接 (服务端版本: r${rev})`);
      } else if (lastSync) {
        const time = new Date(lastSync).toLocaleTimeString();
        this.setStatus('success', `已连接 (上次同步: ${time})`);
      } else {
        this.setStatus('success', '已配置, 等待首次同步');
      }
    } else {
      this.setStatus('none', '未配置自托管服务');
    }
  }
};
