import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Modal,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Card, HeaderButton } from '@/components/ui';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '@/navigation/types';
import { healthDataSyncService } from '@/services/healthDataSync';
import { fetchPast7DaysHealthData } from '@/services/healthKit';
import { useHealthKit } from '@/hooks/useHealthKit';
import { useAuth } from '@/contexts/AuthContext';
import { cleanAIResponse } from '@/utils/cleanAIResponse';

type HealthTrendsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'HealthTrends'>;

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 48;

// Backend URLs for AI chat
const BACKEND_URLS = [
  'https://soma-eight.vercel.app/api/chat',
  'http://localhost:3001/chat',
];

interface HistoryData {
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
}

interface MetricConfig {
  key: keyof HistoryData;
  label: string;
  icon: string;
  color: string;
  unit: string;
  formatValue: (val: number | null) => string;
}

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
}

const METRICS: MetricConfig[] = [
  {
    key: 'steps',
    label: 'Steps',
    icon: 'footsteps',
    color: '#4ECDC4',
    unit: 'steps',
    formatValue: (val) => val?.toLocaleString() || '0',
  },
  {
    key: 'calories',
    label: 'Active Calories',
    icon: 'flame',
    color: '#FF6B6B',
    unit: 'kcal',
    formatValue: (val) => Math.round(val || 0).toString(),
  },
  {
    key: 'heartRate',
    label: 'Heart Rate',
    icon: 'heart',
    color: '#FF4757',
    unit: 'BPM',
    formatValue: (val) => val?.toString() || '--',
  },
  {
    key: 'sleep',
    label: 'Sleep',
    icon: 'moon',
    color: '#A855F7',
    unit: 'hrs',
    formatValue: (val) => val?.toFixed(1) || '--',
  },
  {
    key: 'workoutMinutes',
    label: 'Workouts',
    icon: 'barbell',
    color: '#10B981',
    unit: 'min',
    formatValue: (val) => val?.toString() || '0',
  },
  {
    key: 'distance',
    label: 'Distance',
    icon: 'walk',
    color: '#3B82F6',
    unit: 'mi',
    formatValue: (val) => ((val || 0) / 1609.34).toFixed(1),
  },
];

