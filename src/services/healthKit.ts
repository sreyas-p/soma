import { Platform } from 'react-native';
import {
  requestAuthorization,
  queryQuantitySamples,
  queryCategorySamples,
  queryStatisticsForQuantity,
  isHealthDataAvailable,
} from '@kingstinct/react-native-healthkit';
import { HealthData, HealthDataType, HealthPermission as AppHealthPermission, HealthDataQuery } from '../types/health';

// Debug logging
console.log('HealthKit Service: Using @kingstinct/react-native-healthkit');

// HealthKit type identifiers as strings (these are the actual values HealthKit uses)
const QuantityTypes = {
  stepCount: 'HKQuantityTypeIdentifierStepCount',
  distanceWalkingRunning: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  activeEnergyBurned: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  heartRate: 'HKQuantityTypeIdentifierHeartRate',
  bodyMass: 'HKQuantityTypeIdentifierBodyMass',
  height: 'HKQuantityTypeIdentifierHeight',
  bodyMassIndex: 'HKQuantityTypeIdentifierBodyMassIndex',
} as const;

const CategoryTypes = {
  sleepAnalysis: 'HKCategoryTypeIdentifierSleepAnalysis',
  mindfulSession: 'HKCategoryTypeIdentifierMindfulSession',
} as const;

// Map our app's HealthDataType to HealthKit identifiers
const mapDataTypeToQuantityIdentifier = (type: HealthDataType): string | null => {
  switch (type) {
    case 'steps': return QuantityTypes.stepCount;
    case 'distance': return QuantityTypes.distanceWalkingRunning;
    case 'calories': return QuantityTypes.activeEnergyBurned;
    case 'heartRate': return QuantityTypes.heartRate;
    case 'weight': return QuantityTypes.bodyMass;
    case 'height': return QuantityTypes.height;
    case 'bmi': return QuantityTypes.bodyMassIndex;
    default: return null;
  }
};

const mapDataTypeToCategoryIdentifier = (type: HealthDataType): string | null => {
  switch (type) {
    case 'sleep': return CategoryTypes.sleepAnalysis;
    case 'mindfulness': return CategoryTypes.mindfulSession;
    default: return null;
  }
};

// Real HealthKit service using @kingstinct/react-native-healthkit
class RealHealthKitService {
  private permissions: AppHealthPermission[] = [];
  private isInitialized: boolean = false;

  constructor() {
    // Initialize with default permissions
    this.permissions = [
      { type: 'steps', read: false, write: false },
      { type: 'distance', read: false, write: false },
      { type: 'calories', read: false, write: false },
      { type: 'heartRate', read: false, write: false },
      { type: 'sleep', read: false, write: false },
      { type: 'weight', read: false, write: false },
      { type: 'height', read: false, write: false },
      { type: 'bmi', read: false, write: false },
      { type: 'workout', read: false, write: false },
      { type: 'mindfulness', read: false, write: false }
    ];
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.log('HealthKit: Not iOS, skipping');
      return false;
    }

