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

      console.log('HealthKit: Calling requestAuthorization with', readPermissions.length, 'read permissions');
      console.log('HealthKit: Read permissions:', readPermissions);
      console.log('HealthKit: Write permissions:', writePermissions);
      
      // Note: requestAuthorization takes a single object with toRead and toShare properties
      // It returns true if the dialog was shown, false if permissions were already determined
      let dialogShown = false;
      let authError: any = null;
      
      try {
        console.log('HealthKit: About to call requestAuthorization...');
        
        // Call with correct signature: single object with toRead and toShare
        const result = await requestAuthorization({
          toRead: readPermissions as any,
          toShare: writePermissions as any,
        });
        
        console.log('HealthKit: requestAuthorization returned:', result);
        console.log('HealthKit: Result type:', typeof result);
        
        // The function returns true if dialog was shown, false otherwise
        dialogShown = result === true;
        
        if (!dialogShown) {
          console.warn('HealthKit: ⚠️ Dialog was NOT shown!');
          console.warn('HealthKit: This usually means:');
          console.warn('  1. Permissions were already requested before (granted or denied)');
          console.warn('  2. HealthKit capability not enabled in Xcode');
          console.warn('  3. Info.plist missing NSHealthShareUsageDescription');
          console.warn('  4. App needs to be rebuilt with HealthKit capability');
        } else {
          console.log('HealthKit: ✅ Permission dialog was shown to user');
        }
      } catch (error: any) {
        authError = error;
        console.error('HealthKit: ❌ requestAuthorization threw error:', error);
        console.error('HealthKit: Error message:', error?.message);
        console.error('HealthKit: Error code:', error?.code);
        console.error('HealthKit: Error name:', error?.name);
        
        // If there's an error, it might still work, but log it
        // Some libraries throw errors even on success
        if (error?.message?.includes('authorization') || error?.message?.includes('permission')) {
          console.error('HealthKit: This looks like an authorization error - check Xcode capability');
        }
      }
      
      console.log('HealthKit: requestAuthorization completed');
      console.log('HealthKit: Dialog shown:', dialogShown);
      console.log('HealthKit: Had error:', !!authError);
      
      // Always wait a bit - iOS needs time to show the dialog
      if (dialogShown) {
        console.log('HealthKit: Waiting for user to respond to permission dialog...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer if dialog was shown
      } else {
        console.log('HealthKit: Dialog was not shown, waiting briefly...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // If dialog wasn't shown and we got an error, throw it so the caller knows
      if (!dialogShown && authError) {
        throw new Error(
          `HealthKit permission dialog was not shown. This usually means:\n` +
          `1. HealthKit capability not enabled in Xcode\n` +
          `2. App needs to be rebuilt\n` +
          `3. Permissions were previously denied\n\n` +
          `Error: ${authError?.message || 'Unknown error'}`
        );
      }

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
        
        // If dialog wasn't shown and we don't have access, permissions were likely denied before
        if (!dialogShown) {
          console.log('HealthKit: Permission dialog was not shown and access is denied.');
          console.log('HealthKit: This usually means permissions were previously denied.');
          console.log('HealthKit: User must enable permissions in Settings → Privacy & Security → Health → Soma');
        }
        
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
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      console.log('HealthKit: verifyAccess failed:', errorMessage);
      
      // Check for specific authorization errors
      if (errorMessage.includes('authorization') || errorMessage.includes('permission') || errorMessage.includes('denied')) {
        console.log('HealthKit: Authorization denied - user needs to enable in Settings');
      }
      
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
