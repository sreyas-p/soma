import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UseAsyncStorageResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  setData: (value: T) => Promise<void>;
  clearData: () => Promise<void>;
  refreshData: () => Promise<void>;
}

export const useAsyncStorage = <T>(
  key: string,
  defaultValue?: T
): UseAsyncStorageResult<T> => {
  const [data, setDataState] = useState<T | null>(defaultValue ?? null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getData = useCallback(async (): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const storedValue = await AsyncStorage.getItem(key);
      
      if (storedValue) {
        const parsedValue = JSON.parse(storedValue) as T;
        return parsedValue;
      }
      
      return defaultValue ?? null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error(`Error retrieving data for key "${key}":`, err);
      return defaultValue ?? null;
    } finally {
      setLoading(false);
    }
  }, [key, defaultValue]);

  const setData = useCallback(async (value: T): Promise<void> => {
    try {
      setError(null);
      const stringValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
      setDataState(value);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error(`Error storing data for key "${key}":`, err);
      throw err;
    }
  }, [key]);

  const clearData = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      await AsyncStorage.removeItem(key);
      setDataState(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error(`Error clearing data for key "${key}":`, err);
      throw err;
    }
  }, [key]);

  const refreshData = useCallback(async (): Promise<void> => {
    const freshData = await getData();
    setDataState(freshData);
  }, [getData]);

  // Load initial data
  useEffect(() => {
    getData().then(setDataState);
  }, [getData]);

  return {
    data,
    loading,
    error,
    setData,
    clearData,
    refreshData,
  };
};

// Storage keys for different data types
export const STORAGE_KEYS = {
  USER_DATA: 'user_data',
  HEALTH_DATA: 'health_data',
  USER_PREFERENCES: 'user_preferences',
  CHECKLIST_DATA: 'checklist_data',
  JOURNEY_PROGRESS: 'journey_progress',
  THEME_MODE: 'theme_mode',
} as const; 