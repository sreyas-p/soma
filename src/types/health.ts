export interface HealthData {
  id: string;
  type: HealthDataType;
  value: number;
  unit: string;
  startDate: Date;
  endDate: Date;
  source: string;
  metadata?: Record<string, any>;
}

export interface HealthPermission {
  type: HealthDataType;
  read: boolean;
  write: boolean;
}

export interface HealthSyncStatus {
  lastSync: Date;
  dataTypes: HealthDataType[];
  isConnected: boolean;
  error?: string;
}

export type HealthDataType = 
  | 'steps'
  | 'distance'
  | 'calories'
  | 'heartRate'
  | 'bloodPressure'
  | 'sleep'
  | 'weight'
  | 'height'
  | 'bmi'
  | 'workout'
  | 'mindfulness'
  | 'nutrition';

export interface HealthKitConfig {
  permissions: HealthPermission[];
  backgroundDelivery: boolean;
  dataTypes: HealthDataType[];
}

export interface HealthDataQuery {
  type: HealthDataType;
  startDate: Date;
  endDate: Date;
  limit?: number;
}

export interface HealthDataResponse {
  success: boolean;
  data?: HealthData[];
  error?: string;
  count: number;
}
