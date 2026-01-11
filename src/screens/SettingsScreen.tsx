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
  Switch,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Card, StatusPill, Button, HeaderButton } from '@/components/ui';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '@/navigation/types';
import { useHealthKit } from '@/hooks/useHealthKit';
import { useAuth } from '@/contexts/AuthContext';
import { healthDataSyncService } from '@/services/healthDataSync';

type SettingsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Settings'>;

interface HealthSummary {
  steps: number;
  distance: number;
  calories: number;
  heartRate: number | null;
  sleep: number | null;
}

export const SettingsScreen: React.FC = () => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { user, signOut, updateProfile } = useAuth();

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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Profile editing state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editAge, setEditAge] = useState(user?.age?.toString() || '');
  const [editWeight, setEditWeight] = useState(user?.weight?.toString() || '');
  const [editHeight, setEditHeight] = useState(user?.height?.toString() || '');
  const [editGender, setEditGender] = useState<'male' | 'female' | 'other' | 'prefer_not_to_say'>(user?.gender || 'prefer_not_to_say');
  const [editGoals, setEditGoals] = useState(user?.goals || '');

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditAge(user.age?.toString() || '');
      setEditWeight(user.weight?.toString() || '');
      setEditHeight(user.height?.toString() || '');
      setEditGender(user.gender || 'prefer_not_to_say');
      setEditGoals(user.goals || '');
    }
  }, [user]);

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
      const success = await requestPermissions();
      
      if (success) {
        Alert.alert('Connected!', 'Apple Health is now connected. Your health data will sync automatically.');
        await syncHealthData();
        await loadHealthSummary();
      } else {
        Alert.alert(
          'Connection Issue',
          'Could not verify HealthKit access. Please check your settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (err: any) {
      Alert.alert('Connection Error', `Error: ${err?.message || 'Unknown'}`);
    }
  };

  const handleSyncNow = async () => {
    try {
      const syncResult = await healthDataSyncService.syncHealthData();
      
      if (syncResult.success) {
        const summary = await healthDataSyncService.getDailySummary();
        setHealthSummary(summary);
        
        let message = `Steps: ${summary.steps.toLocaleString()}\nCalories: ${Math.round(summary.calories)}\nHeart Rate: ${summary.heartRate || 'N/A'} BPM`;
        
        if (!syncResult.supabaseStorageEnabled) {
          message += '\n\n⚠️ Cloud sync disabled (local account)';
        } else {
          message += '\n\n✅ Synced to cloud';
        }
        
        Alert.alert('Sync Complete', message);
      } else {
        Alert.alert('Sync Issue', syncResult.error || 'Unknown error');
      }
    } catch (error) {
      Alert.alert('Sync Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const result = await updateProfile({
        name: editName.trim(),
        age: editAge ? parseInt(editAge, 10) : undefined,
        weight: editWeight ? parseFloat(editWeight) : undefined,
        height: editHeight ? parseFloat(editHeight) : undefined,
        gender: editGender,
        goals: editGoals.trim(),
      });

      if (result.success) {
        setShowProfileModal(false);
        Alert.alert('Success', 'Your profile has been updated.');
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const formatHeight = (inches: number): string => {
    if (!inches) return '--';
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round(inches % 12);
    return `${feet}'${remainingInches}"`;
  };

  const formatWeight = (lbs: number): string => {
    if (!lbs) return '--';
    return `${Math.round(lbs)} lbs`;
  };

  const getGenderLabel = (gender: string): string => {
    switch (gender) {
      case 'male': return 'Male';
      case 'female': return 'Female';
      case 'other': return 'Other';
      default: return 'Not specified';
    }
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
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    return date.toLocaleDateString();
  };

  const getThemeIcon = (): string => {
    switch (themeMode) {
      case 'dark': return 'moon';
      case 'light': return 'sunny';
      default: return 'phone-portrait-outline';
    }
  };

  const getThemeLabel = (): string => {
    switch (themeMode) {
      case 'dark': return 'Dark';
      case 'light': return 'Light';
      default: return 'System';
    }
  };

  const cycleTheme = () => {
    const nextTheme = themeMode === 'system' ? 'light' : 
                      themeMode === 'light' ? 'dark' : 'system';
    setThemeMode(nextTheme);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <HeaderButton
        icon="menu"
        onPress={() => navigation.openDrawer()}
        accessibilityLabel="Open navigation menu"
      />
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>Settings</Text>
      </View>
      <View style={styles.headerRight} />
    </View>
  );

  // Apple Health Section
  const renderAppleHealthSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: theme.colors.text.secondary }]}>
        APPLE HEALTH
      </Text>
      
      <Card style={styles.card} variant="outlined">
        {/* Connection Status */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.error + '20' }]}>
              <Ionicons name="heart" size={22} color={theme.colors.semantic.error} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>
                Apple Health
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                {isConnected ? `Last synced: ${formatLastSync(lastSync)}` : 'Not connected'}
              </Text>
            </View>
          </View>
          <StatusPill
            status={connectionStatus === 'connected' ? 'optimal' : connectionStatus === 'connecting' ? 'syncing' : 'disconnected'}
            text={connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting' : 'Off'}
          />
        </View>

        {/* Connected State */}
        {isConnected && (
          <>
            {/* Health Summary */}
            {isLoadingSummary ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
                  Loading health data...
                </Text>
              </View>
            ) : healthSummary && (
              <View style={styles.healthSummaryContainer}>
                <View style={styles.healthGrid}>
                  <View style={[styles.healthItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Ionicons name="walk" size={18} color={theme.colors.semantic.warning} />
                    <Text style={[styles.healthValue, { color: theme.colors.text.primary }]}>
                      {healthSummary.steps.toLocaleString()}
                    </Text>
                    <Text style={[styles.healthLabel, { color: theme.colors.text.secondary }]}>Steps</Text>
                  </View>
                  <View style={[styles.healthItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Ionicons name="flame" size={18} color={theme.colors.semantic.error} />
                    <Text style={[styles.healthValue, { color: theme.colors.text.primary }]}>
                      {Math.round(healthSummary.calories)}
                    </Text>
                    <Text style={[styles.healthLabel, { color: theme.colors.text.secondary }]}>Cal</Text>
                  </View>
                  <View style={[styles.healthItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Ionicons name="heart" size={18} color={theme.colors.primary} />
                    <Text style={[styles.healthValue, { color: theme.colors.text.primary }]}>
                      {healthSummary.heartRate ? Math.round(healthSummary.heartRate) : '--'}
                    </Text>
                    <Text style={[styles.healthLabel, { color: theme.colors.text.secondary }]}>BPM</Text>
                  </View>
                  <View style={[styles.healthItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Ionicons name="moon" size={18} color={theme.colors.secondary} />
                    <Text style={[styles.healthValue, { color: theme.colors.text.primary }]}>
                      {healthSummary.sleep ? healthSummary.sleep.toFixed(1) : '--'}
                    </Text>
                    <Text style={[styles.healthLabel, { color: theme.colors.text.secondary }]}>Hrs</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Data Types */}
            <View style={styles.dataTypesContainer}>
              <Text style={[styles.dataTypesTitle, { color: theme.colors.text.secondary }]}>
                Syncing {permissions.filter(p => p.read).length} data types
              </Text>
              <View style={styles.dataTypesList}>
                {['Steps', 'Heart Rate', 'Sleep', 'Calories', 'Workouts'].map((type, i) => (
                  <View key={type} style={[styles.dataTypeBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Ionicons name="checkmark-circle" size={12} color={theme.colors.primary} />
                    <Text style={[styles.dataTypeText, { color: theme.colors.primary }]}>{type}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.healthActions}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                onPress={handleSyncNow}
                disabled={isSyncing}
              >
                <Ionicons name="sync" size={18} color={theme.colors.onPrimary} />
                <Text style={[styles.actionButtonText, { color: theme.colors.onPrimary }]}>
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={handleDisconnect}
              >
                <Ionicons name="close-circle-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={[styles.actionButtonText, { color: theme.colors.text.secondary }]}>
                  Disconnect
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Not Connected State */}
        {!isConnected && isAvailable && (
          <View style={styles.connectContainer}>
            <Text style={[styles.connectDescription, { color: theme.colors.text.secondary }]}>
              Connect to sync steps, heart rate, sleep, workouts, and more.
            </Text>
            <TouchableOpacity 
              style={[styles.connectButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleConnectAppleHealth}
              disabled={isConnecting}
            >
              <Ionicons name="heart-outline" size={20} color={theme.colors.onPrimary} />
              <Text style={[styles.connectButtonText, { color: theme.colors.onPrimary }]}>
                {isConnecting ? 'Connecting...' : 'Connect Apple Health'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Not Available */}
        {!isAvailable && (
          <View style={styles.unavailableContainer}>
            <Ionicons name="alert-circle-outline" size={20} color={theme.colors.text.disabled} />
            <Text style={[styles.unavailableText, { color: theme.colors.text.disabled }]}>
              Apple Health is only available on iOS devices.
            </Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.colors.semantic.error + '10' }]}>
            <Ionicons name="warning-outline" size={16} color={theme.colors.semantic.error} />
            <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>{error}</Text>
          </View>
        )}
      </Card>
    </View>
  );

  // Appearance Section
  const renderAppearanceSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: theme.colors.text.secondary }]}>
        APPEARANCE
      </Text>
      
      <Card style={styles.card} variant="outlined">
        <TouchableOpacity style={styles.settingRow} onPress={cycleTheme}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name={getThemeIcon() as any} size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>Theme</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                {getThemeLabel()}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      </Card>
    </View>
  );

  // Notifications Section
  const renderNotificationsSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: theme.colors.text.secondary }]}>
        NOTIFICATIONS
      </Text>
      
      <Card style={styles.card} variant="outlined">
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.warning + '20' }]}>
              <Ionicons name="notifications" size={22} color={theme.colors.semantic.warning} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>
                Push Notifications
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                Daily reminders and health alerts
              </Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: theme.colors.border.default, true: theme.colors.primary + '60' }}
            thumbColor={notificationsEnabled ? theme.colors.primary : theme.colors.text.tertiary}
          />
        </View>
      </Card>
    </View>
  );

  // Account Section
  const renderAccountSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: theme.colors.text.secondary }]}>
        ACCOUNT
      </Text>
      
      <Card style={styles.card} variant="outlined">
        {/* User Info */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondary + '20' }]}>
              <Ionicons name="person" size={22} color={theme.colors.secondary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>
                {user?.name || 'User'}
              </Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                {user?.email || 'No email'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.border.light }]} />

        {/* Sign Out */}
        <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.error + '20' }]}>
              <Ionicons name="log-out-outline" size={22} color={theme.colors.semantic.error} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.semantic.error }]}>
                Sign Out
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      </Card>
    </View>
  );

  // Personal Information Section
  const renderPersonalInfoSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: theme.colors.text.secondary }]}>
        PERSONAL INFORMATION
      </Text>
      
      <Card style={styles.card} variant="outlined">
        {/* Name */}
        <TouchableOpacity style={styles.settingRow} onPress={() => setShowProfileModal(true)}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="person-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>Name</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                {user?.name || 'Not set'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.colors.border.light }]} />

        {/* Age */}
        <TouchableOpacity style={styles.settingRow} onPress={() => setShowProfileModal(true)}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondary + '20' }]}>
              <Ionicons name="calendar-outline" size={22} color={theme.colors.secondary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>Age</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                {user?.age ? `${user.age} years` : 'Not set'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.colors.border.light }]} />

        {/* Gender */}
        <TouchableOpacity style={styles.settingRow} onPress={() => setShowProfileModal(true)}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.info + '20' }]}>
              <Ionicons name="male-female-outline" size={22} color={theme.colors.semantic.info} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>Gender</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                {getGenderLabel(user?.gender || '')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.colors.border.light }]} />

        {/* Height */}
        <TouchableOpacity style={styles.settingRow} onPress={() => setShowProfileModal(true)}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.success + '20' }]}>
              <Ionicons name="resize-outline" size={22} color={theme.colors.semantic.success} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>Height</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                {formatHeight(user?.height || 0)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.colors.border.light }]} />

        {/* Weight */}
        <TouchableOpacity style={styles.settingRow} onPress={() => setShowProfileModal(true)}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.warning + '20' }]}>
              <Ionicons name="scale-outline" size={22} color={theme.colors.semantic.warning} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>Weight</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>
                {formatWeight(user?.weight || 0)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: theme.colors.border.light }]} />

        {/* Health Goals */}
        <TouchableOpacity style={styles.settingRow} onPress={() => setShowProfileModal(true)}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.error + '20' }]}>
              <Ionicons name="flag-outline" size={22} color={theme.colors.semantic.error} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>Health Goals</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]} numberOfLines={1}>
                {user?.goals || 'Not set'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      </Card>
    </View>
  );

  // Profile Edit Modal
  const renderProfileModal = () => (
    <Modal
      visible={showProfileModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowProfileModal(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border.light }]}>
            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
              <Text style={[styles.modalCancel, { color: theme.colors.text.secondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={[styles.modalSave, { color: theme.colors.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Name</Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.text.primary,
                  borderColor: theme.colors.border.light,
                }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                placeholderTextColor={theme.colors.text.tertiary}
              />
            </View>

            {/* Age */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Age</Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.text.primary,
                  borderColor: theme.colors.border.light,
                }]}
                value={editAge}
                onChangeText={setEditAge}
                placeholder="Enter your age"
                placeholderTextColor={theme.colors.text.tertiary}
                keyboardType="number-pad"
              />
            </View>

            {/* Gender */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Gender</Text>
              <View style={styles.genderOptions}>
                {(['male', 'female', 'other', 'prefer_not_to_say'] as const).map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.genderOption,
                      { 
                        backgroundColor: editGender === gender 
                          ? theme.colors.primary 
                          : theme.colors.surfaceVariant,
                        borderColor: editGender === gender 
                          ? theme.colors.primary 
                          : theme.colors.border.light,
                      }
                    ]}
                    onPress={() => setEditGender(gender)}
                  >
                    <Text style={[
                      styles.genderOptionText,
                      { color: editGender === gender ? theme.colors.onPrimary : theme.colors.text.primary }
                    ]}>
                      {getGenderLabel(gender)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Height */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Height (inches)</Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.text.primary,
                  borderColor: theme.colors.border.light,
                }]}
                value={editHeight}
                onChangeText={setEditHeight}
                placeholder="e.g., 68 inches"
                placeholderTextColor={theme.colors.text.tertiary}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.inputHint, { color: theme.colors.text.tertiary }]}>
                {editHeight ? formatHeight(parseFloat(editHeight)) : "Enter total inches (5 ft 8 in = 68 inches)"}
              </Text>
            </View>

            {/* Weight */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Weight (lbs)</Text>
              <TextInput
                style={[styles.textInput, { 
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.text.primary,
                  borderColor: theme.colors.border.light,
                }]}
                value={editWeight}
                onChangeText={setEditWeight}
                placeholder="Enter your weight"
                placeholderTextColor={theme.colors.text.tertiary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Health Goals */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Health Goals</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { 
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.text.primary,
                  borderColor: theme.colors.border.light,
                }]}
                value={editGoals}
                onChangeText={setEditGoals}
                placeholder="What are your health goals?"
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );

  // About Section
  const renderAboutSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionHeader, { color: theme.colors.text.secondary }]}>
        ABOUT
      </Text>
      
      <Card style={styles.card} variant="outlined">
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name="information-circle" size={22} color={theme.colors.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingTitle, { color: theme.colors.text.primary }]}>Version</Text>
              <Text style={[styles.settingSubtitle, { color: theme.colors.text.secondary }]}>1.0.0</Text>
            </View>
          </View>
        </View>
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {renderHeader()}
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {renderPersonalInfoSection()}
        {renderAppleHealthSection()}
        {renderAppearanceSection()}
        {renderNotificationsSection()}
        {renderAccountSection()}
        {renderAboutSection()}
        
        <View style={{ height: 40 }} />
      </ScrollView>
      
      {renderProfileModal()}
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
    width: 44,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    marginLeft: 14,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 70,
  },
  // Health Summary
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
  healthSummaryContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  healthGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  healthItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  healthValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  healthLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  // Data Types
  dataTypesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dataTypesTitle: {
    fontSize: 12,
    marginBottom: 10,
  },
  dataTypesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dataTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  dataTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Actions
  healthActions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Connect
  connectContainer: {
    padding: 16,
    alignItems: 'center',
  },
  connectDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Unavailable
  unavailableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  unavailableText: {
    fontSize: 14,
  },
  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginTop: 0,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalCancel: {
    fontSize: 16,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  // Form Inputs
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  genderOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
