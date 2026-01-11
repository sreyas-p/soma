import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
  PanResponder,
  Animated,
  Alert,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
// Avoid require cycle: import only what is needed directly
// import { Card, Button } from '@/components/ui';
import { AIAgent, ChecklistItem, ChatMessage } from '@/types';
import ConfettiCannon from 'react-native-confetti-cannon';
import { supabase, TABLES } from '@/lib/supabase';
import { cleanAIResponse } from '@/utils/cleanAIResponse';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const MODAL_HEIGHT = screenHeight * 0.75;

// Try multiple backend URLs in case of network issues
const BACKEND_URLS = [
  'https://soma-eight.vercel.app/api/chat',  // Vercel production URL
  'http://localhost:3001/chat',  // Local development fallback
];

// Function to test backend connectivity
const testBackendConnection = async (url: string): Promise<boolean> => {
  try {
    console.log(`🔍 Testing backend connection to: ${url}`);
    
    // Extract base URL for health check
    const baseUrl = url.replace('/chat', '');
    const healthUrl = `${baseUrl}/health`;
    
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000); // 5 second timeout
    });
    
    const fetchPromise = fetch(healthUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (response.ok) {
      console.log(`✅ Backend test successful for: ${url}`);
      return true;
    } else {
      console.log(`❌ Backend test failed for: ${url} - Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Backend test failed for: ${url}`, error);
    return false;
  }
};

// Function to find working backend URL
const findWorkingBackend = async (): Promise<string | null> => {
  console.log('🔍 Starting backend URL discovery...');
  
  // Test URLs in parallel for faster discovery
  const testPromises = BACKEND_URLS.map(async (url) => {
    const isWorking = await testBackendConnection(url);
    return { url, isWorking };
  });
  
  try {
    const results = await Promise.allSettled(testPromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.isWorking) {
        console.log(`✅ Found working backend: ${result.value.url}`);
        return result.value.url;
      }
    }
    
    console.log('❌ No working backend found');
    return null;
  } catch (error) {
    console.log('❌ Error during backend discovery:', error);
    return null;
  }
};

interface AgentDetailModalProps {
  visible: boolean;
  agent: AIAgent | null;
  onClose: () => void;
}

