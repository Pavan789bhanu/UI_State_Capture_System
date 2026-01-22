/**
 * API Client for UI Capture System
 * 
 * This module provides a centralized API client with WebSocket support
 * for real-time updates from the backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

// ============================================================================
// Types
// ============================================================================

export interface Workflow {
  id: string;
  name: string;
  description: string;
  app_name: string;
  start_url: string;
  status: 'active' | 'paused';
  created_at: string;
  updated_at: string;
  owner_id?: number;
  execution_count?: number;
  success_count?: number;
  last_executed?: string | null;
  credentials?: {
    email: string;
    password: string;
  } | null;
}

export interface Execution {
  id: string;
  workflow_id: string;
  workflow_name?: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'STOPPED' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration?: number;
  steps_completed?: number;
  total_steps?: number;
  screenshots?: string[];
  error_message?: string | null;
  result?: any;
}

export interface AnalyticsOverview {
  total_workflows: number;
  active_workflows: number;
  total_executions: number;
  success_executions: number;
  failed_executions: number;
  running_executions: number;
  success_rate: number;
  average_duration: number;
}

export interface TopWorkflow {
  id: string;
  name: string;
  execution_count: number;
  success_count: number;
  success_rate: number;
}

// ============================================================================
// API Client
// ============================================================================

class APIClient {
  private baseURL: string;
  private wsURL: string;
  private ws: WebSocket | null = null;
  private wsListeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private token: string | null = null;

  constructor(baseURL: string = API_BASE_URL, wsURL: string = WS_BASE_URL) {
    this.baseURL = baseURL;
    this.wsURL = wsURL;
  }

  setToken(token: string | null) {
    console.log('[APIClient] Setting token:', token ? `${token.substring(0, 20)}...` : 'null');
    this.token = token;
  }

  // ============================================================================
  // HTTP Methods
  // ============================================================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    console.log(`[APIClient] 🌐 REQUEST: ${options.method || 'GET'} ${url}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log(`[APIClient] ✓ Auth token attached (${this.token.substring(0, 20)}...)`);
    } else {
      console.warn(`[APIClient] ⚠️  NO AUTH TOKEN - Request will likely fail with 401`);
    }
    
    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      console.log(`[APIClient] 📤 Sending request...`);
      const response = await fetch(url, config);
      console.log(`[APIClient] 📥 Response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        console.error(`[APIClient] ❌ Request failed: ${error.detail || response.statusText}`);
        throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[APIClient] ✅ Request successful`);
      return data;
    } catch (error) {
      console.error(`[APIClient] 💥 Exception during request to ${endpoint}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Workflow APIs
  // ============================================================================

  async getWorkflows(): Promise<{ workflows: Workflow[]; total: number }> {
    const workflows = await this.request<Workflow[]>('/api/workflows/');
    return { workflows, total: workflows.length };
  }

  async getWorkflow(id: string): Promise<Workflow> {
    return this.request<Workflow>(`/api/workflows/${id}`);
  }

  async createWorkflow(data: {
    name: string;
    description: string;
    app_name: string;
    start_url?: string;
    login_email?: string;
    login_password?: string;
  }): Promise<Workflow> {
    return this.request<Workflow>('/api/workflows/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWorkflow(
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: 'active' | 'paused';
    }
  ): Promise<Workflow> {
    return this.request<Workflow>(`/api/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWorkflow(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/workflows/${id}`, {
      method: 'DELETE',
    });
  }

  // ============================================================================
  // Execution APIs
  // ============================================================================

  async getExecutions(workflowId?: string): Promise<{ executions: Execution[]; total: number }> {
    const query = workflowId ? `?workflow_id=${workflowId}` : '';
    const executions = await this.request<Execution[]>(`/api/executions/${query}`);
    return { executions, total: executions.length };
  }

  async getExecution(id: string): Promise<Execution> {
    return this.request<Execution>(`/api/executions/${id}`);
  }

  async createExecution(data: {
    workflow_id: string;
    headless?: boolean;
  }): Promise<Execution> {
    return this.request<Execution>('/api/executions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteExecution(id: string): Promise<{ message: string; id: number }> {
    return this.request<{ message: string; id: number }>(`/api/executions/${id}`, {
      method: 'DELETE',
    });
  }

  async stopExecution(id: string): Promise<Execution> {
    return this.request<Execution>(`/api/executions/${id}/stop`, {
      method: 'POST',
    });
  }

  // ============================================================================
  // Analytics APIs
  // ============================================================================

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    return this.request<AnalyticsOverview>('/api/analytics/overview');
  }

  async getTopWorkflows(): Promise<{ workflows: TopWorkflow[] }> {
    return this.request<{ workflows: TopWorkflow[] }>('/api/analytics/top-workflows');
  }

  // ============================================================================
  // Authentication APIs
  // ============================================================================

  async login(username: string, password: string): Promise<{ access_token: string; token_type: string }> {
    console.log('[APIClient] 🔐 Attempting login for user:', username);
    
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const url = `${this.baseURL}/api/auth/login`;
    console.log('[APIClient] 📍 Login URL:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    console.log('[APIClient] 📥 Login response:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      console.error('[APIClient] ❌ Login failed:', error.detail);
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    console.log('[APIClient] ✅ Login successful, token received');
    return data;
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<{
    status: string;
    version: string;
    workflows: number;
    executions: number;
    active_executions: number;
  }> {
    return this.request('/api/health');
  }

  // ============================================================================
  // WebSocket Connection
  // ============================================================================

  connectWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(`${this.wsURL}/ws`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Send heartbeat every 30 seconds
        const heartbeat = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send('ping');
          } else {
            clearInterval(heartbeat);
          }
        }, 30000);
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.notifyListeners(message.type, message.data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.ws = null;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      this.attemptReconnect();
    }
  }

  disconnectWebSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = window.setTimeout(() => {
      this.connectWebSocket();
    }, delay) as unknown as number;
  }

  // ============================================================================
  // WebSocket Event Listeners
  // ============================================================================

  on(event: string, callback: (data: any) => void) {
    if (!this.wsListeners.has(event)) {
      this.wsListeners.set(event, new Set());
    }
    this.wsListeners.get(event)!.add(callback);
  }

  off(event: string, callback: (data: any) => void) {
    const listeners = this.wsListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private notifyListeners(event: string, data: any) {
    const listeners = this.wsListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
    
    // Also notify wildcard listeners
    const wildcardListeners = this.wsListeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((callback) => callback({ event, data }));
    }
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

export const apiClient = new APIClient();
export const api = apiClient; // Alias for convenience

// Auto-connect WebSocket on module load - TEMPORARILY DISABLED
// Uncomment these lines once backend WebSocket is stable
// if (typeof window !== 'undefined') {
//   apiClient.connectWebSocket();
  
//   // Reconnect on page visibility change
//   document.addEventListener('visibilitychange', () => {
//     if (!document.hidden) {
//       apiClient.connectWebSocket();
//     }
//   });
// }

