import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Card, StatusPill, Button, HeaderButton } from '@/components/ui';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '@/navigation/types';
import { useHealthKit } from '@/hooks/useHealthKit';
import { healthDataSyncService } from '@/services/healthDataSync';

type ConnectedDevicesScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'ConnectedDevices'>;

interface HealthSummary {
  steps: number;
  distance: number;
  calories: number;
  heartRate: number | null;
  sleep: number | null;
}

export const ConnectedDevicesScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<ConnectedDevicesScreenNavigationProp>();
  
  // HealthKit hook
  const {
    isAvailable,
    isConnected,
    isConnecting,
    isSyncing,
    permissions,
    lastSync,
    error,
    connectionStatus,
    requestPermissions,
    disconnect,
    syncHealthData,
  } = useHealthKit();

  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load health summary when connected
  const loadHealthSummary = useCallback(async () => {
    if (!isConnected) return;
    
    setIsLoadingSummary(true);
    try {
      const summary = await healthDataSyncService.getDailySummary();
      setHealthSummary(summary);
    } catch (error) {
      console.error('Error loading health summary:', error);
    } finally {
      setIsLoadingSummary(false);
    }
  }, [isConnected]);

  useEffect(() => {
    loadHealthSummary();
  }, [loadHealthSummary]);

  const handleConnectAppleHealth = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Not Available', 'Apple Health is only available on iOS devices.');
      return;
    }

    try {
      console.log('ConnectedDevices: Calling requestPermissions...');
      const success = await requestPermissions();
      console.log('ConnectedDevices: requestPermissions returned:', success);
      
      if (success) {
        Alert.alert('Connected!', 'Apple Health is now connected. Your health data will sync automatically.');
        // Initial sync after connecting
        await syncHealthData();
        await loadHealthSummary();
      } else {
        // Show more detailed error info
        Alert.alert(
          'Connection Issue',
          `Could not verify HealthKit access.\n\nTap the "Test" button to see detailed diagnostics.\n\nIf permissions are already granted in Settings, data should still be readable.`,
          [
            { text: 'OK' },
          ]
        );
      }
    } catch (err: any) {
      console.log('ConnectedDevices: Error caught:', err);
      Alert.alert(
        'Connection Error', 
        `Error: ${err?.message || err || 'Unknown'}\n\nTap "Test" for diagnostics.`
      );
    }
  };

  const handleSyncNow = async () => {
    try {
      // Get detailed sync result from the service
      const syncResult = await healthDataSyncService.syncHealthData();
      
      if (syncResult.success) {
        const summary = await healthDataSyncService.getDailySummary();
        setHealthSummary(summary);
        
        // Build message based on auth type
        let message = `Steps: ${summary.steps}\nCalories: ${Math.round(summary.calories)}\nDistance: ${summary.distance}m\nHeart Rate: ${summary.heartRate || 'N/A'}\nSleep: ${summary.sleep ? summary.sleep.toFixed(1) + 'h' : 'N/A'}`;
        
        if (!syncResult.supabaseStorageEnabled) {
          message += '\n\n⚠️ Cloud sync disabled (local account).\nSign in with email to enable cloud backup.';
        } else {
          message += `\n\n✅ ${syncResult.dataCount || 0} records synced to cloud`;
        }
        
        Alert.alert('Sync Complete', message, [{ text: 'OK' }]);
      } else {
        Alert.alert('Sync Issue', syncResult.error || 'Unknown error');
      }
    } catch (error) {
      Alert.alert('Sync Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Diagnostic test for HealthKit
  const handleTestHealthKit = async () => {
    try {
      const HK = require('@kingstinct/react-native-healthkit');
      
      // Use string identifiers directly (not constants)
      const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount';
      const CALORIES = 'HKQuantityTypeIdentifierActiveEnergyBurned';
      
      let available = false;
      try {
        available = HK.isHealthDataAvailable();
      } catch (e: any) {
        Alert.alert('Module Error', `isHealthDataAvailable failed: ${e?.message}`);
        return;
      }
      
      // Get start of today
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Try to read steps using STATISTICS (auto-deduplicates)
      let stepsResult = 'Not tested';
      let stepsError = '';
      let stepsDebug = '';
      
      try {
        // Correct API: filter.date with startDate/endDate
        const statsResult = await HK.queryStatisticsForQuantity(
          STEP_COUNT, 
          ['cumulativeSum'],
          { 
            filter: {
              date: {
                startDate: startOfToday,
                endDate: now
              }
            }
          }
        );
        
        console.log('Steps stats response:', JSON.stringify(statsResult, null, 2));
        
        const respStart = statsResult?.startDate ? new Date(statsResult.startDate).toLocaleString() : 'N/A';
        const respEnd = statsResult?.endDate ? new Date(statsResult.endDate).toLocaleString() : 'N/A';
        stepsDebug = `\nHK Range: ${respStart} - ${respEnd}`;
        
        const sumQty = statsResult?.sumQuantity?.quantity;
        stepsDebug += `\nSum: ${sumQty}`;
        
        stepsResult = `${Math.round(sumQty || 0)} steps`;
      } catch (e: any) {
        stepsError = e?.message || String(e);
        stepsResult = 'Error';
      }

      // Try to read calories using STATISTICS
      let caloriesResult = 'Not tested';
      let caloriesError = '';
      
      try {
        const statsResult = await HK.queryStatisticsForQuantity(
          CALORIES, 
          ['cumulativeSum'],
          { 
            filter: {
              date: {
                startDate: startOfToday,
                endDate: now
              }
            }
          }
        );
        const totalCals = statsResult?.sumQuantity?.quantity || 0;
        caloriesResult = `${Math.round(totalCals)} kcal`;
      } catch (e: any) {
        caloriesError = e?.message || String(e);
        caloriesResult = 'Error';
      }
      
      Alert.alert(
        'HealthKit Test', 
        [
          `Available: ${available}`,
          `Date: ${startOfToday.toLocaleDateString()}`,
          ``,
          `Steps (Today): ${stepsResult}`,
          stepsDebug,
          stepsError ? `  Error: ${stepsError}` : '',
          ``,
          `Calories (Today): ${caloriesResult}`,
          caloriesError ? `  Error: ${caloriesError}` : '',
        ].filter(Boolean).join('\n'),
        [
          { text: 'OK' },
          { 
            text: 'Request Auth', 
            onPress: async () => {
              try {
                await HK.requestAuthorization([STEP_COUNT, CALORIES], []);
                Alert.alert('Done', 'Authorization requested. Tap Diagnose again to check data access.');
              } catch (e: any) {
                Alert.alert('Auth Error', e?.message || String(e));
              }
            }
          },
        ]
      );

    } catch (error: any) {
      Alert.alert('Import Error', `${error?.message || error}`);
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Apple Health?',
      'This will stop syncing your health data. Your existing data will remain stored.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: async () => {
            await disconnect();
            setHealthSummary(null);
          }
        },
      ]
    );
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (isConnected) {
      await syncHealthData();
      await loadHealthSummary();
    }
    setIsRefreshing(false);
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes === 1) return '1 minute ago';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    return date.toLocaleDateString();
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return theme.colors.semantic.success;
      case 'connecting': return theme.colors.semantic.warning;
      case 'error': return theme.colors.semantic.error;
      default: return theme.colors.text.disabled;
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <HeaderButton
        icon="menu"
        onPress={() => navigation.openDrawer()}
        accessibilityLabel="Open navigation menu"
        accessibilityHint="Opens the main navigation drawer with app sections"
      />
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>Connected Devices</Text>
      </View>
      <View style={styles.headerRight} />
    </View>
  );

  const renderAppleHealthCard = () => (
    <Card style={styles.deviceCard} variant="elevated">
      <View style={styles.deviceHeader}>
        <View style={styles.deviceInfo}>
          <View style={styles.deviceTitleRow}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.error + '20' }]}>
              <Ionicons name="heart" size={28} color={theme.colors.semantic.error} />
            </View>
            <View style={styles.deviceDetails}>
              <Text style={[styles.deviceName, { color: theme.colors.text.primary }]}>
                Apple Health
              </Text>
              <Text style={[styles.deviceBrand, { color: theme.colors.text.secondary }]}>
                {isAvailable ? 'Available on this device' : 'Not available'}
              </Text>
            </View>
          </View>
          <StatusPill
            status={connectionStatus === 'connected' ? 'optimal' : connectionStatus === 'connecting' ? 'syncing' : 'disconnected'}
            text={connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Not Connected'}
          />
        </View>
      </View>

      {isConnected && (
        <>
          <View style={styles.syncInfo}>
            <View style={styles.syncRow}>
              <Ionicons name="sync-outline" size={16} color={theme.colors.text.secondary} />
              <Text style={[styles.syncText, { color: theme.colors.text.secondary }]}>
                Last synced: {formatLastSync(lastSync)}
              </Text>
            </View>
            {permissions.filter(p => p.read).length > 0 && (
              <Text style={[styles.permissionText, { color: theme.colors.text.tertiary }]}>
                {permissions.filter(p => p.read).length} data types syncing
              </Text>
            )}
          </View>

          {/* Health Summary */}
          {isLoadingSummary ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
                Loading health data...
              </Text>
            </View>
          ) : healthSummary && (
            <View style={styles.summaryContainer}>
              <Text style={[styles.summaryTitle, { color: theme.colors.text.primary }]}>
                Today's Summary
              </Text>
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Ionicons name="walk" size={20} color={theme.colors.semantic.warning} />
                  <Text style={[styles.summaryValue, { color: theme.colors.text.primary }]}>
                    {healthSummary.steps.toLocaleString()}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.colors.text.secondary }]}>
                    Steps
                  </Text>
                </View>
                <View style={[styles.summaryItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Ionicons name="flame" size={20} color={theme.colors.semantic.error} />
                  <Text style={[styles.summaryValue, { color: theme.colors.text.primary }]}>
                    {Math.round(healthSummary.calories)}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.colors.text.secondary }]}>
                    Calories
                  </Text>
                </View>
                <View style={[styles.summaryItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Ionicons name="heart" size={20} color={theme.colors.primary} />
                  <Text style={[styles.summaryValue, { color: theme.colors.text.primary }]}>
                    {healthSummary.heartRate ? `${Math.round(healthSummary.heartRate)}` : '--'}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.colors.text.secondary }]}>
                    BPM
                  </Text>
                </View>
                <View style={[styles.summaryItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Ionicons name="moon" size={20} color={theme.colors.secondary} />
                  <Text style={[styles.summaryValue, { color: theme.colors.text.primary }]}>
                    {healthSummary.sleep ? `${healthSummary.sleep.toFixed(1)}` : '--'}
                  </Text>
                  <Text style={[styles.summaryLabel, { color: theme.colors.text.secondary }]}>
                    Sleep hrs
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.deviceActions}>
            <Button
              title={isSyncing ? "Syncing..." : "Sync Now"}
              variant="outline"
              size="sm"
              onPress={handleSyncNow}
              icon="refresh-outline"
              disabled={isSyncing}
            />
            <Button
              title="Test"
              variant="ghost"
              size="sm"
              onPress={handleTestHealthKit}
              icon="bug-outline"
            />
            <Button
              title="Disconnect"
              variant="ghost"
              size="sm"
              onPress={handleDisconnect}
              icon="close-outline"
            />
          </View>
        </>
      )}

      {!isConnected && isAvailable && (
        <View style={styles.connectContainer}>
          <Text style={[styles.connectDescription, { color: theme.colors.text.secondary }]}>
            Connect Apple Health to sync your steps, heart rate, sleep, workouts, and more.
          </Text>
          <Button
            title={isConnecting ? "Connecting..." : "Connect Apple Health"}
            variant="primary"
            size="md"
            onPress={handleConnectAppleHealth}
            icon="heart-outline"
            disabled={isConnecting}
          />
          <View style={{ marginTop: 16 }}>
            <Button
              title="🔧 Diagnose"
              variant="outline"
              size="sm"
              onPress={handleTestHealthKit}
              icon="bug-outline"
            />
          </View>
        </View>
      )}

      {!isAvailable && (
        <View style={styles.unavailableContainer}>
          <Ionicons name="alert-circle-outline" size={24} color={theme.colors.text.disabled} />
          <Text style={[styles.unavailableText, { color: theme.colors.text.disabled }]}>
            Apple Health is only available on iOS devices.
          </Text>
        </View>
      )}

      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.semantic.error + '10' }]}>
          <Ionicons name="warning-outline" size={16} color={theme.colors.semantic.error} />
          <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
            {error}
          </Text>
        </View>
      )}
    </Card>
  );

  const renderDataTypesCard = () => {
    if (!isConnected) return null;

    const dataTypes = [
      { type: 'steps', icon: 'walk', label: 'Steps', color: theme.colors.semantic.warning },
      { type: 'distance', icon: 'navigate', label: 'Distance', color: theme.colors.primary },
      { type: 'calories', icon: 'flame', label: 'Active Energy', color: theme.colors.semantic.error },
      { type: 'heartRate', icon: 'heart', label: 'Heart Rate', color: '#FF6B6B' },
      { type: 'sleep', icon: 'moon', label: 'Sleep', color: theme.colors.secondary },
      { type: 'weight', icon: 'scale', label: 'Weight', color: '#4ECDC4' },
      { type: 'workout', icon: 'barbell', label: 'Workouts', color: theme.colors.semantic.success },
      { type: 'mindfulness', icon: 'leaf', label: 'Mindfulness', color: '#95E1D3' },
    ];

    return (
      <Card style={styles.dataTypesCard} variant="outlined">
        <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
          Syncing Data Types
        </Text>
        <View style={styles.dataTypesGrid}>
          {dataTypes.map((item) => {
            const permission = permissions.find(p => p.type === item.type);
            const isEnabled = permission?.read ?? false;
            
            return (
              <View 
                key={item.type} 
                style={[
                  styles.dataTypeItem,
                  { 
                    backgroundColor: isEnabled 
                      ? item.color + '15' 
                      : theme.colors.surfaceVariant,
                    borderColor: isEnabled ? item.color : 'transparent',
                    borderWidth: isEnabled ? 1 : 0,
                  }
                ]}
              >
                <Ionicons 
                  name={item.icon as any} 
                  size={20} 
                  color={isEnabled ? item.color : theme.colors.text.disabled} 
                />
                <Text 
                  style={[
                    styles.dataTypeLabel, 
                    { color: isEnabled ? theme.colors.text.primary : theme.colors.text.disabled }
                  ]}
                >
                  {item.label}
                </Text>
                {isEnabled && (
                  <Ionicons 
                    name="checkmark-circle" 
                    size={14} 
                    color={item.color} 
                    style={styles.checkIcon}
                  />
                )}
              </View>
            );
          })}
        </View>
      </Card>
    );
  };

  const renderInfoCard = () => (
    <Card style={styles.infoCard} variant="outlined">
      <View style={styles.infoHeader}>
        <Ionicons name="information-circle-outline" size={24} color={theme.colors.primary} />
        <Text style={[styles.infoTitle, { color: theme.colors.text.primary }]}>
          About Health Data Sync
        </Text>
      </View>
      <Text style={[styles.infoText, { color: theme.colors.text.secondary }]}>
        Your health data is securely synced and stored. Only you can access your data, and it's used to provide personalized health insights.
      </Text>
      <View style={styles.infoBullets}>
        <View style={styles.bulletItem}>
          <Ionicons name="shield-checkmark" size={16} color={theme.colors.semantic.success} />
          <Text style={[styles.bulletText, { color: theme.colors.text.secondary }]}>
            End-to-end encrypted
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Ionicons name="cloud-done" size={16} color={theme.colors.primary} />
          <Text style={[styles.bulletText, { color: theme.colors.text.secondary }]}>
            Backed up to secure cloud
          </Text>
        </View>
        <View style={styles.bulletItem}>
          <Ionicons name="eye-off" size={16} color={theme.colors.secondary} />
          <Text style={[styles.bulletText, { color: theme.colors.text.secondary }]}>
            Never shared with third parties
          </Text>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {renderHeader()}
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Apple Health Integration */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.colors.text.primary }]}>
            Health Data Source
          </Text>
          {renderAppleHealthCard()}
        </View>

        {/* Data Types */}
        <View style={styles.section}>
          {renderDataTypesCard()}
        </View>

        {/* Info Card */}
        <View style={styles.section}>
          {renderInfoCard()}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    width: 50,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    opacity: 0.7,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  deviceCard: {
    padding: 20,
  },
  deviceHeader: {
    marginBottom: 16,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceDetails: {
    marginLeft: 14,
    flex: 1,
  },
  deviceName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  deviceBrand: {
    fontSize: 13,
  },
  syncInfo: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncText: {
    marginLeft: 8,
    fontSize: 13,
  },
  permissionText: {
    marginTop: 4,
    marginLeft: 24,
    fontSize: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
  },
  summaryContainer: {
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryItem: {
    width: '48%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  deviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  connectContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  connectDescription: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  unavailableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  unavailableText: {
    marginLeft: 10,
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 13,
    flex: 1,
  },
  dataTypesCard: {
    padding: 20,
  },
  dataTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dataTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  dataTypeLabel: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 6,
  },
  infoCard: {
    padding: 20,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 10,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  infoBullets: {
    gap: 10,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bulletText: {
    marginLeft: 10,
    fontSize: 13,
  },
});
