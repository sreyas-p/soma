import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { healthKitService } from '../services/healthKit';
import { healthDataSyncService } from '../services/healthDataSync';
import { HealthData, HealthDataType, HealthPermission, HealthDataQuery } from '../types/health';

export interface UseHealthKitReturn {
  // State
  isAvailable: boolean;
  isConnected: boolean;
  isLoading: boolean;
  isConnecting: boolean;
  isSyncing: boolean;
  permissions: HealthPermission[];
  lastSync: Date | null;
  error: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';

  // Methods
  checkPermissions: () => Promise<HealthPermission[]>;
  requestPermissions: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  fetchData: (query: HealthDataQuery) => Promise<HealthData[]>;
  readData: (query: HealthDataQuery) => Promise<HealthData[]>;
  syncHealthData: () => Promise<boolean>;
  
  // Legacy methods for backward compatibility
  connect: () => Promise<boolean>;
  syncData: () => Promise<boolean>;
}

export const useHealthKit = (): UseHealthKitReturn => {
  const [isAvailable] = useState<boolean>(Platform.OS === 'ios');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<HealthPermission[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  // Check availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      const available = Platform.OS === 'ios';

      if (available) {
        try {
          const currentPermissions = await healthKitService.checkPermissions();
          setPermissions(currentPermissions);
          
          // Check if we have any permissions
          const hasAnyPermissions = currentPermissions.some(p => p.read || p.write);
          setIsConnected(hasAnyPermissions);
          setConnectionStatus(hasAnyPermissions ? 'connected' : 'disconnected');
        } catch (error) {
          console.error('Error checking HealthKit availability:', error);
          setConnectionStatus('error');
        }
      }
    };

    checkAvailability();
  }, []);

  const checkPermissions = async () => {
    try {
      setLoading(true);
      const permissions = await healthKitService.checkPermissions();
      setPermissions(permissions);
      
      // Check if we have any permissions
      const hasAnyPermissions = permissions.some(p => p.read || p.write);
      setIsConnected(hasAnyPermissions);
      setConnectionStatus(hasAnyPermissions ? 'connected' : 'disconnected');
      
      // Get sync status - use a simple check instead of getSyncStatus
      const lastSync = new Date(); // For now, use current time
      setLastSync(lastSync);
      
      return permissions;
    } catch (error) {
      console.error('Error checking HealthKit permissions:', error);
      setConnectionStatus('error');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      setLoading(true);
      setIsConnecting(true);
      setConnectionStatus('connecting');
      setError(null);
      
      const success = await healthKitService.requestPermissions();
      
      if (success) {
        // Re-check permissions after successful request
        await checkPermissions();
        setConnectionStatus('connected');
        return true;
      } else {
        setConnectionStatus('error');
        setError('Failed to get HealthKit permissions');
        return false;
      }
    } catch (error) {
      console.error('Error requesting HealthKit permissions:', error);
      setConnectionStatus('error');
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      return false;
    } finally {
      setLoading(false);
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      setLoading(true);
      // Reset local state - HealthKit permissions remain until user revokes
      setPermissions([]);
      setIsConnected(false);
      setLastSync(null);
      setConnectionStatus('disconnected');
      setError(null);
    } catch (error) {
      console.error('Error disconnecting from HealthKit:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async (query: HealthDataQuery): Promise<HealthData[]> => {
    try {
      setLoading(true);
      setError(null);
      const data = await healthKitService.fetchHealthData(query);
      return data;
    } catch (error) {
      console.error('Error fetching health data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Sync health data
  const syncHealthData = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      setError('Not connected to HealthKit');
      return false;
    }

    try {
      setSyncing(true);
      setError(null);

      // Persist HealthKit data to Supabase for the authenticated user
      const result = await healthDataSyncService.syncHealthData();
      if (result.success) {
        if (result.lastSync) setLastSync(result.lastSync);
        return true;
      }

      setError(result.error || 'Sync failed');
      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return false;
    } finally {
      setSyncing(false);
    }
  }, [isConnected]);

  // Read health data
  const readData = useCallback(async (query: HealthDataQuery): Promise<HealthData[]> => {
    if (!isConnected) {
      setError('Not connected to HealthKit');
      return [];
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await fetchData(query);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [isConnected, fetchData]);

  return {
    // State
    isAvailable,
    isConnected,
    isLoading: loading,
    isConnecting,
    isSyncing: syncing,
    permissions,
    lastSync,
    error,
    connectionStatus,

    // Methods
    checkPermissions,
    requestPermissions,
    disconnect,
    fetchData,
    readData,
    syncHealthData,
    
    // Legacy methods for backward compatibility
    connect: requestPermissions,
    syncData: syncHealthData
  };
};
