import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Animated,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { Card, HeaderButton } from '@/components/ui';
import { useTheme } from '@/theme';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '@/navigation/types';
import { useHealthKit } from '@/hooks/useHealthKit';
import { healthDataSyncService } from '@/services/healthDataSync';
import { useAuth } from '@/contexts/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

// Navigation type
type HomeScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Home'>;

interface HealthSummary {
  steps: number;
  distance: number;
  calories: number;
  heartRate: number | null;
  sleep: number | null;
}

export const HomeScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const breatheAnimation = useRef(new Animated.Value(1)).current;

  // HealthKit integration
  const { isConnected, syncHealthData, isAvailable } = useHealthKit();
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [weeklyHeartRate, setWeeklyHeartRate] = useState<number[]>([72, 74, 71, 73, 72, 75, 73]);

  // Load health data
  const loadHealthData = useCallback(async () => {
    if (!isConnected) return;
    
    setIsLoadingHealth(true);
    try {
      const summary = await healthDataSyncService.getDailySummary();
      setHealthSummary(summary);
    } catch (error) {
      console.error('Error loading health data:', error);
    } finally {
      setIsLoadingHealth(false);
    }
  }, [isConnected]);

  useEffect(() => {
    loadHealthData();
  }, [loadHealthData]);

  // Breathing circle animation for pull-to-refresh
  const startBreathingAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopBreathingAnimation = () => {
    breatheAnimation.stopAnimation();
    breatheAnimation.setValue(1);
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    startBreathingAnimation();
    
    if (isConnected) {
      await syncHealthData();
      await loadHealthData();
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
      stopBreathingAnimation();
    }, 1000);
  };

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
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
        <Text style={styles.headerTitle}>Dashboard</Text>
      </View>
      <View style={styles.headerRight}>
        {/* Placeholder for future header actions */}
      </View>
    </View>
  );

  const renderHealthKitPrompt = () => {
    if (isConnected || !isAvailable) return null;

    return (
      <Card style={styles.promptCard} onPress={() => navigation.navigate('ConnectedDevices' as any)}>
        <View style={styles.promptContent}>
          <View style={[styles.promptIcon, { backgroundColor: theme.colors.semantic.error + '20' }]}>
            <Ionicons name="heart" size={24} color={theme.colors.semantic.error} />
          </View>
          <View style={styles.promptText}>
            <Text style={[styles.promptTitle, { color: theme.colors.text.primary }]}>
              Connect Apple Health
            </Text>
            <Text style={[styles.promptDescription, { color: theme.colors.text.secondary }]}>
              Sync your health data for personalized insights
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </View>
      </Card>
    );
  };

  const renderVitalsCard = () => {
    const vitals = healthSummary || {
      heartRate: 72,
      sleep: 7.5,
      steps: 8420,
      calories: 2150,
    };

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Ionicons 
              name="heart" 
              size={24} 
              color={theme.colors.semantic.error} 
              style={styles.cardIcon}
            />
            <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
              Vitals
            </Text>
            {isConnected && (
              <View style={styles.connectedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={theme.colors.semantic.success} />
                <Text style={[styles.connectedText, { color: theme.colors.semantic.success }]}>
                  Live
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardSubtitle, { color: theme.colors.text.secondary }]}>
            Today's Overview
          </Text>
        </View>

        <View style={styles.vitalsGrid}>
          {/* Heart Rate */}
          <View style={styles.vitalItem}>
            <Text style={[styles.vitalValue, { color: theme.colors.text.primary }]}>
              {healthSummary?.heartRate ? Math.round(healthSummary.heartRate) : '--'}
            </Text>
            <Text style={[styles.vitalUnit, { color: theme.colors.text.tertiary }]}>
              BPM
            </Text>
            <Text style={[styles.vitalLabel, { color: theme.colors.text.secondary }]}>
              Heart Rate
            </Text>
          </View>

          {/* Sleep */}
          <View style={styles.vitalItem}>
            <Text style={[styles.vitalValue, { color: theme.colors.text.primary }]}>
              {healthSummary?.sleep ? healthSummary.sleep.toFixed(1) : '--'}
            </Text>
            <Text style={[styles.vitalUnit, { color: theme.colors.text.tertiary }]}>
              hrs
            </Text>
            <Text style={[styles.vitalLabel, { color: theme.colors.text.secondary }]}>
              Sleep
            </Text>
          </View>

          {/* Weight (placeholder) */}
          <View style={styles.vitalItem}>
            <Text style={[styles.vitalValue, { color: theme.colors.text.primary }]}>
              {user?.weight || '--'}
            </Text>
            <Text style={[styles.vitalUnit, { color: theme.colors.text.tertiary }]}>
              lbs
            </Text>
            <Text style={[styles.vitalLabel, { color: theme.colors.text.secondary }]}>
              Weight
            </Text>
          </View>

          {/* Distance */}
          <View style={styles.vitalItem}>
            <Text style={[styles.vitalValue, { color: theme.colors.text.primary }]}>
              {healthSummary?.distance ? (healthSummary.distance / 1609.34).toFixed(1) : '--'}
            </Text>
            <Text style={[styles.vitalUnit, { color: theme.colors.text.tertiary }]}>
              mi
            </Text>
            <Text style={[styles.vitalLabel, { color: theme.colors.text.secondary }]}>
              Distance
            </Text>
          </View>
        </View>

        {/* Heart Rate Trend Chart */}
        <View style={styles.chartContainer}>
          <LineChart
            data={{
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [{
                data: weeklyHeartRate,
                strokeWidth: 3,
                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
              }],
            }}
            width={screenWidth - 80}
            height={120}
            chartConfig={{
              backgroundColor: theme.colors.surface,
              backgroundGradientFrom: theme.colors.surface,
              backgroundGradientTo: theme.colors.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
              labelColor: (opacity = 1) => theme.colors.text.tertiary,
              style: { borderRadius: 12 },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: theme.colors.semantic.error,
              },
              propsForBackgroundLines: {
                strokeWidth: 1,
                stroke: theme.colors.border.light,
              },
            }}
            bezier
            style={styles.chart}
          />
        </View>
      </Card>
    );
  };

  const renderActivityCard = () => {
    const steps = healthSummary?.steps || 0;
    const calories = healthSummary?.calories || 0;
    const stepsGoal = 10000;
    const caloriesGoal = 2300;

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleContainer}>
            <Ionicons 
              name="fitness" 
              size={24} 
              color={theme.colors.semantic.warning} 
              style={styles.cardIcon}
            />
            <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
              Activity
            </Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: theme.colors.text.secondary }]}>
            Progress Today
          </Text>
        </View>

        <View style={styles.activityGrid}>
          {/* Steps */}
          <View style={styles.activityItem}>
            <View style={styles.activityHeader}>
              <Ionicons name="walk" size={20} color={theme.colors.semantic.warning} />
              <Text style={[styles.activityLabel, { color: theme.colors.text.secondary }]}>
                Steps
              </Text>
            </View>
            <Text style={[styles.activityValue, { color: theme.colors.text.primary }]}>
              {steps.toLocaleString()}
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${Math.min((steps / stepsGoal) * 100, 100)}%`,
                    backgroundColor: theme.colors.semantic.warning 
                  }
                ]}
              />
            </View>
            <Text style={[styles.activityGoal, { color: theme.colors.text.tertiary }]}>
              Goal: {stepsGoal.toLocaleString()}
            </Text>
          </View>

          {/* Calories */}
          <View style={styles.activityItem}>
            <View style={styles.activityHeader}>
              <Ionicons name="flame" size={20} color={theme.colors.semantic.error} />
              <Text style={[styles.activityLabel, { color: theme.colors.text.secondary }]}>
                Calories
              </Text>
            </View>
            <Text style={[styles.activityValue, { color: theme.colors.text.primary }]}>
              {Math.round(calories)}
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${Math.min((calories / caloriesGoal) * 100, 100)}%`,
                    backgroundColor: theme.colors.semantic.error 
                  }
                ]}
              />
            </View>
            <Text style={[styles.activityGoal, { color: theme.colors.text.tertiary }]}>
              Goal: {caloriesGoal}
            </Text>
          </View>

          {/* Connection Status */}
          <TouchableOpacity 
            style={[styles.activityItem, styles.activityItemFull]}
            onPress={() => navigation.navigate('ConnectedDevices' as any)}
          >
            <View style={styles.activityHeader}>
              <Ionicons 
                name={isConnected ? "checkmark-circle" : "link"} 
                size={20} 
                color={isConnected ? theme.colors.semantic.success : theme.colors.primary} 
              />
              <Text style={[styles.activityLabel, { color: theme.colors.text.secondary }]}>
                {isConnected ? 'Apple Health Connected' : 'Connect Health Data'}
              </Text>
            </View>
            <Text style={[styles.activityValue, { color: theme.colors.text.primary }]}>
              {isConnected ? 'Syncing' : 'Tap to connect'}
            </Text>
            {isConnected && (
              <Text style={[styles.exerciseType, { color: theme.colors.text.secondary }]}>
                Auto-sync enabled
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const renderQuickActionsCard = () => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Ionicons 
            name="flash" 
            size={24} 
            color={theme.colors.primary} 
            style={styles.cardIcon}
          />
          <Text style={[styles.cardTitle, { color: theme.colors.text.primary }]}>
            Quick Actions
          </Text>
        </View>
      </View>

      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={[styles.quickAction, { backgroundColor: theme.colors.surfaceVariant }]}
          onPress={() => navigation.navigate('ConnectedDevices' as any)}
        >
          <Ionicons name="heart" size={24} color={theme.colors.semantic.error} />
          <Text style={[styles.quickActionText, { color: theme.colors.text.primary }]}>
            Health Data
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickAction, { backgroundColor: theme.colors.surfaceVariant }]}
          onPress={() => navigation.navigate('DailyChecklist' as any)}
        >
          <Ionicons name="checkbox" size={24} color={theme.colors.semantic.success} />
          <Text style={[styles.quickActionText, { color: theme.colors.text.primary }]}>
            Daily Tasks
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickAction, { backgroundColor: theme.colors.surfaceVariant }]}
          onPress={() => navigation.navigate('Insights' as any)}
        >
          <Ionicons name="analytics" size={24} color={theme.colors.primary} />
          <Text style={[styles.quickActionText, { color: theme.colors.text.primary }]}>
            Insights
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.quickAction, { backgroundColor: theme.colors.surfaceVariant }]}
          onPress={() => navigation.navigate('Settings' as any)}
        >
          <Ionicons name="settings" size={24} color={theme.colors.secondary} />
          <Text style={[styles.quickActionText, { color: theme.colors.text.primary }]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 16,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    headerTitleContainer: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      ...theme.typography.h2,
      color: theme.colors.text.primary,
    },
    headerRight: {
      width: 44,
    },
    scrollContainer: {
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    header: {
      marginBottom: 24,
    },
    greeting: {
      ...theme.typography.h1,
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    date: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
    },
    promptCard: {
      marginBottom: 24,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.semantic.error + '30',
    },
    promptContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    promptIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    promptText: {
      flex: 1,
      marginLeft: 14,
    },
    promptTitle: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 2,
    },
    promptDescription: {
      fontSize: 13,
    },
    card: {
      marginBottom: 24,
      padding: 24,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      shadowColor: theme.colors.text.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    cardHeader: {
      marginBottom: 24,
    },
    cardTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    cardIcon: {
      marginRight: 12,
    },
    cardTitle: {
      ...theme.typography.cardTitle,
    },
    cardSubtitle: {
      ...theme.typography.cardSubtitle,
    },
    connectedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 'auto',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: theme.colors.semantic.success + '15',
    },
    connectedText: {
      fontSize: 11,
      fontWeight: '600',
      marginLeft: 4,
    },
    vitalsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 24,
    },
    vitalItem: {
      width: '50%',
      paddingRight: 12,
      marginBottom: 24,
    },
    vitalValue: {
      ...theme.typography.dataLarge,
      marginBottom: 4,
    },
    vitalUnit: {
      ...theme.typography.caption,
      marginBottom: 8,
    },
    vitalLabel: {
      ...theme.typography.body3,
    },
    chartContainer: {
      alignItems: 'center',
      marginTop: 8,
    },
    chart: {
      borderRadius: 12,
    },
    activityGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    activityItem: {
      width: '47%',
      padding: 16,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 12,
    },
    activityItemFull: {
      width: '100%',
    },
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    activityLabel: {
      ...theme.typography.body3,
      marginLeft: 8,
    },
    activityValue: {
      ...theme.typography.dataMedium,
      marginBottom: 12,
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.colors.border.light,
      borderRadius: 2,
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
    },
    activityGoal: {
      ...theme.typography.caption,
    },
    exerciseType: {
      ...theme.typography.body3,
      marginTop: 4,
    },
    quickActionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    quickAction: {
      width: '47%',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    quickActionText: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '500',
    },
    refreshIndicator: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    breathingCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      opacity: 0.3,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Hamburger Menu */}
      {renderHeader()}

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Breathing circle for refresh state */}
        {isRefreshing && (
          <View style={styles.refreshIndicator}>
            <Animated.View
              style={[
                styles.breathingCircle,
                { transform: [{ scale: breatheAnimation }] }
              ]}
            />
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>
            {getGreeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* HealthKit Connection Prompt */}
        {renderHealthKitPrompt()}

        {/* Card Stack */}
        {renderVitalsCard()}
        {renderActivityCard()}
        {renderQuickActionsCard()}

        {/* Bottom padding for safe scrolling */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};
