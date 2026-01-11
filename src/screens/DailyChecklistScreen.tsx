import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Card, HeaderButton } from '@/components/ui';
import { ChecklistItem, WeeklyChecklistItem, AIAgent, ChatMessage } from '@/types';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '@/navigation/types';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, TABLES } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type ChecklistScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'DailyChecklist'>;

// Structured meal plan types
interface MealItem {
  id: string;
  name: string;
  diningHall: string;
  servingSize: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  dietaryTags?: string[];
}

interface MealPeriod {
  period: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  items: MealItem[];
  totalCalories: number;
  totalProtein?: number;
}

interface StructuredMealPlan {
  id?: string;
  day: string;
  meals: MealPeriod[];
  generatedAt: string;
  totalDayCalories: number;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Storage key for persisting checklist data
const CHECKLIST_STORAGE_KEY = '@soma_weekly_checklist';

// Backend URLs for AI chat (try production first, then local)
const BACKEND_URLS = [
  'https://soma-eight.vercel.app/api/chat',
  'http://localhost:3001/api/chat',
];

// AI Agents - 4 core agents: Health, Nutrition, Sleep, Fitness
// NOTE: Using "Meni" as backend name for Soma until API is redeployed
const AI_AGENTS: AIAgent[] = [
  {
    id: '0',
    name: 'Meni', // Backend name (Soma in UI, Meni on server until redeployed)
    specialty: 'general',
    avatar: '',
    description: 'Your personal health assistant for all health needs.',
    isActive: true,
  },
  {
    id: '1',
    name: 'Nutri',
    specialty: 'nutrition',
    avatar: '',
    description: 'Your nutrition specialist for meal plans and dietary goals.',
    isActive: true,
  },
  {
    id: '2',
    name: 'Luna',
    specialty: 'sleep',
    avatar: '',
    description: 'Your sleep and wellness guide for better rest quality.',
    isActive: true,
  },
  {
    id: '3',
    name: 'Rex',
    specialty: 'fitness',
    avatar: '',
    description: 'Your workout and exercise coach for fitness goals.',
    isActive: true,
  },
];

// Display name mapping (what users see vs what's sent to API)
const AGENT_DISPLAY_NAMES: { [key: string]: string } = {
  'Meni': 'Soma',
  'Nutri': 'Nutri',
  'Luna': 'Luna', 
  'Rex': 'Rex',
};

// Helper to get display name for UI
const getAgentDisplayName = (agent: AIAgent): string => {
  return AGENT_DISPLAY_NAMES[agent.name] || agent.name;
};

// Map task categories to relevant agents
const CATEGORY_TO_AGENT: { [key: string]: string } = {
  medication: '0', // Soma (health)
  exercise: '3', // Rex (fitness)
  nutrition: '1', // Nutri
  monitoring: '0', // Soma (health)
  appointment: '0', // Soma (health)
  sleep: '2', // Luna
  mindfulness: '0', // Soma (health)
};

// Get current week dates
const getWeekDates = () => {
  const today = new Date();
  const currentDay = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - currentDay);
  
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });
};

