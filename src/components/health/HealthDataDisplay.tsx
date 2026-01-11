import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useHealthKit } from '@/hooks/useHealthKit';
import { HealthData, HealthDataType } from '@/types/health';

interface HealthDataDisplayProps {
  onRefresh?: () => void;
}

export const HealthDataDisplay: React.FC<HealthDataDisplayProps> = ({ onRefresh }) => {
  const { theme } = useTheme();
  const {
    isConnected,
    lastSync,
    isSyncing,
    syncData,
    readData,
    error
  } = useHealthKit();

  const [healthData, setHealthData] = useState<Record<HealthDataType, HealthData[]>>({} as Record<HealthDataType, HealthData[]>);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isConnected) {
      loadHealthData();
    }
  }, [isConnected]);

  const loadHealthData = async () => {
    if (!isConnected) return;

    setIsLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      const dataTypes: HealthDataType[] = ['steps', 'heartRate', 'sleep', 'weight'];
      const newHealthData: Record<HealthDataType, HealthData[]> = {} as Record<HealthDataType, HealthData[]>;

      for (const dataType of dataTypes) {
        try {
          const data = await readData({
            type: dataType,
            startDate,
            endDate,
            limit: 7
          });
          newHealthData[dataType] = data;
        } catch (err) {
          console.error(`Failed to load ${dataType}:`, err);
          newHealthData[dataType] = [];
        }
      }

      setHealthData(newHealthData);
    } catch (err) {
      console.error('Failed to load health data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    await syncData();
    await loadHealthData();
    onRefresh?.();
  };

  const getDataTypeIcon = (type: HealthDataType): string => {
    switch (type) {
      case 'steps': return 'footsteps';
      case 'heartRate': return 'heart';
      case 'sleep': return 'moon';
      case 'weight': return 'scale';
      case 'distance': return 'map';
      case 'calories': return 'flame';
      default: return 'pulse';
    }
  };

  const getDataTypeLabel = (type: HealthDataType): string => {
    switch (type) {
      case 'steps': return 'Steps';
      case 'heartRate': return 'Heart Rate';
      case 'sleep': return 'Sleep';
      case 'weight': return 'Weight';
      case 'distance': return 'Distance';
      case 'calories': return 'Calories';
      default: return type;
    }
  };

  const getLatestValue = (data: HealthData[]): string => {
    if (!data || data.length === 0) return 'No data';

    const latest = data[data.length - 1];
    return `${latest.value} ${latest.unit}`;
  };

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text style={[styles.noDataText, { color: theme.colors.text.secondary }]}>
          Connect to Apple Health to view your data
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          Health Data
        </Text>
        <TouchableOpacity
          style={[styles.syncButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name="refresh" size={16} color="white" />
          )}
        </TouchableOpacity>
      </View>

      {/* Last Sync Info */}
      {lastSync && (
        <Text style={[styles.lastSyncText, { color: theme.colors.text.tertiary }]}>
          Last synced: {lastSync.toLocaleString()}
        </Text>
      )}

      {/* Error Display */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.semantic.error + '20' }]}>
          <Ionicons name="alert-circle" size={16} color={theme.colors.semantic.error} />
          <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Health Data Grid */}
      <ScrollView style={styles.dataContainer} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
              Loading health data...
            </Text>
          </View>
        ) : (
          <View style={styles.dataGrid}>
            {Object.entries(healthData).map(([type, data]) => (
              <View
                key={type}
                style={[styles.dataCard, { backgroundColor: theme.colors.surface }]}
              >
                <View style={[styles.dataIcon, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Ionicons
                    name={getDataTypeIcon(type as HealthDataType) as any}
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={[styles.dataLabel, { color: theme.colors.text.secondary }]}>
                  {getDataTypeLabel(type as HealthDataType)}
                </Text>
                <Text style={[styles.dataValue, { color: theme.colors.text.primary }]}>
                  {getLatestValue(data)}
                </Text>
                <Text style={[styles.dataCount, { color: theme.colors.text.tertiary }]}>
                  {data.length} records
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  syncButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastSyncText: {
    fontSize: 12,
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
  },
  dataContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dataCard: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dataIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  dataValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  dataCount: {
    fontSize: 12,
    textAlign: 'center',
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    fontStyle: 'italic',
    paddingVertical: 40,
  },
});
