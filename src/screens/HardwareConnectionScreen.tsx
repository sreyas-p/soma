import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Card, StatusPill, Button, HeaderButton } from '@/components/ui';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '@/navigation/types';
import * as ExpoDevice from 'expo-device';
import * as ExpoBattery from 'expo-battery';
import { HealthPermissionRequest, HealthDataDisplay } from '@/components/health';
import { useHealthKit } from '@/hooks/useHealthKit';

type HardwareConnectionScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'HardwareConnection'>;

interface BluetoothDevice {
  id: string;
  name: string;
  type: 'smartwatch' | 'fitness-tracker' | 'heart-monitor' | 'glucose-monitor' | 'scale';
  isConnected: boolean;
  isAvailable: boolean;
  batteryLevel?: number;
  lastSyncDate?: string;
}

export const HardwareConnectionScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<HardwareConnectionScreenNavigationProp>();
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);
  
  // Use real HealthKit hook instead of mock state
  const {
    isAvailable: appleHealthAvailable,
    isConnected: appleHealthConnected,
    isConnecting: appleHealthConnecting,
    connect: connectAppleHealth,
    disconnect: disconnectAppleHealth,
    syncData: syncAppleHealthData,
    connectionStatus: appleHealthStatus,
    error: appleHealthError
  } = useHealthKit();

  // Mock Bluetooth devices
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([
    {
      id: '1',
      name: 'Apple Watch Series 9',
      type: 'smartwatch',
      isConnected: false,
      isAvailable: true,
      batteryLevel: 85,
    },
    {
      id: '2',
      name: 'Fitbit Charge 6',
      type: 'fitness-tracker',
      isConnected: false,
      isAvailable: true,
      batteryLevel: 60,
    },
    {
      id: '3',
      name: 'Dexcom G7',
      type: 'glucose-monitor',
      isConnected: false,
      isAvailable: true,
      batteryLevel: 92,
    },
    {
      id: '4',
      name: 'Withings Body+',
      type: 'scale',
      isConnected: false,
      isAvailable: true,
    },
    {
      id: '5',
      name: 'Polar H10',
      type: 'heart-monitor',
      isConnected: false,
      isAvailable: true,
      batteryLevel: 45,
    },
  ]);

  // Check device capabilities on mount
  useEffect(() => {
    checkDeviceCapabilities();
  }, []);

  const checkDeviceCapabilities = async () => {
    try {
      // Check if device supports Bluetooth
      if (ExpoDevice.isDevice) {
        setBluetoothEnabled(true);
      }
      
      // Check battery status for demo
      const batteryLevel = await ExpoBattery.getBatteryLevelAsync();
      console.log('Device battery level:', batteryLevel);
    } catch (error) {
      console.log('Error checking device capabilities:', error);
    }
  };

  const getDeviceIcon = (type: BluetoothDevice['type']) => {
    switch (type) {
      case 'smartwatch':
        return 'watch-outline';
      case 'fitness-tracker':
        return 'fitness-outline';
      case 'heart-monitor':
        return 'heart-outline';
      case 'glucose-monitor':
        return 'medical-outline';
      case 'scale':
        return 'scale-outline';
      default:
        return 'hardware-chip-outline';
    }
  };

  const getDeviceColor = (type: BluetoothDevice['type']) => {
    switch (type) {
      case 'smartwatch':
        return theme.colors.primary;
      case 'fitness-tracker':
        return theme.colors.semantic.success;
      case 'heart-monitor':
        return theme.colors.semantic.error;
      case 'glucose-monitor':
        return theme.colors.semantic.warning;
      case 'scale':
        return theme.colors.semantic.info;
      default:
        return theme.colors.secondary;
    }
  };

  const handleScanBluetooth = async () => {
    if (!bluetoothEnabled) {
      Alert.alert(
        'Bluetooth Not Available',
        'Bluetooth is not available on this device or is disabled.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsScanning(true);
    
    // Simulate scanning delay
    setTimeout(() => {
      setIsScanning(false);
      Alert.alert(
        'Scan Complete',
        `Found ${bluetoothDevices.length} available devices.`,
        [{ text: 'OK' }]
      );
    }, 3000);
  };

  const handleConnectDevice = (deviceId: string) => {
    const device = bluetoothDevices.find(d => d.id === deviceId);
    if (!device) return;

    if (device.isConnected) {
      // Disconnect
      setBluetoothDevices(prev => 
        prev.map(d => 
          d.id === deviceId 
            ? { ...d, isConnected: false }
            : d
        )
      );
      Alert.alert('Device Disconnected', `${device.name} has been disconnected.`);
    } else {
      // Connect
      setBluetoothDevices(prev => 
        prev.map(d => 
          d.id === deviceId 
            ? { ...d, isConnected: true, lastSyncDate: new Date().toISOString() }
            : d
        )
      );
      Alert.alert('Device Connected', `${device.name} has been connected successfully!`);
    }
  };

  const handleAppleHealthConnect = async () => {
    if (!appleHealthAvailable) {
      Alert.alert(
        'Apple Health Unavailable',
        'Apple Health is only available on iOS devices.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (appleHealthConnected) {
      try {
        await disconnectAppleHealth();
        Alert.alert('Disconnected', 'Apple Health has been disconnected.');
      } catch (error) {
        Alert.alert('Error', 'Failed to disconnect from Apple Health.');
      }
    } else {
      try {
        const success = await connectAppleHealth();
        if (success) {
          Alert.alert(
            'Connected Successfully',
            'Apple Health is now connected! Your health data will be synced automatically.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Connection Failed',
            'Unable to connect to Apple Health. Please check your permissions and try again.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        Alert.alert('Error', 'An unexpected error occurred while connecting to Apple Health.');
      }
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
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          Hardware Connection
        </Text>
      </View>
      <View style={styles.headerRight}>
        <HeaderButton
          icon="refresh"
          onPress={handleScanBluetooth}
          disabled={isScanning}
          accessibilityLabel="Scan for devices"
          accessibilityHint="Scans for available Bluetooth devices"
        />
      </View>
    </View>
  );

  const renderAppleHealthCard = () => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Ionicons 
            name="medical-outline" 
            size={24} 
            color={theme.colors.primary} 
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
            Apple Health Integration
          </Text>
        </View>
        <StatusPill
          status={appleHealthConnected ? 'connected' : 'disconnected'}
          text={appleHealthConnected ? 'Connected' : 'Not Connected'}
        />
      </View>
      
      <Text style={[styles.cardDescription, { color: theme.colors.textSecondary }]}>
        Connect to Apple Health to automatically sync your health data including steps, heart rate, sleep, and more.
      </Text>

      {/* HealthKit Permission Request Component */}
      <HealthPermissionRequest
        onPermissionGranted={() => {
          // Refresh data after permission is granted
          console.log('HealthKit permission granted');
        }}
        onPermissionDenied={() => {
          console.log('HealthKit permission denied');
        }}
      />

      {/* Health Data Display Component */}
      {appleHealthConnected && (
        <HealthDataDisplay
          onRefresh={() => {
            // Refresh the screen data
            console.log('Refreshing health data');
          }}
        />
      )}
    </Card>
  );

  const renderBluetoothCard = () => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Ionicons 
            name="bluetooth-outline" 
            size={24} 
            color={theme.colors.primary} 
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
            Bluetooth Devices
          </Text>
        </View>
        <View style={styles.bluetoothStatus}>
          <View style={[
            styles.bluetoothIndicator,
            { backgroundColor: bluetoothEnabled ? theme.colors.semantic.success : theme.colors.semantic.error }
          ]} />
          <Text style={[styles.bluetoothStatusText, { color: theme.colors.textSecondary }]}>
            {bluetoothEnabled ? 'Available' : 'Unavailable'}
          </Text>
        </View>
      </View>

      <Text style={[styles.cardDescription, { color: theme.colors.textSecondary }]}>
        Connect to your wearable devices and health monitors to sync data automatically.
      </Text>

      <View style={styles.devicesContainer}>
        {bluetoothDevices.map((device) => (
          <TouchableOpacity
            key={device.id}
            style={[
              styles.deviceItem,
              {
                backgroundColor: theme.colors.surface,
                borderColor: typeof theme.colors.border === 'string' 
                  ? theme.colors.border 
                  : theme.colors.border.light,
              }
            ]}
            onPress={() => handleConnectDevice(device.id)}
            disabled={!device.isAvailable}
          >
            <View style={styles.deviceInfo}>
              <View style={styles.deviceIconContainer}>
                <Ionicons 
                  name={getDeviceIcon(device.type)} 
                  size={24} 
                  color={getDeviceColor(device.type)} 
                />
              </View>
              <View style={styles.deviceDetails}>
                <Text style={[styles.deviceName, { color: theme.colors.text.primary }]}>
                  {device.name}
                </Text>
                <Text style={[styles.deviceType, { color: theme.colors.textSecondary }]}>
                  {device.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
                {device.batteryLevel && (
                  <View style={styles.batteryContainer}>
                    <Ionicons 
                      name="battery-half" 
                      size={14} 
                      color={theme.colors.textSecondary} 
                    />
                    <Text style={[styles.batteryText, { color: theme.colors.textSecondary }]}>
                      {device.batteryLevel}%
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            <View style={styles.deviceActions}>
              <StatusPill
                status={device.isConnected ? 'connected' : 'disconnected'}
                text={device.isConnected ? 'Connected' : 'Connect'}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Button
        title={isScanning ? 'Scanning...' : 'Scan for Devices'}
        onPress={handleScanBluetooth}
        disabled={isScanning || !bluetoothEnabled}
        style={styles.scanButton}
        icon={isScanning ? 'refresh' : 'bluetooth'}
      />
    </Card>
  );

  const renderDataSyncCard = () => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Ionicons 
            name="sync-outline" 
            size={24} 
            color={theme.colors.primary} 
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
            Data Synchronization
          </Text>
        </View>
      </View>

      <Text style={[styles.cardDescription, { color: theme.colors.textSecondary }]}>
        Manage how your health data is synchronized between connected devices and services.
      </Text>

      <View style={styles.syncOptions}>
        <TouchableOpacity style={styles.syncOption}>
          <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
          <Text style={[styles.syncOptionText, { color: theme.colors.text.primary }]}>
            Auto-sync every 15 minutes
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.syncOption}>
          <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
          <Text style={[styles.syncOptionText, { color: theme.colors.text.primary }]}>
            Sync notifications
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.syncOption}>
          <Ionicons name="shield-outline" size={20} color={theme.colors.primary} />
          <Text style={[styles.syncOptionText, { color: theme.colors.text.primary }]}>
            Privacy settings
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {renderHeader()}
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderAppleHealthCard()}
        {renderBluetoothCard()}
        {renderDataSyncCard()}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  bluetoothStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bluetoothIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bluetoothStatusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  devicesContainer: {
    gap: 12,
    marginBottom: 16,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  deviceType: {
    fontSize: 14,
    marginBottom: 4,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  batteryText: {
    fontSize: 12,
  },
  deviceActions: {
    alignItems: 'flex-end',
  },
  scanButton: {
    marginTop: 8,
  },
  syncOptions: {
    gap: 12,
  },
  syncOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    gap: 12,
  },
  syncOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
}); 