    try {
      console.log('HealthKit: Checking availability...');
      
      // Check if HealthKit is available
      const available = isHealthDataAvailable();
      console.log('HealthKit: isHealthDataAvailable =', available);
      
      if (!available) {
        console.log('HealthKit: Not available on this device');
        return false;
      }

      console.log('HealthKit: Requesting authorization...');
      
      // Request permissions using string identifiers
      const readPermissions = [
        QuantityTypes.stepCount,
        QuantityTypes.distanceWalkingRunning,
        QuantityTypes.activeEnergyBurned,
        QuantityTypes.heartRate,
        QuantityTypes.bodyMass,
        QuantityTypes.height,
        QuantityTypes.bodyMassIndex,
        CategoryTypes.sleepAnalysis,
        CategoryTypes.mindfulSession,
      ];

      const writePermissions = [
        QuantityTypes.bodyMass,
      ];

      // Note: requestAuthorization returns true if the dialog was shown,
      // false if permissions were already determined (granted or denied).
      // This does NOT indicate whether access was granted!
      await requestAuthorization(readPermissions as any, writePermissions as any);
      console.log('HealthKit: requestAuthorization completed');

      // The only way to know if we have access is to try to read data
      // If we can read, permissions are granted
      const hasAccess = await this.verifyAccess();
      
      if (hasAccess) {
        this.isInitialized = true;
        this.permissions.forEach(permission => {
          permission.read = true;
          permission.write = true;
        });
        console.log('HealthKit: Access verified - permissions granted');
        return true;
      } else {
        console.log('HealthKit: Access verification failed - no permissions');
        return false;
      }
    } catch (error) {
      console.error('HealthKit: Error requesting permissions:', error);
      // Even if there's an error, try to verify access
      const hasAccess = await this.verifyAccess();
      if (hasAccess) {
        this.isInitialized = true;
        this.permissions.forEach(permission => {
          permission.read = true;
          permission.write = true;
        });
        return true;
      }
      return false;
    }
  }

  // Verify we can actually read data (proves permissions are granted)
  private async verifyAccess(): Promise<boolean> {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Try to query step data - if this works, we have read access
      const samples = await queryQuantitySamples(QuantityTypes.stepCount as any, {
        from: startOfToday,
        to: now,
        limit: 1,
      });
      
      // If we got here without error, we have access
      // (even if samples is empty - that just means no data)
      console.log('HealthKit: verifyAccess succeeded, samples:', samples.length);
      return true;
    } catch (error) {
      console.log('HealthKit: verifyAccess failed:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<AppHealthPermission[]> {
    if (Platform.OS !== 'ios') {
      return this.permissions;
    }

    try {
      const available = isHealthDataAvailable();
      if (available) {
        const hasAccess = await this.verifyAccess();
        if (hasAccess) {
          this.isInitialized = true;
          this.permissions.forEach(permission => {
            permission.read = true;
            permission.write = true;
          });
        }
      }
      
      return this.permissions;
    } catch (error) {
      console.error('Error checking HealthKit permissions:', error);
      return this.permissions;
    }
  }

  async fetchHealthData(query: HealthDataQuery): Promise<HealthData[]> {
    if (Platform.OS !== 'ios') {
      return [];
    }

    try {
      const quantityId = mapDataTypeToQuantityIdentifier(query.type);
      const categoryId = mapDataTypeToCategoryIdentifier(query.type);

      if (quantityId) {
        return await this.fetchQuantityData(quantityId, query);
      } else if (categoryId) {
        return await this.fetchCategoryData(categoryId, query);
      } else if (query.type === 'workout') {
        return await this.fetchWorkoutData(query);
      }

      console.warn(`Unsupported health data type: ${query.type}`);
      return [];
    } catch (error) {
      console.error('Error fetching health data:', error);
      return [];
    }
  }

  private async fetchQuantityData(identifier: string, query: HealthDataQuery): Promise<HealthData[]> {
    try {
      console.log(`HealthKit: Fetching ${identifier}...`);
      
      const samples = await queryQuantitySamples(identifier as any, {
        from: query.startDate,
        to: query.endDate,
        limit: query.limit || 100,
      });

      console.log(`HealthKit: Got ${samples.length} samples for ${identifier}`);

      return samples.map((sample: any) => ({
        id: sample.uuid || Math.random().toString(),
        type: query.type,
        value: sample.quantity || 0,
        unit: sample.unit || '',
        startDate: new Date(sample.startDate),
        endDate: new Date(sample.endDate),
        source: sample.sourceRevision?.source?.name || 'HealthKit',
        metadata: sample.metadata || {},
      }));
    } catch (error) {
      console.error(`Error fetching ${identifier}:`, error);
      return [];
    }
  }

  private async fetchCategoryData(identifier: string, query: HealthDataQuery): Promise<HealthData[]> {
    try {
      console.log(`HealthKit: Fetching category ${identifier}...`);
      
      const samples = await queryCategorySamples(identifier as any, {
        from: query.startDate,
        to: query.endDate,
        limit: query.limit || 100,
      });

      console.log(`HealthKit: Got ${samples.length} category samples for ${identifier}`);

      return samples.map((sample: any) => ({
        id: sample.uuid || Math.random().toString(),
        type: query.type,
        value: sample.value || 0,
        unit: '',
        startDate: new Date(sample.startDate),
        endDate: new Date(sample.endDate),
        source: sample.sourceRevision?.source?.name || 'HealthKit',
        metadata: sample.metadata || {},
      }));
    } catch (error) {
      console.error(`Error fetching category ${identifier}:`, error);
      return [];
    }
  }

  private async fetchWorkoutData(query: HealthDataQuery): Promise<HealthData[]> {
    try {
      console.log('HealthKit: Fetching workouts...');
      
      // The library uses queryWorkoutSamples for workouts
      const { queryWorkoutSamples } = await import('@kingstinct/react-native-healthkit');
      
      const workouts = await queryWorkoutSamples({
        from: query.startDate,
        to: query.endDate,
        limit: query.limit || 100,
      });

      console.log(`HealthKit: Got ${workouts.length} workouts`);

      return workouts.map((workout: any) => ({
        id: workout.uuid || Math.random().toString(),
        type: 'workout',
        value: workout.duration || 0,
        unit: 'seconds',
        startDate: new Date(workout.startDate),
        endDate: new Date(workout.endDate),
        source: workout.sourceRevision?.source?.name || 'HealthKit',
        metadata: {
          workoutActivityType: workout.workoutActivityType,
          totalEnergyBurned: workout.totalEnergyBurned,
          totalDistance: workout.totalDistance,
        },
      }));
    } catch (error) {
      console.error('Error fetching workouts:', error);
      return [];
    }
  }

  async saveHealthData(data: any): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      const { saveQuantitySample } = await import('@kingstinct/react-native-healthkit');
      
      switch (data.type) {
        case 'weight':
          await saveQuantitySample(QuantityTypes.bodyMass as any, {
            quantity: data.value,
            unit: 'lb',
            startDate: data.startDate,
            endDate: data.endDate || data.startDate,
          });
          break;
        default:
          console.warn(`Unsupported health data type for saving: ${data.type}`);
          return false;
      }

      return true;
    } catch (error) {
      console.error('Error saving health data:', error);
      return false;
    }
  }

  // Get daily statistics for a quantity type
  async getDailyStatistics(type: HealthDataType, date: Date): Promise<number> {
    const quantityId = mapDataTypeToQuantityIdentifier(type);
    if (!quantityId) return 0;

    try {
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

      // Correct API: filter.date with startDate/endDate
      const result = await queryStatisticsForQuantity(
        quantityId as any, 
        ['cumulativeSum'] as any,
        { 
          filter: {
            date: {
              startDate: startOfDay,
              endDate: endOfDay
            }
          }
        }
      );

      return (result as any)?.sumQuantity?.quantity || 0;
    } catch (error) {
      console.error(`Error getting daily statistics for ${type}:`, error);
      return 0;
    }
  }
}

// Export the service instance
export const healthKitService = new RealHealthKitService();

// Export convenience functions that use the service
export const requestHealthKitPermissions = async (): Promise<boolean> => {
  return healthKitService.requestPermissions();
};

export const getHealthKitPermissions = async (): Promise<AppHealthPermission[]> => {
  return healthKitService.checkPermissions();
};

export const fetchHealthData = async (query: HealthDataQuery): Promise<HealthData[]> => {
  return healthKitService.fetchHealthData(query);
};

export const saveHealthData = async (data: any): Promise<boolean> => {
  return healthKitService.saveHealthData(data);
};