export const AgentDetailModal: React.FC<AgentDetailModalProps> = ({
  visible,
  agent,
  onClose,
}) => {
  // PanResponder must be created unconditionally, before any return
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 20,
      onPanResponderMove: (_, gestureState) => {},
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80) onClose();
      },
    })
  ).current;

  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'checklist' | 'chat'>('chat');
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Handle keyboard events
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard shows
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setActiveTab('chat');
      setChatMessages([]);
      setError(null);
      // Initialize checklist items when modal opens
      if (agent) {
        setChecklistItems(getPersonalizedChecklist(agent.specialty));
      }
      
      // Check backend status when modal opens
      console.log('🔍 Checking backend status...');
      findWorkingBackend().then(workingUrl => {
        if (workingUrl) {
          console.log('✅ Backend is available:', workingUrl);
        } else {
          console.log('❌ No working backend found');
          setError('Backend server not available. Please check if the server is running.');
        }
      });
    }
  }, [visible, agent]);

  const triggerConfetti = () => {
    console.log('🎉 Agent confetti triggered!');
    setConfettiKey(prev => prev + 1);
    setShowConfetti(true);
    setTimeout(() => {
      console.log('🎉 Hiding agent confetti');
      setShowConfetti(false);
    }, 3000);
  };

  if (!agent) return null;

  const getAgentIcon = (specialty: AIAgent['specialty']) => {
    switch (specialty) {
      case 'nutrition': return 'restaurant';
      case 'sleep': return 'moon';
      case 'fitness': return 'fitness';
      case 'mindfulness': return 'leaf';
      case 'mental_health': return 'moon';
      case 'general': return 'chatbubbles';
      default: return 'chatbubble';
    }
  };
  const getAgentColor = (specialty: AIAgent['specialty']) => {
    switch (specialty) {
      case 'nutrition': return theme.colors.semantic.warning;
      case 'sleep': return '#8B5CF6';
      case 'fitness': return '#3B82F6'; // Changed from theme.colors.semantic.success to blue
      case 'mindfulness': return '#10B981';
      case 'mental_health': return '#8B5CF6';
      case 'general': return theme.colors.primary;
      default: return theme.colors.primary;
    }
  };
  const getPersonalizedChecklist = (specialty: AIAgent['specialty']): ChecklistItem[] => {
    switch (specialty) {
      case 'nutrition':
        return [
          { id: '1', title: 'Log blood glucose after meals', description: 'Target: <140 mg/dL', category: 'monitoring', completed: true, streak: 5 },
          { id: '2', title: 'Take omega-3 supplement', description: 'With breakfast', category: 'medication', completed: false, streak: 0 },
          { id: '3', title: 'Prep low-sodium lunch', description: '<1,500mg sodium today', category: 'nutrition', completed: false, streak: 2 },
          { id: '4', title: 'Drink 8 glasses of water', description: '6/8 completed', category: 'nutrition', completed: false, streak: 3 },
        ];
      case 'sleep':
        return [
          { id: '1', title: 'Evening wind-down routine', description: 'Start 1 hour before bed', category: 'sleep', completed: false, streak: 0 },
          { id: '2', title: 'Limit screen time after 9 PM', description: 'Use blue light filter', category: 'sleep', completed: true, streak: 4 },
          { id: '3', title: 'Practice deep breathing', description: '5 minutes before sleep', category: 'exercise', completed: false, streak: 1 },
          { id: '4', title: 'Track sleep quality', description: 'Rate 1-10 in morning', category: 'monitoring', completed: true, streak: 7 },
        ];
      case 'fitness':
        return [
          { id: '1', title: 'Check blood pressure', description: 'Before and after workout', category: 'monitoring', completed: true, streak: 8 },
          { id: '2', title: 'Low-impact cardio', description: '20 min walking', category: 'exercise', completed: false, streak: 0 },
          { id: '3', title: 'Resistance training', description: 'Upper body focus', category: 'exercise', completed: false, streak: 3 },
          { id: '4', title: 'Post-workout recovery', description: '10 min stretching', category: 'exercise', completed: false, streak: 2 },
        ];
      case 'mindfulness':
        return [
          { id: '1', title: '5-minute meditation', description: 'Focus on breathing', category: 'exercise', completed: true, streak: 6 },
          { id: '2', title: 'Gratitude journaling', description: 'Write 3 things', category: 'mindfulness', completed: false, streak: 0 },
          { id: '3', title: 'Mindful eating practice', description: 'Eat lunch without distractions', category: 'nutrition', completed: false, streak: 1 },
          { id: '4', title: 'Stress check-in', description: 'Rate stress 1-10', category: 'monitoring', completed: true, streak: 9 },
        ];
      case 'mental_health':
        return [
          { id: '1', title: '5-minute meditation', description: 'Focus on breathing', category: 'exercise', completed: true, streak: 6 },
          { id: '2', title: 'Gratitude journaling', description: 'Write 3 things', category: 'mindfulness', completed: false, streak: 0 },
          { id: '3', title: 'Mindful eating practice', description: 'Eat lunch without distractions', category: 'nutrition', completed: false, streak: 1 },
          { id: '4', title: 'Stress check-in', description: 'Rate stress 1-10', category: 'monitoring', completed: true, streak: 9 },
        ];
      case 'general':
        return [
          { id: '1', title: '5-minute meditation', description: 'Focus on breathing', category: 'exercise', completed: true, streak: 6 },
          { id: '2', title: 'Gratitude journaling', description: 'Write 3 things', category: 'mindfulness', completed: false, streak: 0 },
          { id: '3', title: 'Mindful eating practice', description: 'Eat lunch without distractions', category: 'nutrition', completed: false, streak: 1 },
          { id: '4', title: 'Stress check-in', description: 'Rate stress 1-10', category: 'monitoring', completed: true, streak: 9 },
        ];
      default:
        return [];
    }
  };

  // Interactive Checkbox Component for Agent Tasks
  const AgentCheckbox: React.FC<{
    item: ChecklistItem;
    onToggle: (itemId: string) => void;
  }> = ({ item, onToggle }) => {
    const [scaleAnim] = useState(new Animated.Value(1));

    const handlePress = () => {
      // Scale animation
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      onToggle(item.id);
      
      // Trigger confetti if completing a task
      if (!item.completed) {
        triggerConfetti();
      }
    };

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <Animated.View
          style={[
            styles.checkboxContainer,
            {
              backgroundColor: item.completed ? getAgentColor(agent.specialty) : 'transparent',
              borderColor: getAgentColor(agent.specialty),
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {item.completed && (
            <Ionicons name="checkmark" size={16} color="white" />
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const handleToggleTask = (itemId: string) => {
    setChecklistItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId
          ? { ...item, completed: !item.completed }
          : item
      )
    );
  };
  const checklist = getPersonalizedChecklist(agent.specialty);

  // Send message to backend and get agent response
  const sendMessage = async () => {
    if (!message.trim()) return;
    
    console.log('🚀 Starting message send process...');
    setLoading(true);
    setError(null);
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      agentId: agent.id,
      content: message,
      timestamp: new Date().toISOString(),
      isUser: true,
    };
    
    console.log('📝 Adding user message to chat:', userMsg.content);
    setChatMessages((prev) => [...prev, userMsg]);
    setMessage('');
    
    // Add timeout to prevent freezing
    const timeoutId = setTimeout(() => {
      console.log('⏰ Request timeout - taking too long');
      setLoading(false);
      setError('Request timed out. Please try again.');
    }, 30000); // 30 second timeout
    
    try {
      console.log('🔍 Finding working backend URL...');
      const workingUrl = await findWorkingBackend();
      
      if (!workingUrl) {
        throw new Error('No working backend URL found. Please check if the backend server is running.');
      }
      
      console.log('✅ Using backend URL:', workingUrl);
      console.log('🤖 Sending message to agent:', agent.name);
      console.log('📨 Message content:', userMsg.content);
      
      // Get user context from Supabase for personalized responses
      const { data: { user } } = await supabase.auth.getUser();
      let userContext = '';
      
      if (user) {
        // Fetch user's onboarding data and profile
        const { data: onboardingData } = await supabase
          .from(TABLES.ONBOARDING_DATA)
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        const { data: userProfile } = await supabase
          .from(TABLES.USER_PROFILES)
          .select('*')
          .eq('user_id', user.id)
          .single();
          
        if (onboardingData && userProfile) {
          userContext = `
User Context:
- Name: ${onboardingData.name}
- Age: ${onboardingData.age}
- Gender: ${onboardingData.gender}
- Weight: ${onboardingData.weight} lbs
- Height: ${onboardingData.height} inches
- Health Goals: ${onboardingData.goals}
- Physical Therapy/Care: ${onboardingData.physical_therapy}
- Current Health Score: ${userProfile.health_score}/100
- Agent Specialty: ${agent.specialty}
- Agent Name: ${agent.name}

Please use this information to provide personalized, relevant advice. Always address the user by their name and reference their specific goals and situation when appropriate.
`;
        }
      }
      
      const requestBody = {
        agent: agent.name,
        userContext: userContext,
        messages: [
          ...chatMessages.map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.content })),
          { role: 'user', content: userMsg.content },
        ],
      };
      
      console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(workingUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('📥 Response data:', JSON.stringify(data, null, 2));
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const agentMsg: ChatMessage = {
          id: Date.now().toString() + '-agent',
          agentId: agent.id,
          content: cleanAIResponse(data.choices[0].message.content),
          timestamp: new Date().toISOString(),
          isUser: false,
        };
        
        console.log('🤖 Agent response:', agentMsg.content);
        setChatMessages((prev) => [...prev, agentMsg]);
        
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        console.error('❌ Invalid response format:', data);
        throw new Error('Invalid response format from agent.');
      }
    } catch (e) {
      console.error('❌ Error in sendMessage:', e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown network error';
      setError(`Error: ${errorMessage}`);
      
      // Show user-friendly error alert
      Alert.alert(
        'Connection Error',
        'Could not connect to the AI agent. Please check:\n\n1. Backend server is running\n2. Network connection is stable\n3. Try again in a moment',
        [{ text: 'OK' }]
      );
    } finally {
      clearTimeout(timeoutId);
      console.log('🏁 Message send process completed');
      setLoading(false);
    }
  };

  // Checklist tab with interactive checkboxes
  const renderChecklist = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text.primary, ...theme.typography.h4 }]}>Today's Personalized Tasks</Text>
      {checklistItems.map((item) => (
        <View key={item.id} style={styles.checklistItem}>
          <View style={styles.checklistHeader}>
            <View style={styles.checklistLeft}>
              <AgentCheckbox item={item} onToggle={handleToggleTask} />
              <View style={styles.checklistText}>
                <Text style={[styles.checklistTitle, { color: theme.colors.text.primary, ...theme.typography.body1 }, item.completed && { textDecorationLine: 'line-through', opacity: 0.6 }]}>{item.title}</Text>
                <Text style={[styles.checklistDescription, { color: theme.colors.text.secondary, ...theme.typography.caption }]}>{item.description}</Text>
              </View>
            </View>
            <View style={styles.streakContainer}>
              <Ionicons name="flame" size={16} color={theme.colors.semantic.warning} />
              <Text style={[styles.streakText, { color: theme.colors.text.secondary }]}>{item.streak}</Text>
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // Chat tab
  const renderChat = () => (
    <View style={styles.chatTabContainer}>
      <ScrollView
        style={styles.chatMessages}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {chatMessages.length === 0 && !loading && !error && (
          <View style={styles.agentMessage}>
            <View style={[styles.messageBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light }]}> 
              <Text style={[styles.messageText, { color: theme.colors.text.secondary, ...theme.typography.body2 }]}>Say hi to {agent.name}!</Text>
            </View>
          </View>
        )}
        {chatMessages.map((msg) => (
          <View key={msg.id} style={[styles.messageContainer, msg.isUser ? styles.userMessage : styles.agentMessage]}>
            <View style={[
              styles.messageBubble,
              {
                backgroundColor: msg.isUser ? getAgentColor(agent.specialty) : theme.colors.surface,
                borderColor: msg.isUser ? 'transparent' : theme.colors.border.light,
              }
            ]}>
              <Text style={[styles.messageText, { color: msg.isUser ? 'white' : theme.colors.text.primary, ...theme.typography.body2 }]}>{msg.content}</Text>
            </View>
          </View>
        ))}
        {loading && (
          <View style={styles.agentMessage}>
            <View style={[styles.messageBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light }]}> 
              <Text style={[styles.messageText, { color: theme.colors.text.primary, ...theme.typography.body2 }]}>Thinking...</Text>
            </View>
          </View>
        )}
        {error && (
          <View style={styles.agentMessage}>
            <View style={[styles.messageBubble, { backgroundColor: theme.colors.semantic.error + '20', borderColor: theme.colors.semantic.error }]}> 
              <Text style={[styles.messageText, { color: theme.colors.semantic.error, ...theme.typography.body2 }]}>{error}</Text>
              <TouchableOpacity 
                style={[styles.retryButton, { backgroundColor: theme.colors.semantic.error }]}
                onPress={() => {
                  console.log('🔄 Retrying message send...');
                  setError(null);
                  sendMessage();
                }}
              >
                <Ionicons name="refresh" size={16} color={theme.colors.text.inverse} />
                <Text style={[styles.retryButtonText, { color: theme.colors.text.inverse }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      {/* Chat input always at the bottom */}
      <View style={[styles.chatInput, { borderTopColor: theme.colors.border.light }]}> 
        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            { 
              backgroundColor: theme.colors.surface,
              color: theme.colors.text.primary,
              borderColor: theme.colors.border.medium,
            }
          ]}
          placeholder={`Ask ${agent.name} anything...`}
          placeholderTextColor={theme.colors.text.disabled}
          value={message}
          onChangeText={setMessage}
          multiline
          editable={!loading}
          onFocus={() => {
            // Scroll to end when input is focused
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 300);
          }}
        />
        <TouchableOpacity 
          style={[styles.sendButton, { backgroundColor: getAgentColor(agent.specialty), opacity: loading ? 0.5 : 1 }]}
          onPress={sendMessage}
          disabled={loading || !message.trim()}
        >
          <Ionicons name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Swipe down to close (iOS UX)
  // This panResponder is now redundant as it's moved to the top.
  // Keeping it for now as per instructions, but it will be removed in a subsequent edit.
  // const panResponder = React.useRef(
  //   PanResponder.create({
  //     onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 20,
  //     onPanResponderMove: (_, gestureState) => {},
  //     onPanResponderRelease: (_, gestureState) => {
  //       if (gestureState.dy > 80) onClose();
  //     },
  //   })
  // ).current;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: theme.colors.background }]}>
        {showConfetti && (
          <ConfettiCannon
            key={confettiKey}
            count={80}
            origin={{ x: screenWidth / 2, y: screenHeight * 0.4 }}
            fadeOut
            explosionSpeed={500}
            fallSpeed={3000}
            colors={[theme.colors.primary, theme.colors.semantic.info, theme.colors.semantic.warning, theme.colors.semantic.success, theme.colors.text.inverse]}
            autoStart={true}
          />
        )}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border.light }]}> 
            <View style={styles.headerLeft}>
              <View style={[styles.agentAvatar, { backgroundColor: `${getAgentColor(agent.specialty)}20` }]}> 
                <Ionicons name={getAgentIcon(agent.specialty) as any} size={24} color={getAgentColor(agent.specialty)} />
              </View>
              <View>
                <Text style={[styles.agentName, { color: theme.colors.text.primary, ...theme.typography.h3 }]}>{agent.name}</Text>
                <Text style={[styles.agentStatus, { color: theme.colors.semantic.success, ...theme.typography.caption }]}>Online • Ready to help</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close agent chat modal">
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          {/* Tabs */}
          <View style={[styles.tabContainer, { borderBottomColor: theme.colors.border.light }]}> 
            <TouchableOpacity
              style={[styles.tab, activeTab === 'checklist' && { borderBottomColor: getAgentColor(agent.specialty) }]}
              onPress={() => setActiveTab('checklist')}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={activeTab === 'checklist' ? getAgentColor(agent.specialty) : theme.colors.text.secondary} />
              <Text style={[styles.tabText, { color: activeTab === 'checklist' ? getAgentColor(agent.specialty) : theme.colors.text.secondary, ...theme.typography.button }]}>Tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'chat' && { borderBottomColor: getAgentColor(agent.specialty) }]}
              onPress={() => setActiveTab('chat')}
            >
              <Ionicons name="chatbubble-outline" size={20} color={activeTab === 'chat' ? getAgentColor(agent.specialty) : theme.colors.text.secondary} />
              <Text style={[styles.tabText, { color: activeTab === 'chat' ? getAgentColor(agent.specialty) : theme.colors.text.secondary, ...theme.typography.button }]}>Chat</Text>
            </TouchableOpacity>
          </View>
          {/* Content */}
          <View style={{ flex: 1 }}>
            {activeTab === 'checklist' ? renderChecklist() : renderChat()}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden',
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  agentName: {
    marginBottom: 2,
  },
  agentStatus: {},
  closeButton: {
    padding: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    marginLeft: 8,
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  checklistItem: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checklistLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checklistText: {
    flex: 1,
  },
  checklistTitle: {
    marginBottom: 4,
  },
  checklistDescription: {},
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  chatTabContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chatMessages: {
    flex: 1,
    padding: 20,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  agentMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 17,
    marginBottom: 2,
  },
  messageText: {
    lineHeight: 22,
    fontSize: 17,
  },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 18,
    borderTopWidth: 1,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginRight: 12,
    maxHeight: 120,
    fontSize: 17,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  retryButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
}); 