export const HealthTrendsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { isConnected: isHealthKitConnected } = useHealthKit();
  const navigation = useNavigation<HealthTrendsScreenNavigationProp>();
  const scrollViewRef = useRef<ScrollView>(null);
  const chatScrollRef = useRef<ScrollView>(null);
  
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricConfig | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(7);
  
  // AI Insights state
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      let data: HistoryData[] = [];
      
      // Try to fetch from HealthKit first (if connected)
      if (isHealthKitConnected) {
        console.log('📊 Fetching data from Apple HealthKit...');
        try {
          const healthKitData = await fetchPast7DaysHealthData();
          if (healthKitData.length > 0) {
            data = healthKitData;
            console.log('📊 Successfully fetched', data.length, 'days from HealthKit');
          } else {
            console.log('📊 No HealthKit data, falling back to Supabase');
          }
        } catch (healthKitError) {
          console.error('📊 Error fetching from HealthKit:', healthKitError);
        }
      }
      
      // Fallback to Supabase if HealthKit not connected or no data
      if (data.length === 0) {
        console.log('📊 Fetching data from Supabase...');
        const supabaseData = await healthDataSyncService.fetchHealthDataHistory({
          daysBack: timeRange,
          limit: timeRange * 10,
        });
        
        // Group by date and aggregate
        const groupedByDate = new Map<string, HistoryData>();
        
        supabaseData.forEach((entry) => {
          const dateKey = entry.dataDate;
          const existing = groupedByDate.get(dateKey);
          
          if (existing) {
            groupedByDate.set(dateKey, {
              ...existing,
              steps: existing.steps + entry.steps,
              distance: existing.distance + entry.distance,
              calories: existing.calories + entry.calories,
              heartRate: existing.heartRate && entry.heartRate 
                ? Math.round((existing.heartRate + entry.heartRate) / 2)
                : existing.heartRate || entry.heartRate,
              sleep: existing.sleep || entry.sleep,
              workoutMinutes: existing.workoutMinutes + entry.workoutMinutes,
              workoutCount: existing.workoutCount + entry.workoutCount,
              mindfulnessMinutes: existing.mindfulnessMinutes + entry.mindfulnessMinutes,
            });
          } else {
            groupedByDate.set(dateKey, entry);
          }
        });
        
        data = Array.from(groupedByDate.values()).sort((a, b) => 
          new Date(a.dataDate).getTime() - new Date(b.dataDate).getTime()
        );
        
        console.log('📊 Fetched', data.length, 'days from Supabase');
      }
      
      setHistoryData(data);
      
      // Generate AI insight when data loads
      if (data.length > 0) {
        generateAIInsight(data);
      }
    } catch (error) {
      console.error('Error fetching health history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [timeRange, isHealthKitConnected]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const buildTrendsSummary = (data: HistoryData[]): string => {
    if (data.length === 0) return 'No health data available.';

    const avgSteps = Math.round(data.reduce((sum, d) => sum + d.steps, 0) / data.length);
    const avgCalories = Math.round(data.reduce((sum, d) => sum + d.calories, 0) / data.length);
    const sleepData = data.filter(d => d.sleep !== null);
    const avgSleep = sleepData.length > 0 
      ? (sleepData.reduce((sum, d) => sum + (d.sleep || 0), 0) / sleepData.length).toFixed(1)
      : null;
    const hrData = data.filter(d => d.heartRate !== null);
    const avgHR = hrData.length > 0
      ? Math.round(hrData.reduce((sum, d) => sum + (d.heartRate || 0), 0) / hrData.length)
      : null;
    const totalWorkoutMins = data.reduce((sum, d) => sum + d.workoutMinutes, 0);
    
    // Calculate trends
    const recentSteps = data.slice(-3).reduce((sum, d) => sum + d.steps, 0) / Math.min(3, data.length);
    const earlierSteps = data.slice(0, 3).reduce((sum, d) => sum + d.steps, 0) / Math.min(3, data.length);
    const stepsTrend = recentSteps > earlierSteps * 1.1 ? 'increasing' : 
                       recentSteps < earlierSteps * 0.9 ? 'decreasing' : 'stable';

    return `
Health data summary for the last ${data.length} days:
- Average daily steps: ${avgSteps.toLocaleString()} (trend: ${stepsTrend})
- Average active calories: ${avgCalories} kcal/day
${avgSleep ? `- Average sleep: ${avgSleep} hours/night` : ''}
${avgHR ? `- Average heart rate: ${avgHR} BPM` : ''}
- Total workout time: ${totalWorkoutMins} minutes over ${data.length} days
- Most recent day: ${data[data.length - 1]?.steps.toLocaleString() || 0} steps, ${data[data.length - 1]?.calories || 0} calories
    `.trim();
  };

  const generateAIInsight = async (data: HistoryData[]) => {
    setIsLoadingInsight(true);
    
    const trendsSummary = buildTrendsSummary(data);
    
    try {
      let response: Response | null = null;
      
      for (const url of BACKEND_URLS) {
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agent: 'Soma',
              userId: user?.id,
              messages: [{
                role: 'user',
                content: `Analyze my health trends and give me a brief, personalized insight (2-3 sentences max). Be encouraging and specific. Here's my data:\n\n${trendsSummary}`,
              }],
            }),
          });
          
          if (response.ok) break;
          response = null;
        } catch (e) {
          console.log(`Failed to connect to ${url}`);
        }
      }

      if (response && response.ok) {
        const responseData = await response.json();
        if (responseData.choices?.[0]?.message?.content) {
          setAiInsight(cleanAIResponse(responseData.choices[0].message.content));
        }
      }
    } catch (error) {
      console.error('Error generating AI insight:', error);
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isSendingMessage) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: chatInput.trim(),
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsSendingMessage(true);

    const trendsSummary = buildTrendsSummary(historyData);

    try {
      let response: Response | null = null;
      
      for (const url of BACKEND_URLS) {
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agent: 'Soma',
              userId: user?.id,
              userContext: `Current health trends data:\n${trendsSummary}`,
              messages: [
                ...chatMessages.map(m => ({
                  role: m.isUser ? 'user' : 'assistant',
                  content: m.content,
                })),
                { role: 'user', content: userMessage.content },
              ],
            }),
          });
          
          if (response.ok) break;
          response = null;
        } catch (e) {
          console.log(`Failed to connect to ${url}`);
        }
      }

      if (response && response.ok) {
        const responseData = await response.json();
        if (responseData.choices?.[0]?.message?.content) {
          const aiMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            content: cleanAIResponse(responseData.choices[0].message.content),
            isUser: false,
            timestamp: new Date().toISOString(),
          };
          setChatMessages(prev => [...prev, aiMessage]);
        }
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I couldn't process that. Please try again.",
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSendingMessage(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    setAiInsight('');
    fetchHistory();
  }, [fetchHistory]);

  const getChartData = (metric: MetricConfig) => {
    if (historyData.length === 0) {
      return {
        labels: ['No data'],
        datasets: [{ data: [0] }],
      };
    }

    // Map all data points
    const allLabels = historyData.map((d) => {
      const date = new Date(d.dataDate);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });
    
    const allData = historyData.map((d) => {
      const val = d[metric.key];
      if (val === null || val === undefined) return 0;
      if (metric.key === 'distance') return Number(val) / 1609.34;
      return Number(val);
    });

    // If we have more than 14 data points, sample them for better readability
    // Otherwise show all points
    if (allLabels.length > 14) {
      const step = Math.ceil(allLabels.length / 14);
      const filteredIndices: number[] = [];
      
      // Always include first and last
      filteredIndices.push(0);
      
      // Sample middle points
      for (let i = step; i < allLabels.length - 1; i += step) {
        filteredIndices.push(i);
      }
      
      // Always include last
      if (allLabels.length > 1) {
        filteredIndices.push(allLabels.length - 1);
      }
      
      // Remove duplicates and sort
      const uniqueIndices = [...new Set(filteredIndices)].sort((a, b) => a - b);
      
      return {
        labels: uniqueIndices.map(i => allLabels[i]),
        datasets: [{ data: uniqueIndices.map(i => allData[i]) }],
      };
    }

    // Show all data points if 14 or fewer
    return {
      labels: allLabels,
      datasets: [{ data: allData }],
    };
  };

  const getLatestValue = (metric: MetricConfig): string => {
    if (historyData.length === 0) return '--';
    const latest = historyData[historyData.length - 1];
    return metric.formatValue(latest[metric.key] as number | null);
  };

  const getAverageValue = (metric: MetricConfig): string => {
    if (historyData.length === 0) return '--';
    const values = historyData
      .map((d) => d[metric.key])
      .filter((v): v is number => v !== null && v !== undefined);
    
    if (values.length === 0) return '--';
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    if (metric.key === 'distance') return (avg / 1609.34).toFixed(1);
    if (metric.key === 'sleep') return avg.toFixed(1);
    return Math.round(avg).toLocaleString();
  };

  const getTrend = (metric: MetricConfig): { direction: 'up' | 'down' | 'stable'; percent: number } => {
    if (historyData.length < 2) return { direction: 'stable', percent: 0 };
    
    const values = historyData
      .map((d) => d[metric.key])
      .filter((v): v is number => v !== null && v !== undefined);
    
    if (values.length < 2) return { direction: 'stable', percent: 0 };
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (firstAvg === 0) return { direction: 'stable', percent: 0 };
    
    const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    return {
      direction: percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable',
      percent: Math.abs(percentChange),
    };
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <HeaderButton
        icon="menu"
        onPress={() => navigation.openDrawer()}
        accessibilityLabel="Open navigation menu"
      />
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>
          Health Trends
        </Text>
      </View>
      <TouchableOpacity 
        onPress={onRefresh}
        style={styles.refreshButton}
      >
        <Ionicons name="refresh" size={22} color={theme.colors.text.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderAIInsightCard = () => (
    <TouchableOpacity 
      style={[styles.aiInsightCard, { backgroundColor: theme.colors.primary + '15' }]}
      onPress={() => setIsChatOpen(true)}
      activeOpacity={0.8}
    >
      <View style={styles.aiInsightHeader}>
        <View style={[styles.aiAvatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.aiAvatarText}>✨</Text>
        </View>
        <View style={styles.aiInsightTitleContainer}>
          <Text style={[styles.aiInsightTitle, { color: theme.colors.text.primary }]}>
            Soma's Insight
          </Text>
          <Text style={[styles.aiInsightSubtitle, { color: theme.colors.text.tertiary }]}>
            Tap to chat about your trends
          </Text>
        </View>
        <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.primary} />
      </View>
      
      {isLoadingInsight ? (
        <View style={styles.aiInsightLoading}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.aiInsightLoadingText, { color: theme.colors.text.secondary }]}>
            Analyzing your trends...
          </Text>
        </View>
      ) : aiInsight ? (
        <Text style={[styles.aiInsightText, { color: theme.colors.text.primary }]}>
          {aiInsight}
        </Text>
      ) : (
        <Text style={[styles.aiInsightText, { color: theme.colors.text.secondary }]}>
          Sync more health data to get personalized insights!
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderChatModal = () => (
    <Modal
      visible={isChatOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setIsChatOpen(false)}
    >
      <SafeAreaView style={[styles.chatModalContainer, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.chatHeader, { borderBottomColor: theme.colors.border }]}>
            <TouchableOpacity onPress={() => setIsChatOpen(false)}>
              <Ionicons name="close" size={28} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.chatHeaderTitle}>
              <Text style={[styles.chatHeaderText, { color: theme.colors.text.primary }]}>
                Chat with Soma
              </Text>
              <Text style={[styles.chatHeaderSubtext, { color: theme.colors.text.tertiary }]}>
                Ask about your health trends
              </Text>
            </View>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView 
            ref={chatScrollRef}
            style={styles.chatMessages}
            contentContainerStyle={styles.chatMessagesContent}
          >
            {/* Initial context message */}
            <View style={[styles.chatBubble, styles.chatBubbleAI, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.chatBubbleText, { color: theme.colors.text.primary }]}>
                {aiInsight || "Hi! I'm Soma, your health assistant. Ask me anything about your health trends - like why your steps are up, how to improve your sleep, or what your data means for your goals!"}
              </Text>
            </View>

            {/* Chat messages */}
            {chatMessages.map((msg) => (
              <View 
                key={msg.id}
                style={[
                  styles.chatBubble,
                  msg.isUser ? styles.chatBubbleUser : styles.chatBubbleAI,
                  { backgroundColor: msg.isUser ? theme.colors.primary : theme.colors.surface }
                ]}
              >
                <Text style={[
                  styles.chatBubbleText,
                  { color: msg.isUser ? theme.colors.onPrimary : theme.colors.text.primary }
                ]}>
                  {msg.content}
                </Text>
              </View>
            ))}

            {isSendingMessage && (
              <View style={[styles.chatBubble, styles.chatBubbleAI, { backgroundColor: theme.colors.surface }]}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            )}
          </ScrollView>

          {/* Quick Questions */}
          {chatMessages.length === 0 && (
            <View style={styles.quickQuestions}>
              {[
                "Why are my steps trending this way?",
                "How can I improve my sleep?",
                "Am I on track with my fitness goals?",
              ].map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.quickQuestionButton, { backgroundColor: theme.colors.surface }]}
                  onPress={() => {
                    setChatInput(question);
                  }}
                >
                  <Text style={[styles.quickQuestionText, { color: theme.colors.text.secondary }]}>
                    {question}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Chat Input */}
          <View style={[styles.chatInputContainer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <TextInput
              style={[styles.chatInput, { color: theme.colors.text.primary }]}
              placeholder="Ask about your health trends..."
              placeholderTextColor={theme.colors.text.tertiary}
              value={chatInput}
              onChangeText={setChatInput}
              multiline
              maxLength={500}
              onSubmitEditing={sendChatMessage}
            />
            <TouchableOpacity 
              style={[
                styles.chatSendButton,
                { backgroundColor: chatInput.trim() ? theme.colors.primary : theme.colors.border }
              ]}
              onPress={sendChatMessage}
              disabled={!chatInput.trim() || isSendingMessage}
            >
              <Ionicons 
                name="send" 
                size={18} 
                color={chatInput.trim() ? theme.colors.onPrimary : theme.colors.text.tertiary} 
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  const renderTimeRangeSelector = () => (
    <View style={styles.timeRangeContainer}>
      {([7, 14, 30] as const).map((days) => (
        <TouchableOpacity
          key={days}
          style={[
            styles.timeRangeButton,
            {
              backgroundColor: timeRange === days 
                ? theme.colors.primary 
                : theme.colors.surface,
            },
          ]}
          onPress={() => setTimeRange(days)}
        >
          <Text
            style={[
              styles.timeRangeText,
              {
                color: timeRange === days 
                  ? theme.colors.onPrimary 
                  : theme.colors.text.secondary,
              },
            ]}
          >
            {days}D
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderMetricCard = (metric: MetricConfig) => {
    const trend = getTrend(metric);
    const latestValue = getLatestValue(metric);
    const avgValue = getAverageValue(metric);

    return (
      <TouchableOpacity
        key={metric.key}
        style={[styles.metricCard, { backgroundColor: theme.colors.surface }]}
        onPress={() => setSelectedMetric(metric)}
        activeOpacity={0.7}
      >
        <View style={styles.metricHeader}>
          <View style={[styles.metricIconContainer, { backgroundColor: `${metric.color}20` }]}>
            <Ionicons name={metric.icon as any} size={20} color={metric.color} />
          </View>
          <View style={styles.trendContainer}>
            {trend.direction !== 'stable' && (
              <>
                <Ionicons
                  name={trend.direction === 'up' ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={trend.direction === 'up' ? '#10B981' : '#EF4444'}
                />
                <Text style={[
                  styles.trendText,
                  { color: trend.direction === 'up' ? '#10B981' : '#EF4444' }
                ]}>
                  {trend.percent.toFixed(0)}%
                </Text>
              </>
            )}
          </View>
        </View>
        
        <Text style={[styles.metricLabel, { color: theme.colors.text.secondary }]}>
          {metric.label}
        </Text>
        
        <Text style={[styles.metricValue, { color: theme.colors.text.primary }]}>
          {latestValue}
          <Text style={[styles.metricUnit, { color: theme.colors.text.secondary }]}>
            {' '}{metric.unit}
          </Text>
        </Text>
        
        <Text style={[styles.metricAvg, { color: theme.colors.text.tertiary }]}>
          Avg: {avgValue} {metric.unit}
        </Text>

        {/* Mini Sparkline */}
        {historyData.length > 1 && (
          <View style={styles.sparklineContainer}>
            <LineChart
              data={getChartData(metric)}
              width={chartWidth / 2 - 48}
              height={40}
              withDots={false}
              withInnerLines={false}
              withOuterLines={false}
              withHorizontalLabels={false}
              withVerticalLabels={false}
              chartConfig={{
                backgroundGradientFrom: 'transparent',
                backgroundGradientTo: 'transparent',
                color: () => metric.color,
                strokeWidth: 2,
                propsForBackgroundLines: { stroke: 'transparent' },
              }}
              bezier
              style={styles.sparkline}
            />
          </View>
        )}
        
        <View style={styles.tapHint}>
          <Text style={[styles.tapHintText, { color: theme.colors.text.tertiary }]}>
            Tap for details
          </Text>
          <Ionicons name="chevron-forward" size={12} color={theme.colors.text.tertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetailModal = () => {
    if (!selectedMetric) return null;

    const chartData = getChartData(selectedMetric);
    const trend = getTrend(selectedMetric);

    return (
      <Modal
        visible={!!selectedMetric}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMetric(null)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedMetric(null)}>
              <Ionicons name="close" size={28} color={theme.colors.text.primary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.colors.text.primary }]}>
              {selectedMetric.label}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Current Value Card */}
            <Card style={styles.statCard} variant="elevated">
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
                    Latest
                  </Text>
                  <Text style={[styles.statValue, { color: selectedMetric.color }]}>
                    {getLatestValue(selectedMetric)}
                  </Text>
                  <Text style={[styles.statUnit, { color: theme.colors.text.tertiary }]}>
                    {selectedMetric.unit}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
                    Average
                  </Text>
                  <Text style={[styles.statValue, { color: theme.colors.text.primary }]}>
                    {getAverageValue(selectedMetric)}
                  </Text>
                  <Text style={[styles.statUnit, { color: theme.colors.text.tertiary }]}>
                    {selectedMetric.unit}
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
                    Trend
                  </Text>
                  <View style={styles.trendBadge}>
                    <Ionicons
                      name={
                        trend.direction === 'up' ? 'trending-up' :
                        trend.direction === 'down' ? 'trending-down' : 'remove'
                      }
                      size={18}
                      color={
                        trend.direction === 'up' ? '#10B981' :
                        trend.direction === 'down' ? '#EF4444' : theme.colors.text.tertiary
                      }
                    />
                    <Text style={[
                      styles.trendPercent,
                      {
                        color: trend.direction === 'up' ? '#10B981' :
                               trend.direction === 'down' ? '#EF4444' : theme.colors.text.tertiary
                      }
                    ]}>
                      {trend.direction === 'stable' ? 'Stable' : `${trend.percent.toFixed(0)}%`}
                    </Text>
                  </View>
                </View>
              </View>
            </Card>

            {/* Chart */}
            <Card style={styles.chartCard} variant="elevated">
              <Text style={[styles.chartTitle, { color: theme.colors.text.primary }]}>
                Last {timeRange} Days
              </Text>
              {historyData.length > 0 ? (
                <LineChart
                  data={chartData}
                  width={screenWidth - 64}
                  height={220}
                  chartConfig={{
                    backgroundColor: theme.colors.surface,
                    backgroundGradientFrom: theme.colors.surface,
                    backgroundGradientTo: theme.colors.surface,
                    decimalPlaces: selectedMetric.key === 'sleep' ? 1 : 0,
                    color: () => selectedMetric.color,
                    labelColor: () => theme.colors.text.secondary,
                    style: { borderRadius: 16 },
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2',
                      stroke: selectedMetric.color,
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: '',
                      stroke: theme.colors.border,
                      strokeOpacity: 0.3,
                    },
                  }}
                  bezier
                  style={styles.chart}
                  fromZero
                />
              ) : (
                <View style={styles.noDataContainer}>
                  <Ionicons name="analytics-outline" size={48} color={theme.colors.text.tertiary} />
                  <Text style={[styles.noDataText, { color: theme.colors.text.tertiary }]}>
                    No data for this period
                  </Text>
                </View>
              )}
            </Card>

            {/* Daily Breakdown */}
            <Card style={styles.breakdownCard} variant="elevated">
              <Text style={[styles.chartTitle, { color: theme.colors.text.primary }]}>
                Daily Breakdown
              </Text>
              {historyData.slice().reverse().map((day, index) => {
                const value = day[selectedMetric.key];
                const displayValue = selectedMetric.formatValue(value as number | null);
                const date = new Date(day.dataDate);
                const isToday = new Date().toDateString() === date.toDateString();

                return (
                  <View
                    key={day.dataDate}
                    style={[
                      styles.dayRow,
                      index < historyData.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                  >
                    <View>
                      <Text style={[styles.dayDate, { color: theme.colors.text.primary }]}>
                        {isToday ? 'Today' : date.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.dayValue, { color: selectedMetric.color }]}>
                      {displayValue} {selectedMetric.unit}
                    </Text>
                  </View>
                );
              })}
            </Card>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        {renderHeader()}
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
            Loading health trends...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {renderHeader()}
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {renderTimeRangeSelector()}

        {/* AI Insight Card */}
        {historyData.length > 0 && renderAIInsightCard()}

        {historyData.length === 0 ? (
          <Card style={styles.emptyCard} variant="elevated">
            <Ionicons name="analytics-outline" size={64} color={theme.colors.text.tertiary} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
              No Health Data Yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
              Sync your Apple Health data to see your health trends and get personalized insights.
            </Text>
          </Card>
        ) : (
          <>
            {/* Full Graphs for Each Metric */}
            {METRICS.map((metric) => {
              const chartData = getChartData(metric);
              const trend = getTrend(metric);
              const latestValue = getLatestValue(metric);
              const avgValue = getAverageValue(metric);

              return (
                <Card 
                  key={metric.key}
                  style={[styles.metricGraphCard, { backgroundColor: theme.colors.surface }]}
                  variant="elevated"
                >
                  {/* Metric Header */}
                  <View style={styles.metricGraphHeader}>
                    <View style={styles.metricGraphHeaderLeft}>
                      <View style={[styles.metricIconContainer, { backgroundColor: `${metric.color}20` }]}>
                        <Ionicons name={metric.icon as any} size={20} color={metric.color} />
                      </View>
                      <View style={styles.metricGraphTitleContainer}>
                        <Text style={[styles.metricGraphTitle, { color: theme.colors.text.primary }]}>
                          {metric.label}
                        </Text>
                        <View style={styles.metricGraphStats}>
                          <Text style={[styles.metricGraphStat, { color: theme.colors.text.secondary }]}>
                            Latest: <Text style={{ color: metric.color, fontWeight: '600' }}>{latestValue} {metric.unit}</Text>
                          </Text>
                          <Text style={[styles.metricGraphStat, { color: theme.colors.text.secondary }]}>
                            Avg: <Text style={{ fontWeight: '600' }}>{avgValue} {metric.unit}</Text>
                          </Text>
                        </View>
                      </View>
                    </View>
                    {trend.direction !== 'stable' && (
                      <View style={styles.trendBadgeSmall}>
                        <Ionicons
                          name={trend.direction === 'up' ? 'trending-up' : 'trending-down'}
                          size={14}
                          color={trend.direction === 'up' ? '#10B981' : '#EF4444'}
                        />
                        <Text style={[
                          styles.trendTextSmall,
                          { color: trend.direction === 'up' ? '#10B981' : '#EF4444' }
                        ]}>
                          {trend.percent.toFixed(0)}%
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Full Chart */}
                  {historyData.length > 0 ? (
                    <LineChart
                      data={chartData}
                      width={screenWidth - 64}
                      height={180}
                      chartConfig={{
                        backgroundColor: theme.colors.surface,
                        backgroundGradientFrom: theme.colors.surface,
                        backgroundGradientTo: theme.colors.surface,
                        decimalPlaces: metric.key === 'sleep' ? 1 : 0,
                        color: () => metric.color,
                        labelColor: () => theme.colors.text.secondary,
                        style: { borderRadius: 16 },
                        propsForDots: {
                          r: '4',
                          strokeWidth: '2',
                          stroke: metric.color,
                        },
                        propsForBackgroundLines: {
                          strokeDasharray: '',
                          stroke: theme.colors.border,
                          strokeOpacity: 0.3,
                        },
                      }}
                      bezier
                      style={styles.metricGraphChart}
                      fromZero
                    />
                  ) : (
                    <View style={styles.noDataContainer}>
                      <Ionicons name="analytics-outline" size={32} color={theme.colors.text.tertiary} />
                      <Text style={[styles.noDataText, { color: theme.colors.text.tertiary }]}>
                        No data available
                      </Text>
                    </View>
                  )}

                  {/* Tap to expand hint */}
                  <TouchableOpacity
                    style={styles.expandHint}
                    onPress={() => setSelectedMetric(metric)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.expandHintText, { color: theme.colors.text.tertiary }]}>
                      Tap for detailed breakdown
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.text.tertiary} />
                  </TouchableOpacity>
                </Card>
              );
            })}
          </>
        )}
      </ScrollView>

      {renderDetailModal()}
      {renderChatModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // AI Insight Card
  aiInsightCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
  },
  aiInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiAvatarText: {
    fontSize: 18,
  },
  aiInsightTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  aiInsightTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  aiInsightSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  aiInsightLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiInsightLoadingText: {
    fontSize: 14,
  },
  aiInsightText: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Chat Modal
  chatModalContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  chatHeaderTitle: {
    flex: 1,
    alignItems: 'center',
  },
  chatHeaderText: {
    fontSize: 18,
    fontWeight: '600',
  },
  chatHeaderSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  chatContent: {
    flex: 1,
  },
  chatMessages: {
    flex: 1,
  },
  chatMessagesContent: {
    padding: 16,
  },
  chatBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatBubbleAI: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  chatBubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  quickQuestions: {
    padding: 16,
    gap: 8,
  },
  quickQuestionButton: {
    padding: 12,
    borderRadius: 12,
  },
  quickQuestionText: {
    fontSize: 14,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chatSendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Time Range
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  timeRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  metricCard: {
    width: (screenWidth - 44) / 2,
    padding: 16,
    borderRadius: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  metricUnit: {
    fontSize: 14,
    fontWeight: '400',
  },
  metricAvg: {
    fontSize: 12,
    marginTop: 4,
  },
  sparklineContainer: {
    marginTop: 8,
    marginHorizontal: -8,
    overflow: 'hidden',
  },
  sparkline: {
    paddingRight: 0,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  tapHintText: {
    fontSize: 11,
  },
  emptyCard: {
    margin: 24,
    padding: 48,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  // Detail Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  statCard: {
    padding: 20,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statUnit: {
    fontSize: 12,
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  trendPercent: {
    fontSize: 16,
    fontWeight: '600',
  },
  chartCard: {
    padding: 20,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 16,
    marginLeft: -16,
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    marginTop: 12,
    fontSize: 14,
  },
  breakdownCard: {
    padding: 20,
    marginBottom: 16,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  dayDate: {
    fontSize: 14,
    fontWeight: '500',
  },
  dayValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Metric Graph Cards
  metricGraphCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
  },
  metricGraphHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  metricGraphHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metricGraphTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  metricGraphTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  metricGraphStats: {
    flexDirection: 'row',
    gap: 16,
  },
  metricGraphStat: {
    fontSize: 12,
  },
  trendBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  trendTextSmall: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricGraphChart: {
    borderRadius: 16,
    marginLeft: -16,
    marginRight: -16,
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 4,
  },
  expandHintText: {
    fontSize: 12,
  },
});
