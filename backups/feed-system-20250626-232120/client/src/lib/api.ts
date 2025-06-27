import { authService } from "./auth-service";

// API base URL
const API_BASE = '/api';

// Generic API request function with authentication
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const token = await authService.getIdToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
};

// Helper function to get Firebase ID token (for backward compatibility)
export const getIdToken = async (): Promise<string | null> => {
  return await authService.getIdToken();
};

// Convenience functions for common HTTP methods
export const apiGet = (endpoint: string) => apiRequest(endpoint);
export const apiPost = (endpoint: string, data?: any) => 
  apiRequest(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
export const apiPut = (endpoint: string, data?: any) => 
  apiRequest(endpoint, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
export const apiDelete = (endpoint: string) => 
  apiRequest(endpoint, { method: 'DELETE' });

// Specific API functions
export const api = {
  // Posts
  getPosts: () => apiGet('/posts'),
  getPost: (id: string) => apiGet(`/posts/${id}`),
  createPost: (data: any) => apiPost('/posts', data),
  
  // Connections
  getConnections: () => apiGet('/connections'),
  getConnectionRequests: () => apiGet('/connection-requests'),
  sendConnectionRequest: (connectionId: string) => 
    apiPost('/connection-request', { connectionId }),
  
  // Lists
  getLists: () => apiGet('/lists'),
  createList: (data: any) => apiPost('/lists', data),
  
  // User
  getUser: () => apiGet('/user'),
  updateUser: (data: any) => apiPut('/user', data),
}; 