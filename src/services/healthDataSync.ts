import { supabase, TABLES } from '../lib/supabase';
import { healthKitService } from './healthKit';
import { HealthDataQuery, HealthData, HealthDataType } from '../types/health';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';

const LAST_SYNC_KEY = '@soma_health_last_sync';
const SYNC_STATUS_KEY = '@soma_health_sync_status';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export interface SyncResult {
  success: boolean;
  lastSync: Date | null;
  error?: string;
  dataCount?: number;
  syncedTypes?: HealthDataType[];
  authType?: 'supabase' | 'local' | 'none';
  supabaseStorageEnabled?: boolean;
  historyEntrySaved?: boolean;
  historyError?: string;
}

export interface SyncStatus {
  isConnected: boolean;
  lastSync: Date | null;
  isSyncing: boolean;
  error?: string;
}

export class HealthDataSyncService {
  private lastSync: Date | null = null;
  private isSyncing: boolean = false;
  private syncIntervalId: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: any = null;

  constructor() {
    this.loadLastSync();
  }

  // Start automatic background sync every 5 minutes
  startBackgroundSync(): void {
    if (this.syncIntervalId) {
      console.log('🔄 Background sync already running');
      return;
    }

    console.log('🔄 Starting background sync (every 5 minutes)');
    
    // Initial sync
    this.syncHealthData().catch(e => console.warn('Initial sync error:', e));

    // Set up interval
    this.syncIntervalId = setInterval(() => {
      console.log('🔄 Background sync triggered');
      this.syncHealthData().catch(e => console.warn('Background sync error:', e));
    }, SYNC_INTERVAL_MS);

    // Also sync when app comes to foreground
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('🔄 App became active - syncing health data');
        this.syncHealthData().catch(e => console.warn('Foreground sync error:', e));
      }
    });
  }

  // Stop background sync
  stopBackgroundSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
      console.log('🔄 Background sync stopped');
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  private async loadLastSync(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (stored) {
        this.lastSync = new Date(stored);
      }
    } catch (error) {
      console.error('Error loading last sync time:', error);
    }
  }

  private async saveLastSync(date: Date): Promise<void> {
    try {
      this.lastSync = date;
      await AsyncStorage.setItem(LAST_SYNC_KEY, date.toISOString());
    } catch (error) {
      console.error('Error saving last sync time:', error);
    }
  }

  async getSyncStatus(): Promise<SyncStatus> {
    const isConnected = await this.isConnected();
    return {
      isConnected,
      lastSync: this.lastSync,
      isSyncing: this.isSyncing,
    };
  }

  async syncHealthData(options?: { 
    types?: HealthDataType[], 
    daysBack?: number 
  }): Promise<SyncResult> {
    if (this.isSyncing) {
      return { 
        success: false, 
        lastSync: this.lastSync, 
        error: 'Sync already in progress',
        authType: 'none',
        supabaseStorageEnabled: false,
      };
    }

    this.isSyncing = true;
    let authType: 'supabase' | 'local' | 'none' = 'none';
    let supabaseStorageEnabled = false;

    try {
      // Ensure authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('🔄 Sync: User check result:', { userId: user?.id, userError: userError?.message });
      
      if (userError || !user) {
        // Check for local user
        const localUserJson = await AsyncStorage.getItem('@soma_current_user');
        if (!localUserJson) {
          this.isSyncing = false;
          return { 
            success: false, 
            lastSync: this.lastSync, 
            error: 'User not authenticated',
            authType: 'none',
            supabaseStorageEnabled: false,
          };
        }
        // For local users, we can't sync to Supabase, but we can still fetch the data
        authType = 'local';
        supabaseStorageEnabled = false;
        console.log('🔄 Sync: Local user detected - Supabase sync disabled');
        console.log('⚠️ To sync health data to cloud, please sign in with email (Supabase auth)');
      } else {
        authType = 'supabase';
        supabaseStorageEnabled = true;
        console.log('🔄 Sync: Supabase authenticated user found:', user.id);
      }

      // Check if we have permissions
      const permissions = await healthKitService.checkPermissions();
      const hasPermissions = permissions.some(p => p.read);
      if (!hasPermissions) {
        this.isSyncing = false;
        return { success: false, lastSync: this.lastSync, error: 'No HealthKit permissions' };
      }

      // Fetch data - use provided types or default to all core types
      const now = new Date();
      const daysBack = options?.daysBack || 7;
      const start = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      
      const types: HealthDataType[] = options?.types || [
        'steps',
        'distance',
        'calories',
        'heartRate',
        'sleep',
        'weight',
        'height',
        'bmi',
        'workout',
        'mindfulness',
      ];

      const syncedTypes: HealthDataType[] = [];

      // Get today's daily summary from HealthKit
      const summary = await this.getDailySummary();
      
      // Fetch additional data for weight, height, etc.
      let weight: number | null = null;
      let height: number | null = null;
      let bmi: number | null = null;
      let workoutMinutes = 0;
      let workoutCount = 0;
      let mindfulnessMinutes = 0;

      // Fetch latest weight
      try {
        const weightData = await healthKitService.fetchHealthData({ 
          type: 'weight', startDate: start, endDate: now, limit: 1 
        });
        if (weightData.length > 0) {
          weight = weightData[0].value;
          syncedTypes.push('weight');
        }
      } catch (e) { console.warn('Error fetching weight:', e); }

      // Fetch latest height
      try {
        const heightData = await healthKitService.fetchHealthData({ 
          type: 'height', startDate: start, endDate: now, limit: 1 
        });
        if (heightData.length > 0) {
          height = heightData[0].value;
          syncedTypes.push('height');
        }
      } catch (e) { console.warn('Error fetching height:', e); }

      // Fetch BMI
      try {
        const bmiData = await healthKitService.fetchHealthData({ 
          type: 'bmi', startDate: start, endDate: now, limit: 1 
        });
        if (bmiData.length > 0) {
          bmi = bmiData[0].value;
          syncedTypes.push('bmi');
        }
      } catch (e) { console.warn('Error fetching BMI:', e); }

      // Fetch workouts
      try {
        const workoutData = await healthKitService.fetchHealthData({ 
          type: 'workout', startDate: start, endDate: now, limit: 100 
        });
        if (workoutData.length > 0) {
          workoutCount = workoutData.length;
          workoutMinutes = Math.round(workoutData.reduce((sum, w) => sum + (w.value || 0), 0) / 60);
          syncedTypes.push('workout');
        }
      } catch (e) { console.warn('Error fetching workouts:', e); }

      // Fetch mindfulness
      try {
        const mindfulnessData = await healthKitService.fetchHealthData({ 
          type: 'mindfulness', startDate: start, endDate: now, limit: 100 
        });
        if (mindfulnessData.length > 0) {
          mindfulnessMinutes = Math.round(mindfulnessData.reduce((sum, m) => sum + (m.value || 0), 0) / 60);
          syncedTypes.push('mindfulness');
        }
      } catch (e) { console.warn('Error fetching mindfulness:', e); }

      // Add core types that came from summary
      if (summary.steps > 0) syncedTypes.push('steps');
      if (summary.distance > 0) syncedTypes.push('distance');
      if (summary.calories > 0) syncedTypes.push('calories');
      if (summary.heartRate) syncedTypes.push('heartRate');
      if (summary.sleep) syncedTypes.push('sleep');

      // Only sync to Supabase if we have a remote user
      let historyEntrySaved = false;
      if (user) {
        console.log('🔄 Sync: Storing health data to Supabase for user', user.id);
        historyEntrySaved = await this.storeHealthData(user.id, {
          steps: summary.steps,
          distance: summary.distance,
          calories: summary.calories,
          heartRate: summary.heartRate,
          sleep: summary.sleep,
          weight,
          height,
          bmi,
          workoutMinutes,
          workoutCount,
          mindfulnessMinutes,
        });
        console.log('🔄 Sync: Completed - history entry saved:', historyEntrySaved);
      } else {
        console.log('🔄 Sync: No Supabase user - skipping cloud storage');
      }

      await this.saveLastSync(new Date());
      this.isSyncing = false;
      
      return { 
        success: true, 
        lastSync: this.lastSync, 
        dataCount: syncedTypes.length,
        syncedTypes,
        authType,
        supabaseStorageEnabled,
        historyEntrySaved,
        historyError: (this as any)._lastHistoryError,
      };
    } catch (error) {
      this.isSyncing = false;
      return { 
        success: false, 
        lastSync: this.lastSync, 
        error: error instanceof Error ? error.message : 'Unknown error',
        authType,
        supabaseStorageEnabled,
      };
    }
  }

  // Store health data as a new historical entry (creates new row every sync)
  // Returns true if history entry was saved successfully
  private async storeHealthData(userId: string, data: {
    steps: number;
    distance: number;
    calories: number;
    heartRate: number | null;
    sleep: number | null;
    weight: number | null;
    height: number | null;
    bmi: number | null;
    workoutMinutes: number;
    workoutCount: number;
    mindfulnessMinutes: number;
  }): Promise<boolean> {
    const now = new Date();
    const timestamp = now.toISOString();
    
    // Create historical entry (created_at is auto-generated by Supabase)
    const historyRow = {
      user_id: userId,
      data_date: now.toISOString().split('T')[0],
      steps: Math.round(data.steps),
      distance: data.distance,
      calories: data.calories,
      heart_rate: data.heartRate,
      weight: data.weight,
      sleep_hours: data.sleep,
      workout_minutes: data.workoutMinutes,
      workout_count: data.workoutCount,
      mindfulness_minutes: data.mindfulnessMinutes,
      source: 'Apple Health',
    };

    console.log('🔄 Supabase: Inserting new historical entry for user:', userId);
    console.log('🔄 Supabase: Timestamp:', timestamp);

    // Insert new row for historical tracking
    console.log('🔄 Supabase: Attempting to insert history row:', JSON.stringify(historyRow, null, 2));
    
    // First, verify the table exists and check auth
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    console.log('🔄 Supabase: Current auth user:', currentUser?.id);
    console.log('🔄 Supabase: Inserting for user_id:', userId);
    console.log('🔄 Supabase: User IDs match:', currentUser?.id === userId);
    
    let historySaved = false;
    let historyErrorMsg: string | undefined;
    
    const { data: insertedData, error: historyError } = await supabase
      .from(TABLES.HEALTH_DATA_HISTORY)
      .insert(historyRow)
      .select();
    
    if (historyError) {
      console.error('🔄 Supabase: ❌ Error storing health history');
      console.error('🔄 Supabase: Error code:', historyError.code);
      console.error('🔄 Supabase: Error message:', historyError.message);
      console.error('🔄 Supabase: Error details:', historyError.details);
      console.error('🔄 Supabase: Error hint:', historyError.hint);
      
      historyErrorMsg = `${historyError.code}: ${historyError.message}`;
      
      // Check if table exists by trying to select
      const { error: selectError } = await supabase
        .from(TABLES.HEALTH_DATA_HISTORY)
        .select('id')
        .limit(1);
      
      if (selectError) {
        console.error('🔄 Supabase: Table check failed:', selectError.message);
        historyErrorMsg = 'Table does not exist - run SQL schema';
      }
      // Don't throw - continue to update current data
    } else {
      historySaved = true;
      console.log('🔄 Supabase: ✅ Historical entry saved successfully!');
      console.log('🔄 Supabase: Inserted row ID:', insertedData?.[0]?.id);
    }
    
    // Store error message for return
    (this as any)._lastHistoryError = historyErrorMsg;

    // Also update the current/latest data row for quick access
    const currentRow = {
      user_id: userId,
      steps: Math.round(data.steps),
      distance: data.distance,
      calories: data.calories,
      heart_rate: data.heartRate,
      weight: data.weight,
      height: data.height,
      bmi: data.bmi,
      sleep_hours: data.sleep,
      workout_minutes: data.workoutMinutes,
      workout_count: data.workoutCount,
      mindfulness_minutes: data.mindfulnessMinutes,
      source: 'Apple Health',
      last_synced_at: timestamp,
      data_date: now.toISOString().split('T')[0],
    };

    // Upsert current row for quick access to latest data
    const { error } = await supabase
      .from(TABLES.HEALTH_DATA)
      .upsert(currentRow, { 
        onConflict: 'user_id',
      })
      .select();
    
    if (error) {
      console.error('🔄 Supabase: Error storing current health data:', error);
      throw error;
    }
    
    console.log('🔄 Supabase: Current data updated');
    return historySaved;
  }

  async getLastSync(): Promise<Date | null> {
    if (!this.lastSync) {
      await this.loadLastSync();
    }
    return this.lastSync;
  }

  async isConnected(): Promise<boolean> {
    try {
      const permissions = await healthKitService.checkPermissions();
      return permissions.some(p => p.read);
    } catch {
      return false;
    }
  }

  // Fetch historical health data for the current user from Supabase
  async fetchHealthDataHistory(options?: {
    daysBack?: number;
    limit?: number;
  }): Promise<Array<{
    recordedAt: Date;
    dataDate: string;
    steps: number;
    distance: number;
    calories: number;
    heartRate: number | null;
    weight: number | null;
    sleep: number | null;
    workoutMinutes: number;
    workoutCount: number;
    mindfulnessMinutes: number;
  }>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const daysBack = options?.daysBack || 7;
      const limit = options?.limit || 1000;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from(TABLES.HEALTH_DATA_HISTORY)
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching health history:', error);
        return [];
      }

      return (data || []).map(row => ({
        recordedAt: new Date(row.created_at),
        dataDate: row.data_date,
        steps: row.steps || 0,
        distance: row.distance || 0,
        calories: row.calories || 0,
        heartRate: row.heart_rate,
        weight: row.weight,
        sleep: row.sleep_hours,
        workoutMinutes: row.workout_minutes || 0,
        workoutCount: row.workout_count || 0,
        mindfulnessMinutes: row.mindfulness_minutes || 0,
      }));
    } catch (error) {
      console.error('Error in fetchHealthDataHistory:', error);
      return [];
    }
  }

  // Fetch stored health data for the current user from Supabase
  async fetchStoredHealthData(): Promise<{
    steps: number;
    distance: number;
    calories: number;
    heartRate: number | null;
    sleep: number | null;
    weight: number | null;
    height: number | null;
    bmi: number | null;
    workoutMinutes: number;
    workoutCount: number;
    mindfulnessMinutes: number;
    lastSyncedAt: Date | null;
  } | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from(TABLES.HEALTH_DATA)
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No data found for user
          return null;
        }
        console.error('Error fetching stored health data:', error);
        return null;
      }

      return {
        steps: data.steps || 0,
        distance: data.distance || 0,
        calories: data.calories || 0,
        heartRate: data.heart_rate,
        sleep: data.sleep_hours,
        weight: data.weight,
        height: data.height,
        bmi: data.bmi,
        workoutMinutes: data.workout_minutes || 0,
        workoutCount: data.workout_count || 0,
        mindfulnessMinutes: data.mindfulness_minutes || 0,
        lastSyncedAt: data.last_synced_at ? new Date(data.last_synced_at) : null,
      };
    } catch (error) {
      console.error('Error in fetchStoredHealthData:', error);
      return null;
    }
  }

  // Get latest value for a specific health data type from HealthKit
  async getLatestValue(type: HealthDataType): Promise<HealthData | null> {
    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const data = await healthKitService.fetchHealthData({
        type,
        startDate: dayAgo,
        endDate: now,
        limit: 1
      });

      return data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error(`Error getting latest ${type}:`, error);
      return null;
    }
  }

  // Get daily summary for dashboard using statistics (deduplicated)
  async getDailySummary(): Promise<{
    steps: number;
    distance: number;
    calories: number;
    heartRate: number | null;
    sleep: number | null;
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    console.log('📊 Fetching daily summary...');
    console.log('📊 Date range:', startOfDay.toISOString(), 'to', now.toISOString());

    try {
      // Make sure HealthKit is initialized before fetching
      await healthKitService.requestPermissions();
      
      // Import the statistics function
      const { queryStatisticsForQuantity } = await import('@kingstinct/react-native-healthkit');
      
      // Use statistics queries for accurate deduplicated totals
      // Correct API: filter.date with startDate/endDate
      const dateFilter = { filter: { date: { startDate: startOfDay, endDate: now } } };
      
      const [stepsStats, distanceStats, caloriesStats, heartRateData, sleepData] = await Promise.all([
        queryStatisticsForQuantity(
          'HKQuantityTypeIdentifierStepCount' as any,
          ['cumulativeSum'] as any,
          dateFilter
        ).catch(e => { console.log('📊 Steps stats error:', e); return null; }),
        
        queryStatisticsForQuantity(
          'HKQuantityTypeIdentifierDistanceWalkingRunning' as any,
          ['cumulativeSum'] as any,
          dateFilter
        ).catch(e => { console.log('📊 Distance stats error:', e); return null; }),
        
        queryStatisticsForQuantity(
          'HKQuantityTypeIdentifierActiveEnergyBurned' as any,
          ['cumulativeSum'] as any,
          dateFilter
        ).catch(e => { console.log('📊 Calories stats error:', e); return null; }),
        
        healthKitService.fetchHealthData({ type: 'heartRate', startDate: startOfDay, endDate: now, limit: 10 }).catch(e => { console.log('📊 Heart rate error:', e); return []; }),
        
        healthKitService.fetchHealthData({ type: 'sleep', startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000), endDate: now, limit: 10 }).catch(e => { console.log('📊 Sleep error:', e); return []; }),
      ]);

      // Extract deduplicated totals from statistics
      const totalSteps = (stepsStats as any)?.sumQuantity?.quantity || 0;
      const totalDistance = (distanceStats as any)?.sumQuantity?.quantity || 0;
      const totalCalories = (caloriesStats as any)?.sumQuantity?.quantity || 0;
      
      console.log('📊 Steps (deduplicated):', totalSteps);
      console.log('📊 Distance (deduplicated):', totalDistance);
      console.log('📊 Calories (deduplicated):', totalCalories);
      console.log('📊 Heart rate data:', heartRateData.length, 'items');
      console.log('📊 Sleep data:', sleepData.length, 'items');
      
      // Get latest heart rate
      const latestHeartRate = heartRateData.length > 0 ? heartRateData[0].value : null;
      
      // Calculate total sleep hours
      const totalSleepMs = sleepData.reduce((sum, d) => {
        if (d.startDate && d.endDate) {
          return sum + (d.endDate.getTime() - d.startDate.getTime());
        }
        return sum + (d.value || 0);
      }, 0);
      const totalSleepHours = totalSleepMs > 0 ? totalSleepMs / (1000 * 60 * 60) : null;

      const summary = {
        steps: totalSteps,
        distance: totalDistance,
        calories: totalCalories,
        heartRate: latestHeartRate,
        sleep: totalSleepHours,
      };

      console.log('📊 Daily summary:', summary);
      return summary;
    } catch (error) {
      console.error('📊 Error getting daily summary:', error);
      return {
        steps: 0,
        distance: 0,
        calories: 0,
        heartRate: null,
        sleep: null,
      };
    }
  }
}

export const healthDataSyncService = new HealthDataSyncService();
