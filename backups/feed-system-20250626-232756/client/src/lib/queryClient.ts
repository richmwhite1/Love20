import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { authService } from './auth-service';

export type UnauthorizedBehavior = "returnNull" | "throw";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  token?: string | null,
): Promise<Response> {
  const authToken = token || await authService.getIdToken();
  if (!authToken) throw new Error('No Firebase ID token provided to apiRequest');
  
  const headers: Record<string, string> = {};
  headers['Authorization'] = `Bearer ${authToken}`;
  if (data && !(data instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined),
  });
  await throwIfResNotOk(res);
  return res;
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
  getToken?: () => Promise<string | null>;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior, getToken }) =>
  async ({ queryKey }) => {
    let token: string | null = null;
    
    if (getToken) {
      token = await getToken();
    } else {
      token = await authService.getIdToken();
    }
    
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