// Get week identifier for storage
const getWeekId = () => {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const days = Math.floor((today.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${today.getFullYear()}-W${weekNumber}`;
};

// Types for weekly data
interface DayTasks {
  [dayIndex: number]: ChecklistItem[];
}

interface WeeklyData {
  weekId: string;
  dayTasks: DayTasks;
  weeklyGoals: WeeklyChecklistItem[];
  generatedAt: string;
}

// Animated Checkbox Component
const AnimatedCheckbox: React.FC<{
  completed: boolean;
  onToggle: () => void;
  category: ChecklistItem['category'];
  size?: 'small' | 'normal';
}> = ({ completed, onToggle, category, size = 'normal' }) => {
  const { theme } = useTheme();
  const [scaleAnim] = useState(new Animated.Value(1));

  const getCategoryColor = () => {
    switch (category) {
      case 'medication': return '#0D9488';    // Teal
      case 'exercise': return '#059669';      // Emerald
      case 'nutrition': return '#F97316';     // Coral
      case 'monitoring': return '#7C3AED';    // Violet
      case 'appointment': return '#E11D48';   // Rose
      case 'sleep': return '#6366F1';         // Indigo
      case 'mindfulness': return '#0891B2';   // Cyan
      default: return theme.colors.primary;
    }
  };

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  const boxSize = size === 'small' ? 20 : 24;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View
        style={[
          styles.checkbox,
          {
            width: boxSize,
            height: boxSize,
            borderRadius: boxSize / 2,
            backgroundColor: completed ? getCategoryColor() : 'transparent',
            borderColor: getCategoryColor(),
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {completed && (
          <Ionicons name="checkmark" size={size === 'small' ? 12 : 16} color="white" />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

export const DailyChecklistScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<ChecklistScreenNavigationProp>();
  const { user } = useAuth();

  // Checklist state
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [weekDates] = useState(getWeekDates());
  const [dayTasks, setDayTasks] = useState<DayTasks>({});
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyChecklistItem[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [comprehensiveData, setComprehensiveData] = useState<any>(null);

  // Agent panel state
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [agentPanelHeight] = useState(new Animated.Value(0));
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  // Nutri-specific state for tabs
  const [nutriActiveTab, setNutriActiveTab] = useState<'plan' | 'chat'>('plan');
  const [mealPlan, setMealPlan] = useState<any>(null);
  const [structuredMealPlan, setStructuredMealPlan] = useState<StructuredMealPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSavingMealPlan, setIsSavingMealPlan] = useState(false);
  const [selectedFoodItem, setSelectedFoodItem] = useState<MealItem | null>(null);
  const [foodDetailModalVisible, setFoodDetailModalVisible] = useState(false);

  const today = new Date().getDay();

  // Load saved checklist or generate new one
  useEffect(() => {
    if (user?.id) {
      loadOrGenerateChecklist();
      loadMealPlanFromBackend();
    }
  }, [user]);

  // Parse AI response into structured meal plan
  const parseMealPlanFromResponse = (content: string, day: string): StructuredMealPlan | null => {
    try {
      // Try to extract JSON from the response
      let jsonStr = content;
      
      // Check if JSON is wrapped in code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      // Try to find JSON object in the response
      const jsonObjectMatch = jsonStr.match(/\{[\s\S]*"meals"[\s\S]*\}/);
      if (jsonObjectMatch) {
        jsonStr = jsonObjectMatch[0];
      }
      
      const parsed = JSON.parse(jsonStr);
      
      if (!parsed.meals || !Array.isArray(parsed.meals)) {
        console.log('Invalid meal plan structure');
        return null;
      }
      
      // Process and validate the meals
      const meals: MealPeriod[] = parsed.meals.map((meal: any, mealIdx: number) => {
        const items: MealItem[] = (meal.items || []).map((item: any, itemIdx: number) => ({
          id: `${meal.period}-${itemIdx}-${Date.now()}`,
          name: item.name || 'Unknown Item',
          diningHall: item.diningHall || 'UCSB Dining',
          servingSize: item.servingSize || '1 serving',
          calories: item.calories || 0,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          dietaryTags: item.dietaryTags || [],
        }));
        
        const totalCalories = items.reduce((sum, item) => sum + (item.calories || 0), 0);
        const totalProtein = items.reduce((sum, item) => sum + (item.protein || 0), 0);
        
        return {
          period: meal.period || ['breakfast', 'lunch', 'dinner', 'snacks'][mealIdx],
          items,
          totalCalories,
          totalProtein,
        };
      });
      
      const totalDayCalories = meals.reduce((sum, meal) => sum + meal.totalCalories, 0);
      
      return {
        day,
        meals,
        generatedAt: new Date().toISOString(),
        totalDayCalories,
      };
    } catch (e) {
      console.log('Could not parse meal plan JSON:', e);
      return null;
    }
  };

  // Update specific meal items (for partial modifications)
  const updateMealItems = (period: string, newItems: MealItem[]) => {
    if (!structuredMealPlan) return;
    
    setStructuredMealPlan(prev => {
      if (!prev) return prev;
      
      const updatedMeals = prev.meals.map(meal => {
        if (meal.period === period) {
          const totalCalories = newItems.reduce((sum, item) => sum + (item.calories || 0), 0);
          const totalProtein = newItems.reduce((sum, item) => sum + (item.protein || 0), 0);
          return { ...meal, items: newItems, totalCalories, totalProtein };
        }
        return meal;
      });
      
      const totalDayCalories = updatedMeals.reduce((sum, meal) => sum + meal.totalCalories, 0);
      
      return { ...prev, meals: updatedMeals, totalDayCalories };
    });
  };

  // Load meal plan from Supabase
  const loadMealPlanFromBackend = async () => {
    if (!user?.id) return;
    
    try {
      const today = FULL_DAYS[new Date().getDay()];
      const todayDate = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from(TABLES.MEAL_PLANS)
        .select('*')
        .eq('user_id', user.id)
        .eq('day', today)
        .gte('created_at', todayDate)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.log('Error loading meal plan:', error.message);
        return;
      }
      
      if (data) {
        console.log('📋 Loaded meal plan from backend');
        
        // Try to parse as structured JSON
        const structured = parseMealPlanFromResponse(data.content, data.day);
        if (structured) {
          setStructuredMealPlan(structured);
          console.log('📋 Loaded structured meal plan:', structured.meals.length, 'meals');
        }
        
        setMealPlan({
          id: data.id,
          content: data.content,
          day: data.day,
          generatedAt: data.generated_at,
        });
      }
    } catch (e: any) {
      console.log('Could not load meal plan:', e.message);
    }
  };

  // Save meal plan to Supabase
  const saveMealPlanToBackend = async (content: string, day: string, existingId?: string) => {
    if (!user?.id) return null;
    
    setIsSavingMealPlan(true);
    try {
      if (existingId) {
        // Update existing meal plan
        const { data, error } = await supabase
          .from(TABLES.MEAL_PLANS)
          .update({
            content: content,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
          .select()
          .single();
        
        if (error) {
          console.error('Error updating meal plan:', error.message);
          return null;
        }
        
        console.log('📋 Updated meal plan in backend');
        return data;
      } else {
        // Create new meal plan
        const { data, error } = await supabase
          .from(TABLES.MEAL_PLANS)
          .insert({
            user_id: user.id,
            content: content,
            day: day,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();
        
        if (error) {
          console.error('Error saving meal plan:', error.message);
          return null;
        }
        
        console.log('📋 Saved new meal plan to backend');
        return data;
      }
    } catch (e: any) {
      console.error('Error saving meal plan:', e.message);
      return null;
    } finally {
      setIsSavingMealPlan(false);
    }
  };

  // Save checklist when it changes
  useEffect(() => {
    if (Object.keys(dayTasks).length > 0) {
      saveChecklist();
    }
  }, [dayTasks, weeklyGoals]);

  // Animate agent panel
  useEffect(() => {
    Animated.spring(agentPanelHeight, {
      toValue: agentPanelOpen ? screenHeight * 0.55 : 0,
      useNativeDriver: false,
      friction: 10,
    }).start();
  }, [agentPanelOpen]);

  const loadOrGenerateChecklist = async () => {
    try {
      setIsLoading(true);
      const currentWeekId = getWeekId();
      
      const savedData = await AsyncStorage.getItem(`${CHECKLIST_STORAGE_KEY}_${user?.id}`);
      
      if (savedData) {
        const parsed: WeeklyData = JSON.parse(savedData);
        
        if (parsed.weekId === currentWeekId) {
          setDayTasks(parsed.dayTasks);
          setWeeklyGoals(parsed.weeklyGoals);
          // Also load comprehensive data
          await loadComprehensiveData();
          setIsLoading(false);
          return;
        }
      }
      
      await generateWeeklyChecklist();
    } catch (error) {
      console.error('Error loading checklist:', error);
      await generateWeeklyChecklist();
    }
  };

  const loadComprehensiveData = async () => {
    try {
      if (!user?.id) return;
      
      const { data: onboardingData } = await supabase
        .from(TABLES.ONBOARDING_DATA)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (onboardingData?.comprehensive_data) {
        setComprehensiveData(onboardingData.comprehensive_data);
      }
    } catch (e) {
      console.log('Could not load comprehensive data');
    }
  };

  const saveChecklist = async () => {
    try {
      const data: WeeklyData = {
        weekId: getWeekId(),
        dayTasks,
        weeklyGoals,
        generatedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(`${CHECKLIST_STORAGE_KEY}_${user?.id}`, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving checklist:', error);
    }
  };

  const generateWeeklyChecklist = async () => {
    try {
      setIsLoading(true);
      
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      // Fetch comprehensive onboarding data
      let userData: any = {
        name: user.name || 'User',
        goals: user.goals || '',
        physicalTherapy: user.physicalTherapy || '',
        age: user.age || 0,
        conditions: [],
        medications: [],
        allergies: [],
        lifestyle: null,
        healthGoals: [],
      };

      try {
        const { data: onboardingData } = await supabase
          .from(TABLES.ONBOARDING_DATA)
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (onboardingData) {
          userData.name = onboardingData.name || userData.name;
          userData.goals = onboardingData.goals || userData.goals;
          userData.physicalTherapy = onboardingData.physical_therapy || userData.physicalTherapy;
          userData.age = onboardingData.age || userData.age;
          
          if (onboardingData.comprehensive_data) {
            const comprehensive = onboardingData.comprehensive_data;
            setComprehensiveData(comprehensive);
            userData.conditions = comprehensive.medicalConditions || [];
            userData.medications = comprehensive.medications || [];
            userData.allergies = comprehensive.allergies || [];
            userData.lifestyle = comprehensive.lifestyle || null;
            userData.healthGoals = comprehensive.healthGoals || [];
            userData.currentTreatment = comprehensive.currentTreatment || null;
          }
        }
      } catch (e) {
        console.log('Using local user data');
      }

      const newDayTasks: DayTasks = {};
      
      for (let day = 0; day < 7; day++) {
        newDayTasks[day] = generateDayTasks(day, userData);
      }

      setDayTasks(newDayTasks);
      setWeeklyGoals(generateWeeklyGoalsFromData(userData));

    } catch (error) {
      console.error('Error generating checklist:', error);
      const defaultTasks: DayTasks = {};
      for (let day = 0; day < 7; day++) {
        defaultTasks[day] = getDefaultDayTasks(day);
      }
      setDayTasks(defaultTasks);
      setWeeklyGoals(getDefaultWeeklyGoals());
    } finally {
      setIsLoading(false);
    }
  };

  // Generate tasks specific to a day based on user data
  const generateDayTasks = (dayIndex: number, userData: any): ChecklistItem[] => {
    const tasks: ChecklistItem[] = [];
    const isWeekend = dayIndex === 0 || dayIndex === 6;
    
    let taskId = 0;
    const addTask = (title: string, description: string, category: ChecklistItem['category'], time?: string) => {
      tasks.push({
        id: `day${dayIndex}-task${taskId++}`,
        title,
        description,
        category,
        scheduledTime: time,
        completed: false,
        frequency: 'daily',
      });
    };

    // ===== MEDICATION TASKS =====
    if (userData.medications && userData.medications.length > 0) {
      userData.medications.forEach((med: any) => {
        const frequency = med.frequency || 'once_daily';
        const timeOfDay = med.timeOfDay || ['morning'];
        
        if (frequency === 'once_daily' || frequency === 'twice_daily' || frequency === 'three_times_daily') {
          if (timeOfDay.includes('morning') || frequency !== 'once_daily') {
            addTask(
              `Take ${med.name}`,
              med.dosage ? `${med.dosage} ${med.dosageUnit || 'mg'}` : 'As prescribed',
              'medication',
              '8:00 AM'
            );
          }
          if (frequency === 'twice_daily' || frequency === 'three_times_daily') {
            addTask(
              `Take ${med.name}`,
              med.dosage ? `${med.dosage} ${med.dosageUnit || 'mg'}` : 'As prescribed',
              'medication',
              frequency === 'twice_daily' ? '8:00 PM' : '2:00 PM'
            );
          }
          if (frequency === 'three_times_daily') {
            addTask(
              `Take ${med.name}`,
              med.dosage ? `${med.dosage} ${med.dosageUnit || 'mg'}` : 'As prescribed',
              'medication',
              '8:00 PM'
            );
          }
        }
      });
    } else {
      addTask('Review medications', 'Check if you need any vitamins or supplements', 'medication', '8:00 AM');
    }

    // ===== EXERCISE TASKS (vary by day) =====
    const exerciseSchedule: { [key: number]: { type: string; duration: number; description: string } } = {
      0: { type: 'Rest & Recovery', duration: 20, description: 'Light stretching or yoga' },
      1: { type: 'Cardio', duration: 30, description: 'Walking, jogging, or cycling' },
      2: { type: 'Strength Training', duration: 30, description: 'Upper body focus' },
      3: { type: 'Active Recovery', duration: 20, description: 'Swimming or light walk' },
      4: { type: 'Strength Training', duration: 30, description: 'Lower body focus' },
      5: { type: 'Cardio', duration: 30, description: 'HIIT or running' },
      6: { type: 'Flexibility', duration: 30, description: 'Yoga or stretching routine' },
    };

    if (userData.lifestyle?.exerciseTypes?.length > 0) {
      const userExercises = userData.lifestyle.exerciseTypes;
      const schedule = exerciseSchedule[dayIndex];
      const matchingExercise = userExercises.find((e: string) => 
        e.toLowerCase().includes(schedule.type.toLowerCase().split(' ')[0])
      ) || userExercises[dayIndex % userExercises.length];
      
      addTask(
        `${schedule.duration} min ${matchingExercise || schedule.type}`,
        schedule.description,
        'exercise',
        isWeekend ? '10:00 AM' : '7:00 AM'
      );
    } else {
      const schedule = exerciseSchedule[dayIndex];
      addTask(
        `${schedule.duration} min ${schedule.type}`,
        schedule.description,
        'exercise',
        isWeekend ? '10:00 AM' : '7:00 AM'
      );
    }

    // ===== PHYSICAL THERAPY / TREATMENT TASKS =====
    if (userData.currentTreatment || userData.physicalTherapy) {
      const therapy = userData.currentTreatment?.description || userData.physicalTherapy;
      const ptDays = [1, 2, 4, 5];
      if (ptDays.includes(dayIndex)) {
        addTask(
          'Physical therapy exercises',
          therapy || 'Complete your prescribed exercises',
          'exercise',
          '9:00 AM'
        );
      }
    }

    // ===== CONDITION-SPECIFIC TASKS =====
    if (userData.conditions && userData.conditions.length > 0) {
      userData.conditions.forEach((condition: any) => {
        const category = condition.category?.toLowerCase() || '';
        const name = condition.name?.toLowerCase() || '';
        
        if (category === 'endocrine' || name.includes('diabetes')) {
          addTask('Check blood glucose', 'Log your blood sugar levels', 'monitoring', '7:00 AM');
          if (!isWeekend) {
            addTask('Post-meal glucose check', 'Check 2 hours after lunch', 'monitoring', '2:00 PM');
          }
        }
        
        if (category === 'cardiovascular' || name.includes('blood pressure') || name.includes('heart')) {
          addTask('Blood pressure check', 'Record systolic and diastolic readings', 'monitoring', '8:00 AM');
        }
        
        if (category === 'mental_health' || name.includes('anxiety') || name.includes('depression')) {
          addTask('Mindfulness practice', '10-15 minutes of meditation or breathing exercises', 'mindfulness', isWeekend ? '11:00 AM' : '12:00 PM');
          addTask('Mood journal entry', 'Reflect on your emotional state today', 'mindfulness', '9:00 PM');
        }
        
        if (category === 'respiratory' || name.includes('asthma') || name.includes('copd')) {
          addTask('Breathing exercises', 'Practice deep breathing techniques', 'exercise', '10:00 AM');
        }
      });
    }

    // ===== NUTRITION TASKS =====
    const waterGoal = userData.lifestyle?.waterIntakeOz || 64;
    addTask(`Drink ${waterGoal}oz water`, 'Stay hydrated throughout the day', 'nutrition');

    if (dayIndex === 0) {
      addTask('Meal prep for the week', 'Prepare healthy meals for busy days', 'nutrition', '2:00 PM');
    } else if (!isWeekend) {
      addTask('Log meals', 'Track breakfast, lunch, and dinner', 'nutrition');
    }

    if (userData.healthGoals?.some((g: any) => g.category === 'nutrition' || g.title?.toLowerCase().includes('protein'))) {
      addTask('Protein goal check', 'Ensure adequate protein intake today', 'nutrition', '6:00 PM');
    }

    // ===== SLEEP TASKS =====
    const sleepHours = userData.lifestyle?.averageSleepHours || 8;
    const bedtime = 24 - sleepHours;
    
    if (isWeekend) {
      addTask('Wind-down routine', 'Prepare for restful sleep', 'sleep', '10:30 PM');
    } else {
      addTask(
        'Sleep preparation',
        `Start winding down for ${sleepHours}+ hours of sleep`,
        'sleep',
        `${bedtime > 12 ? bedtime - 12 : bedtime}:00 ${bedtime >= 12 ? 'PM' : 'AM'}`
      );
    }

    // ===== GOAL-SPECIFIC TASKS =====
    if (userData.healthGoals && userData.healthGoals.length > 0) {
      userData.healthGoals.forEach((goal: any) => {
        if (goal.category === 'weight' && dayIndex === 1) {
          addTask('Weekly weigh-in', `Track progress toward your weight goal`, 'monitoring', '7:00 AM');
        }
        if (goal.category === 'mental_health' && !tasks.some(t => t.category === 'mindfulness')) {
          addTask('Mental wellness check-in', goal.title || 'Take time for your mental health', 'mindfulness', '8:00 PM');
        }
      });
    }

    // ===== DAY-SPECIFIC ADDITIONS =====
    if (dayIndex === 0) {
      addTask('Plan the week ahead', 'Review appointments and schedule', 'monitoring', '7:00 PM');
    }
    if (dayIndex === 3) {
      addTask('Midweek health review', 'How are you feeling this week?', 'monitoring', '8:00 PM');
    }
    if (dayIndex === 5) {
      addTask('Weekly reflection', 'Celebrate wins and note improvements', 'mindfulness', '7:00 PM');
    }

    return tasks.sort((a, b) => {
      if (!a.scheduledTime) return 1;
      if (!b.scheduledTime) return -1;
      return parseTime(a.scheduledTime) - parseTime(b.scheduledTime);
    });
  };

  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const isPM = match[3].toUpperCase() === 'PM';
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const getDefaultDayTasks = (dayIndex: number): ChecklistItem[] => {
    return generateDayTasks(dayIndex, {
      name: 'User',
      goals: 'General health',
      physicalTherapy: '',
      conditions: [],
      medications: [],
      lifestyle: null,
      healthGoals: [],
    });
  };

  const generateWeeklyGoalsFromData = (userData: any): WeeklyChecklistItem[] => {
    const goals: WeeklyChecklistItem[] = [];
    
    const exerciseFreq = userData.lifestyle?.exerciseFrequency || 4;
    goals.push({
      id: 'week-exercise',
      title: 'Exercise sessions',
      description: 'Complete your workout sessions',
      category: 'exercise',
      targetCount: exerciseFreq,
      currentCount: 0,
      unit: 'sessions',
      daysCompleted: [],
    });

    if (userData.medications?.length > 0) {
      goals.push({
        id: 'week-meds',
        title: 'Medication adherence',
        description: 'Take all medications on time',
        category: 'medication',
        targetCount: 7,
        currentCount: 0,
        unit: 'days',
        daysCompleted: [],
      });
    }

    goals.push({
      id: 'week-water',
      title: 'Hydration goal',
      description: `Drink ${userData.lifestyle?.waterIntakeOz || 64}oz daily`,
      category: 'nutrition',
      targetCount: 7,
      currentCount: 0,
      unit: 'days',
      daysCompleted: [],
    });

    goals.push({
      id: 'week-sleep',
      title: `Sleep ${userData.lifestyle?.averageSleepHours || 7}+ hours`,
      description: 'Get quality rest each night',
      category: 'sleep',
      targetCount: 7,
      currentCount: 0,
      unit: 'nights',
      daysCompleted: [],
    });

    if (userData.currentTreatment || userData.physicalTherapy) {
      goals.push({
        id: 'week-pt',
        title: 'Therapy exercises',
        description: userData.currentTreatment?.description || userData.physicalTherapy,
        category: 'exercise',
        targetCount: 4,
        currentCount: 0,
        unit: 'sessions',
        daysCompleted: [],
      });
    }

    if (userData.healthGoals?.length > 0) {
      userData.healthGoals.slice(0, 2).forEach((goal: any, idx: number) => {
        if (!goals.some(g => g.title.toLowerCase().includes(goal.title?.toLowerCase().split(' ')[0]))) {
          goals.push({
            id: `week-custom-${idx}`,
            title: goal.title,
            description: goal.description || '',
            category: goal.category || 'monitoring',
            targetCount: goal.targetValue || 5,
            currentCount: 0,
            unit: goal.targetUnit || 'times',
            daysCompleted: [],
          });
        }
      });
    }

    return goals;
  };

  const getDefaultWeeklyGoals = (): WeeklyChecklistItem[] => {
    return generateWeeklyGoalsFromData({});
  };

  const refreshChecklist = async () => {
    try {
      await AsyncStorage.removeItem(`${CHECKLIST_STORAGE_KEY}_${user?.id}`);
    } catch (e) {}
    await generateWeeklyChecklist();
  };

  const triggerConfetti = () => {
    setConfettiKey(prev => prev + 1);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
  };

  const handleToggleDailyItem = (itemId: string) => {
    setDayTasks(prev => {
      const updated = { ...prev };
      updated[selectedDay] = prev[selectedDay].map(item =>
        item.id === itemId
          ? { ...item, completed: !item.completed, completedAt: !item.completed ? new Date().toISOString() : undefined }
          : item
      );
      const toggled = updated[selectedDay].find(i => i.id === itemId);
      if (toggled?.completed) triggerConfetti();
      return updated;
    });
  };

  const handleIncrementWeeklyGoal = (goalId: string) => {
    setWeeklyGoals(prev => prev.map(goal => {
      if (goal.id === goalId && goal.currentCount < goal.targetCount) {
        const newCount = goal.currentCount + 1;
        const newDaysCompleted = [...goal.daysCompleted, today];
        if (newCount === goal.targetCount) triggerConfetti();
        return { ...goal, currentCount: newCount, daysCompleted: newDaysCompleted };
      }
      return goal;
    }));
  };

  const handleDecrementWeeklyGoal = (goalId: string) => {
    setWeeklyGoals(prev => prev.map(goal => {
      if (goal.id === goalId && goal.currentCount > 0) {
        const newDaysCompleted = [...goal.daysCompleted];
        newDaysCompleted.pop();
        return { ...goal, currentCount: goal.currentCount - 1, daysCompleted: newDaysCompleted };
      }
      return goal;
    }));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'medication': return 'medical-outline';
      case 'exercise': return 'fitness-outline';
      case 'nutrition': return 'restaurant-outline';
      case 'monitoring': return 'analytics-outline';
      case 'appointment': return 'calendar-outline';
      case 'sleep': return 'moon-outline';
      case 'mindfulness': return 'leaf-outline';
      case 'goal': return 'flag-outline';
      default: return 'checkbox-outline';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'medication': return '#0D9488';    // Teal (primary)
      case 'exercise': return '#059669';      // Emerald
      case 'nutrition': return '#F97316';     // Coral
      case 'monitoring': return '#7C3AED';    // Violet
      case 'appointment': return '#E11D48';   // Rose
      case 'sleep': return '#6366F1';         // Indigo
      case 'mindfulness': return '#0891B2';   // Cyan
      case 'goal': return '#D97706';          // Amber
      default: return theme.colors.primary;
    }
  };

  const getAgentIcon = (specialty: AIAgent['specialty']) => {
    switch (specialty) {
      case 'general': return 'heart';
      case 'nutrition': return 'restaurant';
      case 'sleep': return 'moon';
      case 'fitness': return 'fitness';
      default: return 'chatbubble';
    }
  };

  const getAgentColor = (specialty: AIAgent['specialty']) => {
    switch (specialty) {
      case 'general': return '#0D9488';   // Teal - Soma
      case 'nutrition': return '#F97316'; // Coral - Nutri
      case 'sleep': return '#6366F1';     // Indigo - Luna
      case 'fitness': return '#059669';   // Emerald - Rex
      default: return theme.colors.primary;
    }
  };

  // Agent chat functionality
  const handleExplainTask = (task: ChecklistItem) => {
    const agentId = CATEGORY_TO_AGENT[task.category] || '0';
    const agent = AI_AGENTS.find(a => a.id === agentId) || AI_AGENTS[0];
    
    setSelectedAgent(agent);
    setChatMessages([]);
    setAgentPanelOpen(true);
    setShowAgentMenu(false);
    
    // Create the auto-prompt for explaining the task
    const autoPrompt = generateExplanationPrompt(task);
    
    // Send the auto-prompt after a short delay
    setTimeout(() => {
      sendMessageToAgent(autoPrompt, agent);
    }, 500);
  };

  const generateExplanationPrompt = (task: ChecklistItem): string => {
    return `Why is the task "${task.title}" on my checklist today? ${task.description ? `The task description is: "${task.description}".` : ''} Please explain why this is important for my health based on my profile and goals.`;
  };

  const buildUserContext = (): string => {
    if (!comprehensiveData && !user) return '';
    
    let context = `User Health Profile:\n`;
    context += `- Name: ${user?.name || 'User'}\n`;
    context += `- Age: ${user?.age || 'Not specified'}\n`;
    
    if (comprehensiveData) {
      if (comprehensiveData.medicalConditions?.length > 0) {
        context += `- Medical Conditions: ${comprehensiveData.medicalConditions.map((c: any) => c.name).join(', ')}\n`;
      }
      if (comprehensiveData.medications?.length > 0) {
        context += `- Current Medications: ${comprehensiveData.medications.map((m: any) => `${m.name} (${m.dosage || 'as prescribed'})`).join(', ')}\n`;
      }
      if (comprehensiveData.allergies?.length > 0) {
        context += `- Allergies: ${comprehensiveData.allergies.map((a: any) => a.name).join(', ')}\n`;
      }
      if (comprehensiveData.healthGoals?.length > 0) {
        context += `- Health Goals: ${comprehensiveData.healthGoals.map((g: any) => g.title).join(', ')}\n`;
      }
      if (comprehensiveData.lifestyle) {
        const ls = comprehensiveData.lifestyle;
        if (ls.exerciseFrequency) context += `- Exercise Frequency: ${ls.exerciseFrequency} times/week\n`;
        if (ls.averageSleepHours) context += `- Average Sleep: ${ls.averageSleepHours} hours/night\n`;
        if (ls.dietaryPreferences?.length > 0) context += `- Dietary Preferences: ${ls.dietaryPreferences.join(', ')}\n`;
      }
      if (comprehensiveData.currentTreatment?.description) {
        context += `- Current Treatment: ${comprehensiveData.currentTreatment.description}\n`;
      }
    }
    
    if (user?.goals) {
      context += `- User's Stated Goals: ${user.goals}\n`;
    }
    if (user?.physicalTherapy) {
      context += `- Physical Therapy/Care: ${user.physicalTherapy}\n`;
    }
    
    return context;
  };

  const sendMessageToAgent = async (message: string, agent: AIAgent) => {
    if (!message.trim()) return;
    
    setIsSending(true);
    console.log(`🤖 Sending message to agent: ${agent.name}`);
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      agentId: agent.id,
      content: message,
      timestamp: new Date().toISOString(),
      isUser: true,
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    
    try {
      const userContext = buildUserContext();
      
      // For Nutri agent, include meal plan context and instructions for modifications
      let systemContext = userContext;
      let messageContent = message;
      
      if (agent.name === 'Nutri' && mealPlan?.content) {
        systemContext += `\n\nCURRENT MEAL PLAN:\n${mealPlan.content}\n`;
        
        // Check if user is asking to modify the meal plan
        const modificationKeywords = ['change', 'modify', 'update', 'replace', 'swap', 'switch', 'make it', 'less', 'more', 'add', 'remove', 'instead', 'different', 'healthier', 'lower', 'higher', 'vegetarian', 'vegan', 'gluten', 'dairy', 'protein', 'carb', 'calorie'];
        const isModificationRequest = modificationKeywords.some(keyword => 
          message.toLowerCase().includes(keyword)
        );
        
        if (isModificationRequest) {
          messageContent = `${message}\n\nIMPORTANT: If you're modifying my meal plan, please provide the COMPLETE updated meal plan in your response. Start the meal plan section with "---MEAL_PLAN_START---" and end it with "---MEAL_PLAN_END---". Include all meals (breakfast, lunch, dinner, snacks) even if only one was changed.`;
        }
      }
      
      const requestBody = {
        agent: agent.name,
        userContext: systemContext,
        userId: user?.id, // Pass userId for comprehensive context loading
        messages: [
          ...chatMessages.map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.content })),
          { role: 'user', content: messageContent },
        ],
      };
      
      console.log('📤 Request body:', JSON.stringify({ agent: agent.name, messageCount: requestBody.messages.length, userId: user?.id }));
      
      // Try each backend URL until one works
      let response: Response | null = null;
      let lastError: string = '';
      
      for (const url of BACKEND_URLS) {
        try {
          console.log(`🔄 Trying: ${url}`);
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          
          console.log(`📥 Response from ${url}: ${response.status}`);
          
          if (response.ok) {
            break; // Success! Exit the loop
          } else {
            const errorText = await response.text();
            lastError = `${response.status}: ${errorText}`;
            console.log(`⚠️ ${url} returned ${response.status}, trying next...`);
            response = null; // Reset to try next URL
          }
        } catch (e: any) {
          lastError = e.message;
          console.log(`⚠️ ${url} failed: ${e.message}, trying next...`);
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(lastError || 'All backend URLs failed');
      }
      
      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        let responseContent = data.choices[0].message.content;
        
        // Check if the response contains an updated meal plan (for Nutri agent)
        if (agent.name === 'Nutri' && (mealPlan || structuredMealPlan)) {
          const today = FULL_DAYS[new Date().getDay()];
          
          // Check if this was a modification request
          const lastUserMessage = chatMessages.filter(m => m.isUser).pop()?.content?.toLowerCase() || message.toLowerCase();
          const wasModificationRequest = ['change', 'modify', 'update', 'replace', 'swap', 'switch', 'make it', 'make my', 'vegetarian', 'vegan', 'more protein', 'lower', 'higher', 'different', 'gluten', 'breakfast', 'lunch', 'dinner'].some(
            keyword => lastUserMessage.includes(keyword)
          );
          
          // Try to parse JSON from response for partial updates
          const parsedUpdate = parseMealPlanFromResponse(responseContent, today);
          
          if (parsedUpdate && wasModificationRequest) {
            // Check if it's a partial update (specific meal) or full update
            const mentionedBreakfast = lastUserMessage.includes('breakfast');
            const mentionedLunch = lastUserMessage.includes('lunch');
            const mentionedDinner = lastUserMessage.includes('dinner');
            const isPartialUpdate = (mentionedBreakfast || mentionedLunch || mentionedDinner) && 
                                    !(mentionedBreakfast && mentionedLunch && mentionedDinner);
            
            if (isPartialUpdate && structuredMealPlan) {
              // Partial update - only update the mentioned meal(s)
              const updatedMeals = structuredMealPlan.meals.map(existingMeal => {
                const shouldUpdate = 
                  (existingMeal.period === 'breakfast' && mentionedBreakfast) ||
                  (existingMeal.period === 'lunch' && mentionedLunch) ||
                  (existingMeal.period === 'dinner' && mentionedDinner);
                
                if (shouldUpdate) {
                  // Find the matching meal in the update
                  const updatedMeal = parsedUpdate.meals.find(m => m.period === existingMeal.period);
                  if (updatedMeal) {
                    return updatedMeal;
                  }
                }
                return existingMeal;
              });
              
              const totalDayCalories = updatedMeals.reduce((sum, meal) => sum + meal.totalCalories, 0);
              
              setStructuredMealPlan({
                ...structuredMealPlan,
                meals: updatedMeals,
                totalDayCalories,
                generatedAt: new Date().toISOString(),
              });
              
              responseContent = '✅ **Meal updated!** Only the modified items have been changed.\n\n' + responseContent;
            } else {
              // Full update
              setStructuredMealPlan(parsedUpdate);
              responseContent = '✅ **Meal plan updated!**\n\n' + responseContent;
            }
            
            // Save to backend
            const savedPlan = await saveMealPlanToBackend(
              JSON.stringify(structuredMealPlan || parsedUpdate), 
              today, 
              mealPlan?.id
            );
            
            setMealPlan({
              id: savedPlan?.id || mealPlan?.id,
              content: responseContent,
              generatedAt: new Date().toISOString(),
              day: today,
            });
            
            responseContent += '\n\n_Switch to the Meal Plan tab to see your changes._';
          }
        }
        
        const agentMsg: ChatMessage = {
          id: Date.now().toString() + '-agent',
          agentId: agent.id,
          content: responseContent,
          timestamp: new Date().toISOString(),
          isUser: false,
        };
        
        setChatMessages(prev => [...prev, agentMsg]);
        
        setTimeout(() => {
          chatScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error: any) {
      console.error('❌ Error sending message:', error);
      const errorMessage = error.message || 'Unknown error';
      const errorMsg: ChatMessage = {
        id: Date.now().toString() + '-error',
        agentId: agent.id,
        content: `Sorry, I had trouble connecting (${errorMessage}). The API may need to be redeployed.`,
        timestamp: new Date().toISOString(),
        isUser: false,
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendChat = () => {
    if (selectedAgent && chatInput.trim()) {
      sendMessageToAgent(chatInput, selectedAgent);
    }
  };

  // Generate meal plan using AI
  const generateMealPlan = async () => {
    setIsGeneratingPlan(true);
    
    try {
      const userContext = buildUserContext();
      const today = FULL_DAYS[new Date().getDay()];
      
      const requestBody = {
        agent: 'Nutri',
        userContext: userContext,
        userId: user?.id, // Pass userId for comprehensive context loading
        messages: [
          {
            role: 'user',
            content: `Create my meal plan for today (${today}) using UCSB dining halls!

CRITICAL RULES:
1. Pick ONE dining hall per meal (don't mix halls in same meal)
2. Use only foods from today's menu
3. 2-4 items per meal

Return as JSON:
{
  "meals": [
    {
      "period": "breakfast",
      "items": [
        {"name": "Food Name", "diningHall": "Carrillo", "servingSize": "1 Cup", "calories": 200, "protein": 10, "carbs": 25, "fat": 8, "dietaryTags": ["vegan"]}
      ]
    },
    {"period": "lunch", "items": [...]},
    {"period": "dinner", "items": [...]}
  ]
}

All items in each meal MUST be from the SAME dining hall. Consider my health goals. Return ONLY JSON.`,
          },
        ],
      };
      
      let response: Response | null = null;
      let lastError: string = '';
      
      for (const url of BACKEND_URLS) {
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });
          
          if (response.ok) {
            break;
          } else {
            const errorText = await response.text();
            lastError = `${response.status}: ${errorText}`;
            response = null;
          }
        } catch (e: any) {
          lastError = e.message;
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(lastError || 'Failed to generate meal plan');
      }
      
      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content;
        
        // Try to parse as structured JSON
        const structured = parseMealPlanFromResponse(content, today);
        
        if (structured) {
          setStructuredMealPlan(structured);
          console.log('📋 Parsed structured meal plan:', structured.meals.length, 'meals');
        }
        
        // Save to backend (save both raw and structured)
        const savedPlan = await saveMealPlanToBackend(
          structured ? JSON.stringify(structured) : content, 
          today
        );
        
        setMealPlan({
          id: savedPlan?.id,
          content: content,
          generatedAt: new Date().toISOString(),
          day: today,
        });
      }
    } catch (error: any) {
      console.error('Error generating meal plan:', error);
      setMealPlan({
        content: `Sorry, I couldn't generate your meal plan right now. Error: ${error.message}`,
        generatedAt: new Date().toISOString(),
        day: FULL_DAYS[new Date().getDay()],
        error: true,
      });
      setStructuredMealPlan(null);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleSelectAgent = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setChatMessages([]);
    setShowAgentMenu(false);
    setAgentPanelOpen(true);
    
    // Reset Nutri tab to 'plan' when selecting Nutri
    if (agent.name === 'Nutri') {
      setNutriActiveTab('plan');
      // Auto-generate meal plan if not already generated for today
      if (!mealPlan || mealPlan.day !== FULL_DAYS[new Date().getDay()]) {
        generateMealPlan();
      }
    }
  };

  const currentDayTasks = dayTasks[selectedDay] || [];
  const completedDaily = currentDayTasks.filter(i => i.completed).length;
  const totalDaily = currentDayTasks.length;
  const dailyPercentage = totalDaily > 0 ? Math.round((completedDaily / totalDaily) * 100) : 0;

  const weeklyTotalProgress = weeklyGoals.reduce((acc, g) => acc + g.currentCount, 0);
  const weeklyTotalTarget = weeklyGoals.reduce((acc, g) => acc + g.targetCount, 0);
  const weeklyPercentage = weeklyTotalTarget > 0 ? Math.round((weeklyTotalProgress / weeklyTotalTarget) * 100) : 0;

  const getDayCompletion = (day: number): number => {
    const tasks = dayTasks[day] || [];
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <HeaderButton
        icon="menu"
        onPress={() => navigation.openDrawer()}
        accessibilityLabel="Open menu"
      />
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>My Checklist</Text>
      </View>
      <TouchableOpacity style={styles.refreshButton} onPress={refreshChecklist}>
        <Ionicons name="refresh" size={20} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderDaySelector = () => (
    <View style={styles.daySelectorContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daySelector}>
        {weekDates.map((date, index) => {
          const isToday = index === today;
          const isSelected = index === selectedDay;
          const dayNum = date.getDate();
          const completion = getDayCompletion(index);
          
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dayButton,
                isSelected && { backgroundColor: theme.colors.primary },
                isToday && !isSelected && { borderColor: theme.colors.primary, borderWidth: 2 },
              ]}
              onPress={() => setSelectedDay(index)}
            >
              <Text style={[
                styles.dayLabel,
                { color: isSelected ? 'white' : theme.colors.text.secondary },
              ]}>
                {DAYS_OF_WEEK[index]}
              </Text>
              <Text style={[
                styles.dayNumber,
                { color: isSelected ? 'white' : theme.colors.text.primary },
              ]}>
                {dayNum}
              </Text>
              <View style={[
                styles.completionDot,
                {
                  backgroundColor: completion === 100 
                    ? theme.colors.semantic.success 
                    : completion > 0 
                      ? theme.colors.semantic.warning 
                      : theme.colors.border.light,
                }
              ]} />
              {isToday && (
                <Text style={[styles.todayLabel, { color: isSelected ? 'white' : theme.colors.primary }]}>
                  Today
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderTabSelector = () => (
    <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'daily' && { backgroundColor: theme.colors.primary }]}
        onPress={() => setActiveTab('daily')}
      >
        <Ionicons name="today-outline" size={18} color={activeTab === 'daily' ? 'white' : theme.colors.text.secondary} />
        <Text style={[styles.tabText, { color: activeTab === 'daily' ? 'white' : theme.colors.text.secondary }]}>
          {FULL_DAYS[selectedDay]}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'weekly' && { backgroundColor: theme.colors.primary }]}
        onPress={() => setActiveTab('weekly')}
      >
        <Ionicons name="calendar-outline" size={18} color={activeTab === 'weekly' ? 'white' : theme.colors.text.secondary} />
        <Text style={[styles.tabText, { color: activeTab === 'weekly' ? 'white' : theme.colors.text.secondary }]}>
          Weekly Goals
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderWeeklyOverview = () => (
    <Card style={styles.overviewCard} variant="elevated">
      <View style={styles.overviewHeader}>
        <View>
          <Text style={[styles.overviewTitle, { color: theme.colors.text.primary }]}>
            {activeTab === 'daily' ? `${FULL_DAYS[selectedDay]}'s Tasks` : 'Weekly Progress'}
          </Text>
          <Text style={[styles.overviewSubtitle, { color: theme.colors.text.secondary }]}>
            {activeTab === 'daily' 
              ? `${completedDaily} of ${totalDaily} tasks completed`
              : `${weeklyTotalProgress} of ${weeklyTotalTarget} goals achieved`}
          </Text>
        </View>
        <View style={[styles.percentageCircle, { backgroundColor: theme.colors.primaryLight }]}>
          <Text style={[styles.percentageText, { color: theme.colors.primary }]}>
            {activeTab === 'daily' ? dailyPercentage : weeklyPercentage}%
          </Text>
        </View>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarBg, { backgroundColor: theme.colors.border.light }]} />
        <View style={[
          styles.progressBarFill,
          {
            backgroundColor: theme.colors.primary,
            width: `${activeTab === 'daily' ? dailyPercentage : weeklyPercentage}%`,
          }
        ]} />
      </View>
    </Card>
  );

  const renderDailyTasks = () => {
    const pendingItems = currentDayTasks.filter(i => !i.completed);
    const completedItems = currentDayTasks.filter(i => i.completed);

    return (
      <View style={styles.section}>
        {/* Pending Tasks */}
        {pendingItems.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              To Do ({pendingItems.length})
            </Text>
            {pendingItems.map(item => (
              <Card key={item.id} style={styles.taskCard} variant="outlined">
                <View style={styles.taskRow}>
                  <AnimatedCheckbox
                    completed={item.completed}
                    onToggle={() => handleToggleDailyItem(item.id)}
                    category={item.category}
                  />
                  <View style={styles.taskContent}>
                    <View style={styles.taskHeader}>
                      <View style={styles.taskTitleRow}>
                        <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(item.category) }]} />
                        <Text style={[styles.taskTitle, { color: theme.colors.text.primary }]}>
                          {item.title}
                        </Text>
                      </View>
                      {item.scheduledTime && (
                        <Text style={[styles.taskTime, { color: theme.colors.text.tertiary }]}>
                          {item.scheduledTime}
                        </Text>
                      )}
                    </View>
                    {item.description && (
                      <Text style={[styles.taskDescription, { color: theme.colors.text.secondary }]}>
                        {item.description}
                      </Text>
                    )}
                    {/* Explain This Button */}
                    <TouchableOpacity
                      style={[styles.explainButton, { backgroundColor: getCategoryColor(item.category) + '20' }]}
                      onPress={() => handleExplainTask(item)}
                    >
                      <Ionicons name="help-circle-outline" size={14} color={getCategoryColor(item.category)} />
                      <Text style={[styles.explainButtonText, { color: getCategoryColor(item.category) }]}>
                        Explain this
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Completed Tasks */}
        {completedItems.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary, marginTop: 24 }]}>
              Completed ✓ ({completedItems.length})
            </Text>
            {completedItems.map(item => (
              <Card key={item.id} style={[styles.taskCard, { opacity: 0.6 }]} variant="outlined">
                <View style={styles.taskRow}>
                  <AnimatedCheckbox
                    completed={item.completed}
                    onToggle={() => handleToggleDailyItem(item.id)}
                    category={item.category}
                  />
                  <View style={styles.taskContent}>
                    <View style={styles.taskHeader}>
                      <View style={styles.taskTitleRow}>
                        <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(item.category) }]} />
                        <Text style={[styles.taskTitle, { color: theme.colors.text.secondary, textDecorationLine: 'line-through' }]}>
                          {item.title}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        {currentDayTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={theme.colors.text.disabled} />
            <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>
              No tasks for {FULL_DAYS[selectedDay]}
            </Text>
            <TouchableOpacity style={[styles.refreshTasksButton, { backgroundColor: theme.colors.primary }]} onPress={refreshChecklist}>
              <Text style={styles.refreshTasksText}>Generate Tasks</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderWeeklyGoals = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
        This Week's Goals
      </Text>
      {weeklyGoals.map(goal => {
        const progress = (goal.currentCount / goal.targetCount) * 100;
        const isComplete = goal.currentCount >= goal.targetCount;
        
        return (
          <Card key={goal.id} style={styles.weeklyGoalCard} variant="elevated">
            <View style={styles.weeklyGoalHeader}>
              <View style={[styles.goalIconContainer, { backgroundColor: getCategoryColor(goal.category) + '20' }]}>
                <Ionicons name={getCategoryIcon(goal.category) as any} size={24} color={getCategoryColor(goal.category)} />
              </View>
              <View style={styles.goalInfo}>
                <Text style={[styles.goalTitle, { color: theme.colors.text.primary }]}>
                  {goal.title}
                </Text>
                <Text style={[styles.goalDescription, { color: theme.colors.text.secondary }]} numberOfLines={1}>
                  {goal.description}
                </Text>
              </View>
              {isComplete && (
                <Ionicons name="checkmark-circle" size={28} color={theme.colors.semantic.success} />
              )}
            </View>

            <View style={styles.goalProgressSection}>
              <View style={styles.goalProgressBar}>
                <View style={[styles.goalProgressBg, { backgroundColor: theme.colors.border.light }]} />
                <View style={[
                  styles.goalProgressFill,
                  { backgroundColor: getCategoryColor(goal.category), width: `${Math.min(progress, 100)}%` }
                ]} />
              </View>
              <Text style={[styles.goalProgressText, { color: theme.colors.text.secondary }]}>
                {goal.currentCount} / {goal.targetCount} {goal.unit}
              </Text>
            </View>

            <View style={styles.goalActions}>
              <TouchableOpacity
                style={[styles.goalActionButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light }]}
                onPress={() => handleDecrementWeeklyGoal(goal.id)}
                disabled={goal.currentCount === 0}
              >
                <Ionicons name="remove" size={20} color={goal.currentCount === 0 ? theme.colors.text.disabled : theme.colors.text.primary} />
              </TouchableOpacity>
              <View style={styles.goalDays}>
                {DAYS_OF_WEEK.map((day, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.goalDayDot,
                      {
                        backgroundColor: goal.daysCompleted.includes(idx)
                          ? getCategoryColor(goal.category)
                          : theme.colors.border.light,
                      }
                    ]}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.goalActionButton, { backgroundColor: isComplete ? theme.colors.border.light : getCategoryColor(goal.category) }]}
                onPress={() => handleIncrementWeeklyGoal(goal.id)}
                disabled={isComplete}
              >
                <Ionicons name="add" size={20} color={isComplete ? theme.colors.text.disabled : 'white'} />
              </TouchableOpacity>
            </View>
          </Card>
        );
      })}
    </View>
  );

  // Agent Panel (Bottom Sheet Style)
  const renderAgentPanel = () => (
    <Animated.View 
      style={[
        styles.agentPanel,
        { 
          height: agentPanelHeight,
          backgroundColor: theme.colors.background,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }
      ]}
    >
      {agentPanelOpen && selectedAgent && (
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Agent Header */}
          <View style={[styles.agentPanelHeader, { borderBottomColor: theme.colors.border.light }]}>
            <View style={styles.agentPanelHeaderLeft}>
              <View style={[styles.agentAvatar, { backgroundColor: getAgentColor(selectedAgent.specialty) + '20' }]}>
                <Ionicons 
                  name={getAgentIcon(selectedAgent.specialty) as any} 
                  size={24} 
                  color={getAgentColor(selectedAgent.specialty)} 
                />
              </View>
              <View>
                <Text style={[styles.agentPanelTitle, { color: theme.colors.text.primary }]}>
                  {getAgentDisplayName(selectedAgent)}
                </Text>
                <Text style={[styles.agentPanelSubtitle, { color: theme.colors.text.secondary }]}>
                  {selectedAgent.description.substring(0, 40)}...
                </Text>
              </View>
            </View>
            <View style={styles.agentPanelHeaderRight}>
              <TouchableOpacity 
                style={[styles.switchAgentButton, { backgroundColor: theme.colors.surface }]}
                onPress={() => setShowAgentMenu(!showAgentMenu)}
              >
                <Ionicons name="swap-horizontal" size={18} color={theme.colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.closeAgentButton}
                onPress={() => setAgentPanelOpen(false)}
              >
                <Ionicons name="chevron-down" size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Agent Selector Dropdown */}
          {showAgentMenu && (
            <View style={[styles.agentMenuDropdown, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light }]}>
              {AI_AGENTS.map(agent => (
                <TouchableOpacity
                  key={agent.id}
                  style={[
                    styles.agentMenuItem,
                    selectedAgent.id === agent.id && { backgroundColor: getAgentColor(agent.specialty) + '10' }
                  ]}
                  onPress={() => handleSelectAgent(agent)}
                >
                  <View style={[styles.agentMenuIcon, { backgroundColor: getAgentColor(agent.specialty) + '20' }]}>
                    <Ionicons name={getAgentIcon(agent.specialty) as any} size={18} color={getAgentColor(agent.specialty)} />
                  </View>
                  <Text style={[styles.agentMenuText, { color: theme.colors.text.primary }]}>
                    {getAgentDisplayName(agent)}
                  </Text>
                  {selectedAgent.id === agent.id && (
                    <Ionicons name="checkmark" size={18} color={getAgentColor(agent.specialty)} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Nutri Tabs (Plan vs Chat) - Only show for Nutri agent */}
          {selectedAgent.name === 'Nutri' && (
            <View style={[styles.nutriTabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border.light }]}>
              <TouchableOpacity
                style={[
                  styles.nutriTab,
                  nutriActiveTab === 'plan' && { backgroundColor: getAgentColor(selectedAgent.specialty) }
                ]}
                onPress={() => setNutriActiveTab('plan')}
              >
                <Ionicons 
                  name="restaurant-outline" 
                  size={16} 
                  color={nutriActiveTab === 'plan' ? 'white' : theme.colors.text.secondary} 
                />
                <Text style={[
                  styles.nutriTabText,
                  { color: nutriActiveTab === 'plan' ? 'white' : theme.colors.text.secondary }
                ]}>
                  Meal Plan
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.nutriTab,
                  nutriActiveTab === 'chat' && { backgroundColor: getAgentColor(selectedAgent.specialty) }
                ]}
                onPress={() => setNutriActiveTab('chat')}
              >
                <Ionicons 
                  name="chatbubble-outline" 
                  size={16} 
                  color={nutriActiveTab === 'chat' ? 'white' : theme.colors.text.secondary} 
                />
                <Text style={[
                  styles.nutriTabText,
                  { color: nutriActiveTab === 'chat' ? 'white' : theme.colors.text.secondary }
                ]}>
                  Chat
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Meal Plan View - Only show for Nutri agent when Plan tab is active */}
          {selectedAgent.name === 'Nutri' && nutriActiveTab === 'plan' ? (
            <ScrollView 
              style={styles.chatMessagesContainer}
              contentContainerStyle={styles.mealPlanContent}
              showsVerticalScrollIndicator={false}
            >
              {isGeneratingPlan ? (
                <View style={styles.mealPlanLoading}>
                  <Ionicons name="restaurant" size={48} color={getAgentColor(selectedAgent.specialty)} />
                  <Text style={[styles.mealPlanLoadingText, { color: theme.colors.text.primary }]}>
                    Creating your personalized meal plan...
                  </Text>
                  <Text style={[styles.mealPlanLoadingSubtext, { color: theme.colors.text.secondary }]}>
                    Considering your health profile and goals
                  </Text>
                </View>
              ) : mealPlan ? (
                <View style={styles.mealPlanContainer}>
                  <View style={[styles.mealPlanHeader, { backgroundColor: getAgentColor(selectedAgent.specialty) + '15' }]}>
                    <View style={styles.mealPlanHeaderContent}>
                      <View style={[styles.mealPlanIconBadge, { backgroundColor: getAgentColor(selectedAgent.specialty) }]}>
                        <Ionicons name="calendar" size={16} color="white" />
                      </View>
                      <View>
                        <Text style={[styles.mealPlanTitle, { color: theme.colors.text.primary }]}>
                          {mealPlan.day}'s Meal Plan
                        </Text>
                        <Text style={[styles.mealPlanSubtitle, { color: theme.colors.text.secondary }]}>
                          {isSavingMealPlan ? '💾 Saving...' : 'Personalized for your health goals'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.refreshPlanButton, { backgroundColor: getAgentColor(selectedAgent.specialty) + '30' }]}
                      onPress={generateMealPlan}
                      disabled={isGeneratingPlan}
                    >
                      <Ionicons name="refresh" size={16} color={getAgentColor(selectedAgent.specialty)} />
                    </TouchableOpacity>
                  </View>
                  {/* Structured Meal Plan with Interactive Items */}
                  {structuredMealPlan ? (
                    <View style={styles.structuredMealPlan}>
                      {/* Total Day Summary */}
                      <View style={[styles.dayCalorieSummary, { backgroundColor: getAgentColor(selectedAgent.specialty) + '10' }]}>
                        <Text style={[styles.dayCalorieText, { color: theme.colors.text.primary }]}>
                          Daily Total: {structuredMealPlan.totalDayCalories} calories
                        </Text>
                      </View>
                      
                      {/* Meal Periods */}
                      {structuredMealPlan.meals.map((meal, mealIdx) => (
                        <View key={meal.period} style={styles.mealPeriodSection}>
                          {/* Meal Period Header */}
                          <View style={styles.mealPeriodHeader}>
                            <View style={styles.mealPeriodTitleRow}>
                              <Ionicons 
                                name={meal.period === 'breakfast' ? 'sunny-outline' : 
                                      meal.period === 'lunch' ? 'partly-sunny-outline' : 
                                      meal.period === 'dinner' ? 'moon-outline' : 'cafe-outline'} 
                                size={18} 
                                color={getAgentColor(selectedAgent.specialty)} 
                              />
                              <Text style={[styles.mealPeriodTitle, { color: theme.colors.text.primary }]}>
                                {meal.period.charAt(0).toUpperCase() + meal.period.slice(1)}
                              </Text>
                            </View>
                            <Text style={[styles.mealPeriodCalories, { color: theme.colors.text.secondary }]}>
                              {meal.totalCalories} cal
                            </Text>
                          </View>
                          
                          {/* Food Items */}
                          <View style={styles.foodItemsContainer}>
                            {meal.items.map((item, itemIdx) => (
                              <TouchableOpacity
                                key={item.id}
                                style={[styles.foodItemButton, { borderColor: getAgentColor(selectedAgent.specialty) + '30' }]}
                                onPress={() => {
                                  setSelectedFoodItem(item);
                                  setFoodDetailModalVisible(true);
                                }}
                              >
                                <View style={styles.foodItemMain}>
                                  <Text style={[styles.foodItemName, { color: theme.colors.text.primary }]} numberOfLines={1}>
                                    {item.name}
                                  </Text>
                                  <Text style={[styles.foodItemCalories, { color: getAgentColor(selectedAgent.specialty) }]}>
                                    {item.calories} cal
                                  </Text>
                                </View>
                                <View style={styles.foodItemMeta}>
                                  <Text style={[styles.foodItemHall, { color: theme.colors.text.tertiary }]} numberOfLines={1}>
                                    📍 {item.diningHall}
                                  </Text>
                                  {item.dietaryTags && item.dietaryTags.length > 0 && (
                                    <View style={styles.foodItemTags}>
                                      {item.dietaryTags.slice(0, 2).map((tag, tagIdx) => (
                                        <View key={tagIdx} style={[styles.foodItemTag, { backgroundColor: getAgentColor(selectedAgent.specialty) + '15' }]}>
                                          <Text style={[styles.foodItemTagText, { color: getAgentColor(selectedAgent.specialty) }]}>
                                            {tag === 'vegan' ? '🌱' : tag === 'vegetarian' ? '🥬' : tag === 'contains_nuts' ? '🥜' : tag === 'gluten_free' ? '🌾' : ''}
                                          </Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={theme.colors.text.disabled} style={styles.foodItemChevron} />
                              </TouchableOpacity>
                            ))}
                            
                            {/* Edit This Meal Button */}
                            <TouchableOpacity
                              style={[styles.editMealButton, { borderColor: getAgentColor(selectedAgent.specialty) + '50' }]}
                              onPress={() => {
                                setNutriActiveTab('chat');
                                setChatMessages([]);
                                setTimeout(() => {
                                  sendMessageToAgent(`Change my ${meal.period} to something different. Keep other meals the same. Return in JSON format.`, selectedAgent);
                                }, 100);
                              }}
                            >
                              <Ionicons name="swap-horizontal-outline" size={14} color={getAgentColor(selectedAgent.specialty)} />
                              <Text style={[styles.editMealButtonText, { color: getAgentColor(selectedAgent.specialty) }]}>
                                Change {meal.period}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.mealPlanBody}>
                      <Text style={[styles.mealPlanText, { color: theme.colors.text.primary }]}>
                        {mealPlan.content}
                      </Text>
                    </View>
                  )}
                  
                  {/* Quick Edit Options */}
                  <View style={styles.quickEditContainer}>
                    <Text style={[styles.quickEditLabel, { color: theme.colors.text.tertiary }]}>
                      Quick edits:
                    </Text>
                    <View style={styles.quickEditOptions}>
                      {[
                        { label: '🥗 Vegetarian', prompt: 'Make my entire meal plan vegetarian. Return updated JSON.' },
                        { label: '🌱 Vegan', prompt: 'Make my entire meal plan vegan. Return updated JSON.' },
                        { label: '💪 More protein', prompt: 'Increase protein in all meals. Return updated JSON.' },
                        { label: '🔥 Lower cal', prompt: 'Lower calories in all meals. Return updated JSON.' },
                      ].map((option, idx) => (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.quickEditChip, { borderColor: getAgentColor(selectedAgent.specialty) + '40' }]}
                          onPress={() => {
                            setNutriActiveTab('chat');
                            setChatMessages([]);
                            setTimeout(() => {
                              sendMessageToAgent(option.prompt, selectedAgent);
                            }, 100);
                          }}
                        >
                          <Text style={[styles.quickEditChipText, { color: theme.colors.text.primary }]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.mealPlanEmpty}>
                  <Ionicons name="restaurant-outline" size={48} color={theme.colors.text.disabled} />
                  <Text style={[styles.mealPlanEmptyText, { color: theme.colors.text.secondary }]}>
                    No meal plan generated yet
                  </Text>
                  <TouchableOpacity
                    style={[styles.generatePlanButton, { backgroundColor: getAgentColor(selectedAgent.specialty) }]}
                    onPress={generateMealPlan}
                    disabled={isGeneratingPlan}
                  >
                    <Ionicons name="sparkles" size={18} color="white" />
                    <Text style={styles.generatePlanButtonText}>Generate Meal Plan</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          ) : (
            <>
              {/* Chat Messages */}
              <ScrollView 
                ref={chatScrollRef}
                style={styles.chatMessagesContainer}
                contentContainerStyle={styles.chatMessagesContent}
                showsVerticalScrollIndicator={false}
              >
                {chatMessages.length === 0 && (
                  <View style={styles.chatEmptyState}>
                    <Ionicons name="chatbubble-ellipses-outline" size={40} color={theme.colors.text.disabled} />
                    <Text style={[styles.chatEmptyText, { color: theme.colors.text.secondary }]}>
                      Ask {getAgentDisplayName(selectedAgent)} anything about your health!
                    </Text>
                    {/* Nutri-specific suggestions for meal plan modifications */}
                    {selectedAgent?.name === 'Nutri' && mealPlan && (
                      <View style={styles.suggestionContainer}>
                        <Text style={[styles.suggestionLabel, { color: theme.colors.text.tertiary }]}>
                          Try asking:
                        </Text>
                        <View style={styles.suggestionChips}>
                          {[
                            'Make breakfast higher protein',
                            'Swap lunch for something vegetarian',
                            'Lower the calories for dinner',
                            'Add a healthy snack option',
                          ].map((suggestion, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={[styles.suggestionChip, { backgroundColor: getAgentColor(selectedAgent.specialty) + '15', borderColor: getAgentColor(selectedAgent.specialty) + '30' }]}
                              onPress={() => {
                                setChatInput(suggestion);
                              }}
                            >
                              <Text style={[styles.suggestionChipText, { color: getAgentColor(selectedAgent.specialty) }]}>
                                {suggestion}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}
                {chatMessages.map(msg => (
                  <View 
                    key={msg.id} 
                    style={[
                      styles.chatMessageRow,
                      msg.isUser ? styles.chatMessageUser : styles.chatMessageAgent
                    ]}
                  >
                    <View style={[
                      styles.chatBubble,
                      {
                        backgroundColor: msg.isUser 
                          ? getAgentColor(selectedAgent.specialty) 
                          : theme.colors.surface,
                        borderColor: msg.isUser ? 'transparent' : theme.colors.border.light,
                      }
                    ]}>
                      <Text style={[
                        styles.chatBubbleText,
                        { color: msg.isUser ? 'white' : theme.colors.text.primary }
                      ]}>
                        {msg.content}
                      </Text>
                    </View>
                  </View>
                ))}
                {isSending && (
                  <View style={[styles.chatMessageRow, styles.chatMessageAgent]}>
                    <View style={[styles.chatBubble, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light }]}>
                      <Text style={[styles.chatBubbleText, { color: theme.colors.text.secondary }]}>
                        Thinking...
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Chat Input */}
              <View style={[styles.chatInputContainer, { borderTopColor: theme.colors.border.light }]}>
                <TextInput
                  style={[
                    styles.chatInput,
                    { 
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.text.primary,
                      borderColor: theme.colors.border.medium,
                    }
                  ]}
                  placeholder={`Ask ${getAgentDisplayName(selectedAgent)}...`}
                  placeholderTextColor={theme.colors.text.disabled}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                  editable={!isSending}
                />
                <TouchableOpacity
                  style={[
                    styles.chatSendButton,
                    { 
                      backgroundColor: getAgentColor(selectedAgent.specialty),
                      opacity: isSending || !chatInput.trim() ? 0.5 : 1,
                    }
                  ]}
                  onPress={handleSendChat}
                  disabled={isSending || !chatInput.trim()}
                >
                  <Ionicons name="send" size={18} color="white" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      )}
    </Animated.View>
  );

  // Agent FAB Menu (Bottom Right)
  const renderAgentFAB = () => (
    <View style={styles.agentFabContainer}>
      {/* Agent Selection Buttons (shown when menu is open) */}
      {showAgentMenu && !agentPanelOpen && (
        <View style={styles.agentFabMenu}>
          {AI_AGENTS.map((agent, index) => (
            <TouchableOpacity
              key={agent.id}
              style={[
                styles.agentFabItem,
                { backgroundColor: getAgentColor(agent.specialty) }
              ]}
              onPress={() => handleSelectAgent(agent)}
            >
              <Ionicons name={getAgentIcon(agent.specialty) as any} size={20} color="white" />
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {/* Main FAB */}
      {!agentPanelOpen && (
        <TouchableOpacity
          style={[styles.agentFab, { backgroundColor: theme.colors.primary }]}
          onPress={() => setShowAgentMenu(!showAgentMenu)}
        >
          <Ionicons 
            name={showAgentMenu ? 'close' : 'chatbubbles'} 
            size={24} 
            color="white" 
          />
        </TouchableOpacity>
      )}
    </View>
  );

  if (isLoading || !user?.id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={48} color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
            {!user?.id ? 'Loading...' : 'Creating your personalized weekly plan...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {showConfetti && (
        <ConfettiCannon
          key={confettiKey}
          count={80}
          origin={{ x: screenWidth / 2, y: 100 }}
          fadeOut
          explosionSpeed={400}
          fallSpeed={2500}
          colors={[theme.colors.primary, '#F97316', theme.colors.semantic.success, '#E11D48', '#7C3AED']}
          autoStart
        />
      )}
      
      {renderHeader()}
      {renderDaySelector()}
      
      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: agentPanelOpen ? 20 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {renderTabSelector()}
        {renderWeeklyOverview()}
        
        {activeTab === 'daily' ? renderDailyTasks() : renderWeeklyGoals()}

        {/* Completion celebration */}
        {activeTab === 'daily' && dailyPercentage === 100 && currentDayTasks.length > 0 && (
          <Card style={styles.celebrationCard} variant="elevated">
            <View style={styles.celebrationContent}>
              <Text style={styles.celebrationEmoji}>🎉</Text>
              <Text style={[styles.celebrationTitle, { color: theme.colors.text.primary }]}>
                {selectedDay === today ? 'Perfect Day!' : `${FULL_DAYS[selectedDay]} Complete!`}
              </Text>
              <Text style={[styles.celebrationText, { color: theme.colors.text.secondary }]}>
                All tasks completed for {FULL_DAYS[selectedDay]}!
              </Text>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Agent FAB and Panel */}
      {renderAgentFAB()}
      {renderAgentPanel()}
      
      {/* Food Detail Modal */}
      <Modal
        visible={foodDetailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFoodDetailModalVisible(false)}
      >
        <View style={styles.foodModalOverlay}>
          <View style={[styles.foodModalContent, { backgroundColor: theme.colors.background }]}>
            {selectedFoodItem && (
              <>
                <View style={styles.foodModalHeader}>
                  <Text style={[styles.foodModalTitle, { color: theme.colors.text.primary }]}>
                    {selectedFoodItem.name}
                  </Text>
                  <TouchableOpacity onPress={() => setFoodDetailModalVisible(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.foodModalBody}>
                  <View style={[styles.foodModalInfoRow, { borderBottomColor: theme.colors.border.light }]}>
                    <Text style={[styles.foodModalLabel, { color: theme.colors.text.secondary }]}>Dining Hall</Text>
                    <Text style={[styles.foodModalValue, { color: theme.colors.text.primary }]}>{selectedFoodItem.diningHall}</Text>
                  </View>
                  <View style={[styles.foodModalInfoRow, { borderBottomColor: theme.colors.border.light }]}>
                    <Text style={[styles.foodModalLabel, { color: theme.colors.text.secondary }]}>Serving Size</Text>
                    <Text style={[styles.foodModalValue, { color: theme.colors.text.primary }]}>{selectedFoodItem.servingSize}</Text>
                  </View>
                  
                  <Text style={[styles.foodModalSectionTitle, { color: theme.colors.text.primary }]}>Nutrition Facts</Text>
                  
                  <View style={styles.nutritionGrid}>
                    <View style={[styles.nutritionItem, { backgroundColor: '#F97316' + '15' }]}>
                      <Text style={[styles.nutritionValue, { color: '#F97316' }]}>{selectedFoodItem.calories}</Text>
                      <Text style={[styles.nutritionLabel, { color: theme.colors.text.secondary }]}>Calories</Text>
                    </View>
                    <View style={[styles.nutritionItem, { backgroundColor: '#059669' + '15' }]}>
                      <Text style={[styles.nutritionValue, { color: '#059669' }]}>{selectedFoodItem.protein || 0}g</Text>
                      <Text style={[styles.nutritionLabel, { color: theme.colors.text.secondary }]}>Protein</Text>
                    </View>
                    <View style={[styles.nutritionItem, { backgroundColor: '#6366F1' + '15' }]}>
                      <Text style={[styles.nutritionValue, { color: '#6366F1' }]}>{selectedFoodItem.carbs || 0}g</Text>
                      <Text style={[styles.nutritionLabel, { color: theme.colors.text.secondary }]}>Carbs</Text>
                    </View>
                    <View style={[styles.nutritionItem, { backgroundColor: '#E11D48' + '15' }]}>
                      <Text style={[styles.nutritionValue, { color: '#E11D48' }]}>{selectedFoodItem.fat || 0}g</Text>
                      <Text style={[styles.nutritionLabel, { color: theme.colors.text.secondary }]}>Fat</Text>
                    </View>
                  </View>
                  
                  {selectedFoodItem.dietaryTags && selectedFoodItem.dietaryTags.length > 0 && (
                    <>
                      <Text style={[styles.foodModalSectionTitle, { color: theme.colors.text.primary }]}>Dietary Info</Text>
                      <View style={styles.dietaryTagsRow}>
                        {selectedFoodItem.dietaryTags.map((tag, idx) => (
                          <View key={idx} style={[styles.dietaryTag, { backgroundColor: '#0D9488' + '15' }]}>
                            <Text style={[styles.dietaryTagText, { color: '#0D9488' }]}>
                              {tag.replace(/_/g, ' ').charAt(0).toUpperCase() + tag.replace(/_/g, ' ').slice(1)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>
                
                <TouchableOpacity
                  style={[styles.swapFoodButton, { backgroundColor: '#F97316' }]}
                  onPress={() => {
                    setFoodDetailModalVisible(false);
                    setNutriActiveTab('chat');
                    setChatMessages([]);
                    setTimeout(() => {
                      sendMessageToAgent(`Replace "${selectedFoodItem.name}" with a different option. Keep other items the same. Return updated JSON.`, selectedAgent!);
                    }, 100);
                  }}
                >
                  <Ionicons name="swap-horizontal" size={18} color="white" />
                  <Text style={styles.swapFoodButtonText}>Swap This Item</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 16, textAlign: 'center', paddingHorizontal: 24 },
  
  // Day selector
  daySelectorContainer: { paddingVertical: 8 },
  daySelector: { paddingHorizontal: 16, gap: 8 },
  dayButton: {
    width: 56,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    paddingVertical: 8,
  },
  dayLabel: { fontSize: 11, fontWeight: '500', marginBottom: 2 },
  dayNumber: { fontSize: 18, fontWeight: '700' },
  completionDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  todayLabel: { fontSize: 9, fontWeight: '600', marginTop: 2 },
  
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  
  // Overview card
  overviewCard: { marginHorizontal: 24, marginTop: 16, padding: 20 },
  overviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  overviewTitle: { fontSize: 18, fontWeight: '700' },
  overviewSubtitle: { fontSize: 13, marginTop: 4 },
  percentageCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: { fontSize: 16, fontWeight: '700' },
  progressBarContainer: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBarBg: { position: 'absolute', width: '100%', height: '100%', borderRadius: 4 },
  progressBarFill: { height: '100%', borderRadius: 4, minWidth: 8 },
  
  // Section
  section: { paddingHorizontal: 24, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  
  // Task cards
  taskCard: { marginBottom: 10, padding: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'flex-start' },
  checkbox: { borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
  taskContent: { flex: 1 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  taskTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  taskTitle: { fontSize: 15, fontWeight: '500', flex: 1 },
  taskTime: { fontSize: 12, marginLeft: 8 },
  taskDescription: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  
  // Explain button
  explainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  explainButtonText: { fontSize: 12, fontWeight: '500' },
  
  // Weekly goals
  weeklyGoalCard: { marginBottom: 12, padding: 16 },
  weeklyGoalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  goalIconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  goalInfo: { flex: 1 },
  goalTitle: { fontSize: 15, fontWeight: '600' },
  goalDescription: { fontSize: 12, marginTop: 2 },
  goalProgressSection: { marginBottom: 12 },
  goalProgressBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  goalProgressBg: { position: 'absolute', width: '100%', height: '100%' },
  goalProgressFill: { height: '100%', borderRadius: 3 },
  goalProgressText: { fontSize: 12, textAlign: 'right' },
  goalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  goalDays: { flexDirection: 'row', gap: 6 },
  goalDayDot: { width: 10, height: 10, borderRadius: 5 },
  
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, marginTop: 12 },
  refreshTasksButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  refreshTasksText: { color: 'white', fontWeight: '600' },
  
  // Celebration
  celebrationCard: { marginHorizontal: 24, marginTop: 24, marginBottom: 24, padding: 24 },
  celebrationContent: { alignItems: 'center' },
  celebrationEmoji: { fontSize: 48 },
  celebrationTitle: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  celebrationText: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  
  // Agent FAB
  agentFabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    alignItems: 'center',
  },
  agentFabMenu: {
    marginBottom: 12,
    gap: 10,
  },
  agentFabItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  agentFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  
  // Agent Panel
  agentPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  agentPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  agentPanelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  agentPanelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  agentPanelTitle: { fontSize: 16, fontWeight: '700' },
  agentPanelSubtitle: { fontSize: 12, marginTop: 2 },
  switchAgentButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeAgentButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Agent Menu Dropdown
  agentMenuDropdown: {
    position: 'absolute',
    top: 70,
    right: 16,
    width: 180,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  agentMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  agentMenuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentMenuText: { flex: 1, fontSize: 14, fontWeight: '500' },
  
  // Chat
  chatMessagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatMessagesContent: {
    paddingVertical: 16,
  },
  chatEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  chatEmptyText: { fontSize: 14, textAlign: 'center' },
  chatMessageRow: {
    marginBottom: 12,
  },
  chatMessageUser: {
    alignItems: 'flex-end',
  },
  chatMessageAgent: {
    alignItems: 'flex-start',
  },
  chatBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Nutri Tabs
  nutriTabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  nutriTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  nutriTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Meal Plan
  mealPlanContent: {
    padding: 16,
    paddingBottom: 40,
  },
  mealPlanContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  mealPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  mealPlanHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mealPlanIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mealPlanTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  mealPlanSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  mealPlanHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editPlanHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 4,
  },
  editPlanHeaderButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  refreshPlanButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealPlanBody: {
    padding: 4,
  },
  mealPlanText: {
    fontSize: 14,
    lineHeight: 22,
  },
  mealPlanLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  mealPlanLoadingText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  mealPlanLoadingSubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  mealPlanEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  mealPlanEmptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  generatePlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  generatePlanButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Suggestion chips for Nutri chat
  suggestionContainer: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 8,
  },
  suggestionLabel: {
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Edit meal plan button
  editMealPlanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  editMealPlanButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Quick edit options
  quickEditContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  quickEditLabel: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickEditOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  quickEditChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  quickEditChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  
  // Structured Meal Plan
  structuredMealPlan: {
    gap: 16,
  },
  dayCalorieSummary: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  dayCalorieText: {
    fontSize: 15,
    fontWeight: '600',
  },
  mealPeriodSection: {
    marginBottom: 8,
  },
  mealPeriodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  mealPeriodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealPeriodTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  mealPeriodCalories: {
    fontSize: 13,
    fontWeight: '500',
  },
  foodItemsContainer: {
    gap: 8,
  },
  foodItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  foodItemMain: {
    flex: 1,
  },
  foodItemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  foodItemCalories: {
    fontSize: 13,
    fontWeight: '700',
  },
  foodItemMeta: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  foodItemHall: {
    fontSize: 11,
    marginBottom: 4,
  },
  foodItemTags: {
    flexDirection: 'row',
    gap: 4,
  },
  foodItemTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  foodItemTagText: {
    fontSize: 10,
  },
  foodItemChevron: {
    marginLeft: 4,
  },
  editMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    marginTop: 4,
  },
  editMealButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Food Detail Modal
  foodModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  foodModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  foodModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  foodModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginRight: 16,
  },
  foodModalBody: {
    gap: 12,
  },
  foodModalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  foodModalLabel: {
    fontSize: 14,
  },
  foodModalValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  foodModalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  nutritionItem: {
    width: '47%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  nutritionLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  dietaryTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dietaryTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dietaryTagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  swapFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
  },
  swapFoodButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
});
