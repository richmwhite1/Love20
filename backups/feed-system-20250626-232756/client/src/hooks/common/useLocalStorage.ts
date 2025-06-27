import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      // Save to local storage
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}

export function useSessionStorage<T>(key: string, initialValue: T) {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading sessionStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to sessionStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      // Save to session storage
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}

// Hook for managing multiple localStorage values
export function useLocalStorageMulti<T extends Record<string, any>>(initialValues: T) {
  const [values, setValues] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValues;
    }
    
    const storedValues: Partial<T> = {};
    try {
      Object.keys(initialValues).forEach(key => {
        const item = window.localStorage.getItem(key);
        if (item) {
          storedValues[key as keyof T] = JSON.parse(item);
        }
      });
      return { ...initialValues, ...storedValues };
    } catch (error) {
      console.error('Error reading localStorage values:', error);
      return initialValues;
    }
  });

  const setValue = <K extends keyof T>(key: K, value: T[K]) => {
    try {
      setValues(prev => ({ ...prev, [key]: value }));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(String(key), JSON.stringify(value));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${String(key)}":`, error);
    }
  };

  const setMultipleValues = (newValues: Partial<T>) => {
    try {
      setValues(prev => ({ ...prev, ...newValues }));
      if (typeof window !== "undefined") {
        Object.entries(newValues).forEach(([key, value]) => {
          window.localStorage.setItem(key, JSON.stringify(value));
        });
      }
    } catch (error) {
      console.error('Error setting multiple localStorage values:', error);
    }
  };

  const clearValue = (key: keyof T) => {
    try {
      setValues(prev => {
        const newValues = { ...prev };
        delete newValues[key];
        return newValues;
      });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(String(key));
      }
    } catch (error) {
      console.error(`Error clearing localStorage key "${String(key)}":`, error);
    }
  };

  const clearAll = () => {
    try {
      setValues(initialValues);
      if (typeof window !== "undefined") {
        Object.keys(initialValues).forEach(key => {
          window.localStorage.removeItem(key);
        });
      }
    } catch (error) {
      console.error('Error clearing all localStorage values:', error);
    }
  };

  return {
    values,
    setValue,
    setMultipleValues,
    clearValue,
    clearAll,
  };
}
