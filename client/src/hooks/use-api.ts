import { useState, useEffect, useCallback } from 'react';
import { ApiService, ApiResponse, ApiOptions } from '../lib/api-service';
import { useToast } from './use-toast';

// Hook for API calls with loading state
export function useApiCall<T = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const call = useCallback(async (
    apiCall: () => Promise<ApiResponse<T>>,
    showToast = true
  ): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      
      if (!response.success && showToast) {
        toast({
          title: "Error",
          description: response.error || "An unexpected error occurred",
          variant: "destructive",
        });
        setError(response.error || "An unexpected error occurred");
      }

      return response;
    } catch (err: any) {
      const errorMessage = err.message || "An unexpected error occurred";
      setError(errorMessage);
      
      if (showToast) {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }

      return {
        success: false,
        error: errorMessage,
        code: 500,
      };
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { call, loading, error, setError };
}

// Hook for API data fetching with caching
export function useApiData<T = any>(
  endpoint: string,
  options?: ApiOptions & { enabled?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const enabled = options?.enabled !== false;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await ApiService.get<T>(endpoint, options);
      
      if (response.success) {
        setData(response.data);
      } else {
        setError(response.error || "Failed to fetch data");
        toast({
          title: "Error",
          description: response.error || "Failed to fetch data",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || "An unexpected error occurred";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [endpoint, options, enabled, toast]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

// Hook for API mutations (POST, PUT, DELETE)
export function useApiMutation<T = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const mutate = useCallback(async (
    apiCall: () => Promise<ApiResponse<T>>,
    successMessage?: string,
    errorMessage?: string
  ): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall();
      
      if (response.success) {
        if (successMessage) {
          toast({
            title: "Success",
            description: successMessage,
          });
        }
      } else {
        const message = errorMessage || response.error || "Operation failed";
        setError(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }

      return response;
    } catch (err: any) {
      const message = errorMessage || err.message || "An unexpected error occurred";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });

      return {
        success: false,
        error: message,
        code: 500,
      };
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { mutate, loading, error, setError };
}

// Hook for checking if an endpoint is loading
export function useApiLoading(endpoint: string) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = ApiService.onLoadingChange((ep, loading) => {
      if (ep === endpoint) {
        setLoading(loading);
      }
    });

    // Set initial loading state
    setLoading(ApiService.isLoading(endpoint));

    return unsubscribe;
  }, [endpoint]);

  return loading;
}

// Hook for API with optimistic updates
export function useOptimisticApi<T = any>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const optimisticUpdate = useCallback(async <R = any>(
    apiCall: () => Promise<ApiResponse<R>>,
    optimisticData: T,
    updateFn: (data: T) => void,
    rollbackFn: () => void,
    successMessage?: string
  ): Promise<ApiResponse<R>> => {
    setLoading(true);
    setError(null);

    // Apply optimistic update
    updateFn(optimisticData);

    try {
      const response = await apiCall();
      
      if (response.success) {
        if (successMessage) {
          toast({
            title: "Success",
            description: successMessage,
          });
        }
      } else {
        // Rollback on error
        rollbackFn();
        setError(response.error || "Operation failed");
        toast({
          title: "Error",
          description: response.error || "Operation failed",
          variant: "destructive",
        });
      }

      return response;
    } catch (err: any) {
      // Rollback on error
      rollbackFn();
      const message = err.message || "An unexpected error occurred";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });

      return {
        success: false,
        error: message,
        code: 500,
      };
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return { optimisticUpdate, loading, error, setError };
}
