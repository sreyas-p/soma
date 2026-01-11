import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  ComprehensiveOnboardingData,
  MedicalCondition,
  Medication,
  Allergy,
  Surgery,
  HealthGoal,
  FamilyMedicalHistory,
  CareTeamMember,
  LifestyleFactors,
  getInitialOnboardingData,
  generateId,
  CONDITION_OPTIONS,
  MedicalConditionCategory,
  COMMON_MEDICATIONS,
  COMMON_ALLERGIES,
  AllergyType,
  COMMON_SURGERIES,
  SurgeryType,
  GOAL_TEMPLATES,
  HealthGoalCategory,
  EXERCISE_TYPES,
  SLEEP_ISSUES,
  STRESS_SOURCES,
  COPING_MECHANISMS,
  FAMILY_HISTORY_CONDITIONS,
  OnboardingDataSource,
  GOAL_MOTIVATIONS,
  GOAL_CHALLENGES,
} from '@/types/onboarding';
import { parseEHRData, ehrToOnboardingData, ParsedEHRData } from '@/services/ehrParser';

// ============= STEP DEFINITIONS =============
interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  isConditional?: boolean;
  showIf?: (data: Partial<ComprehensiveOnboardingData>) => boolean;
}

const STEPS: OnboardingStep[] = [
  { id: 'welcome', title: 'Welcome to Soma', subtitle: "Let's set up your personalized health profile" },
  { id: 'data_source', title: 'How would you like to get started?', subtitle: 'Choose how to provide your health information' },
  { id: 'ehr_upload', title: 'Upload Your Health Records', subtitle: 'Import your EHR data to skip most questions', isConditional: true, showIf: (d) => d.dataSource === 'ehr_upload' },
  { id: 'ehr_review', title: 'Review Imported Data', subtitle: 'Verify the information from your records', isConditional: true, showIf: (d) => d.dataSource === 'ehr_upload' },
  { id: 'basic_info', title: "What's your name?", subtitle: 'We\'ll use this to personalize your experience', isConditional: true, showIf: (d) => d.dataSource === 'manual' || !d.basicInfo?.firstName },
  { id: 'demographics', title: 'Tell us about yourself', subtitle: 'This helps us provide relevant health insights', isConditional: true, showIf: (d) => d.dataSource === 'manual' || !d.basicInfo?.dateOfBirth },
  // Physical measurements are ALWAYS needed (this is recent data, even for EHR users)
  { id: 'physical', title: 'Current measurements', subtitle: 'Enter your current height and weight' },
  // Current medications are ALWAYS needed (recent data)
  { id: 'medications_check', title: 'Current Medications', subtitle: 'Are you currently taking any medications?' },
  { id: 'medications_detail', title: 'Your medications', subtitle: 'We\'ll help you stay on track', isConditional: true, showIf: (d) => d.takesMedications === true },
  // Manual entry only - historical data collection
  { id: 'conditions_check', title: 'Medical conditions', subtitle: 'Do you have any diagnosed medical conditions?', isConditional: true, showIf: (d) => d.dataSource === 'manual' },
  { id: 'conditions_detail', title: 'Your medical conditions', subtitle: 'Help us understand your health situation', isConditional: true, showIf: (d) => d.dataSource === 'manual' && d.hasMedicalConditions === true },
  { id: 'allergies_check', title: 'Allergies', subtitle: 'Do you have any known allergies?', isConditional: true, showIf: (d) => d.dataSource === 'manual' },
  { id: 'allergies_detail', title: 'Your allergies', subtitle: 'Important for your safety', isConditional: true, showIf: (d) => d.dataSource === 'manual' && d.hasAllergies === true },
  { id: 'surgery_check', title: 'Surgical history', subtitle: 'Have you had any surgeries or procedures?', isConditional: true, showIf: (d) => d.dataSource === 'manual' },
  { id: 'surgery_detail', title: 'Your surgical history', subtitle: 'This helps us understand your recovery needs', isConditional: true, showIf: (d) => d.dataSource === 'manual' && d.hasSurgicalHistory === true },
  { id: 'treatment_check', title: 'Current treatment', subtitle: 'Are you receiving any ongoing treatment or therapy?', isConditional: true, showIf: (d) => d.dataSource === 'manual' },
  { id: 'treatment_detail', title: 'Your current treatment', subtitle: 'Tell us about your care plan', isConditional: true, showIf: (d) => d.dataSource === 'manual' && d.isReceivingTreatment === true },
  { id: 'lifestyle', title: 'Lifestyle assessment', subtitle: 'Help us understand your daily habits', isConditional: true, showIf: (d) => d.dataSource === 'manual' },
  { id: 'family_history_check', title: 'Family history', subtitle: 'Does your family have any medical conditions?', isConditional: true, showIf: (d) => d.dataSource === 'manual' },
  { id: 'family_history_detail', title: 'Family medical history', subtitle: 'This helps identify potential risks', isConditional: true, showIf: (d) => d.dataSource === 'manual' && d.hasFamilyHistory === true },
  // Goals section - ALWAYS shown regardless of data source
  { id: 'goals_primary', title: 'Health focus', subtitle: 'What\'s your primary health priority?' },
  { id: 'goals_detail', title: 'Set your goals', subtitle: 'Define specific, measurable targets' },
  { id: 'goals_freeform', title: 'Your personal goals', subtitle: 'Tell us what you want to achieve in your own words' },
  { id: 'preferences', title: 'Your preferences', subtitle: 'Customize your Soma experience' },
  { id: 'complete', title: 'All set!', subtitle: 'Your personalized health journey awaits' },
];

// ============= MAIN COMPONENT =============
export const OnboardingScreen: React.FC = () => {
  const { theme } = useTheme();
  const { completeOnboarding, isOnboardingComplete, user, session, signOut } = useAuth();

  const handleCancelSignup = () => {
    console.log('🔴 Cancel signup button pressed');
    Alert.alert(
      'Cancel Sign Up?',
      'Are you sure you want to cancel? Your account will be removed and you\'ll need to sign up again.',
      [
        { text: 'Keep Going', style: 'cancel' },
        { 
          text: 'Cancel Sign Up', 
          style: 'destructive',
          onPress: async () => {
            console.log('🔴 User confirmed cancel - signing out...');
            try {
              await signOut();
              console.log('✅ Sign out successful');
            } catch (error) {
              console.error('❌ Error signing out:', error);
              // Force clear session even if signOut fails
              Alert.alert('Error', 'Could not cancel signup. Please try again.');
            }
          }
        },
      ],
      { cancelable: true }
    );
  };
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Partial<ComprehensiveOnboardingData>>(getInitialOnboardingData());
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<string>('');
  
  // EHR upload state
  const [ehrFile, setEhrFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [parsedEHR, setParsedEHR] = useState<ParsedEHRData | null>(null);
  const [isParsingEHR, setIsParsingEHR] = useState(false);
  const [ehrError, setEhrError] = useState<string | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteJsonText, setPasteJsonText] = useState('');
  
  // Free-form goals state
  const [freeFormGoals, setFreeFormGoals] = useState('');
  const [selectedMotivations, setSelectedMotivations] = useState<string[]>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);
  
  // Medication form state (moved to top level for hooks rules)
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFrequency, setNewMedFrequency] = useState<Medication['frequency']>('once_daily');
  
  // Animation values
  const [fadeAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(0));
  const [progressAnim] = useState(new Animated.Value(0));

  // Calculate visible steps based on conditional logic
  const visibleSteps = STEPS.filter(step => {
    if (!step.isConditional) return true;
    return step.showIf?.(formData) ?? true;
  });

  const currentStep = visibleSteps[currentStepIndex];
  const totalVisibleSteps = visibleSteps.length;
  const progressPercentage = ((currentStepIndex + 1) / totalVisibleSteps) * 100;

  useEffect(() => {
    if (isOnboardingComplete) {
      console.log('✅ Onboarding already complete');
    }
  }, [isOnboardingComplete]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progressPercentage,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progressPercentage]);

  const animateTransition = (direction: 'forward' | 'back', callback: () => void) => {
    const slideOut = direction === 'forward' ? -50 : 50;
    const slideIn = direction === 'forward' ? 50 : -50;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: slideOut, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      callback();
      slideAnim.setValue(slideIn);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleNext = async () => {
    if (currentStep.id === 'complete') {
      await handleComplete();
      return;
    }

    animateTransition('forward', () => {
      setCurrentStepIndex(prev => Math.min(prev + 1, totalVisibleSteps - 1));
    });
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      animateTransition('back', () => {
        setCurrentStepIndex(prev => prev - 1);
      });
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Build historical data from form data
      const historicalData = {
        geneticConditions: formData.historicalData?.geneticConditions || [],
        chronicDiseases: formData.medicalConditions?.map(c => ({
          name: c.name,
          diagnosedDate: c.diagnosisDate,
          status: c.status,
          category: c.category,
          severity: c.severity,
        })) || [],
        familyHistory: formData.familyHistory?.map(f => ({
          relationship: f.relationship,
          conditions: f.conditions,
          ageOfOnset: f.ageOfOnset,
        })) || [],
        allergies: formData.allergies?.map(a => ({
          allergen: a.allergen,
          type: a.type,
          severity: a.severity,
          reaction: a.reaction,
        })) || [],
        pastSurgeries: formData.surgeries?.map(s => ({
          name: s.name,
          date: s.date,
          hospital: s.hospital,
          outcome: s.currentStatus,
          type: s.type,
        })) || [],
        bloodType: formData.physicalMeasurements?.bloodType,
      };

      // Build recent data from form data
      const recentData = {
        measurements: {
          height: formData.physicalMeasurements?.height ? {
            value: formData.physicalMeasurements.height,
            unit: formData.physicalMeasurements.heightUnit || 'inches',
            recordedAt: new Date().toISOString(),
          } : undefined,
          weight: formData.physicalMeasurements?.weight ? {
            value: formData.physicalMeasurements.weight,
            unit: formData.physicalMeasurements.weightUnit || 'lbs',
            recordedAt: new Date().toISOString(),
          } : undefined,
        },
        vitals: formData.recentData?.vitals || {},
        currentMedications: formData.medications?.map(m => ({
          name: m.name,
          dosage: m.dosage,
          dosageUnit: m.dosageUnit,
          frequency: m.frequency,
          temporary: !m.isActive,
          startDate: m.startDate,
          purpose: m.purpose,
        })) || [],
        lifestyle: {
          activityLevel: formData.lifestyle?.activityLevel,
          sleepHours: formData.lifestyle?.averageSleepHours,
          sleepQuality: formData.lifestyle?.sleepQuality,
          stressLevel: formData.lifestyle?.stressLevel,
          smokingStatus: formData.lifestyle?.smokingStatus,
          alcoholFrequency: formData.lifestyle?.alcoholFrequency,
        },
      };

      // Build user goals data
      const userGoals = {
        primaryFocus: formData.primaryHealthFocus || 'fitness',
        goals: formData.healthGoals || [],
        motivations: selectedMotivations,
        challenges: selectedChallenges,
        freeFormGoals: freeFormGoals,
      };

      // Convert comprehensive data to the format expected by AuthContext
      const legacyData = {
        name: `${formData.basicInfo?.firstName || ''} ${formData.basicInfo?.lastName || ''}`.trim(),
        goals: [
          ...formData.healthGoals?.map(g => g.title) || [],
          freeFormGoals ? `Personal goals: ${freeFormGoals.substring(0, 100)}` : '',
        ].filter(Boolean).join(', ') || '',
        physicalTherapy: formData.currentTreatment?.description || '',
        age: calculateAge(formData.basicInfo?.dateOfBirth),
        gender: mapSexToGender(formData.basicInfo?.biologicalSex),
        weight: formData.physicalMeasurements?.weight || 0,
        height: formData.physicalMeasurements?.height || 0,
        // Store full comprehensive data as JSON
        comprehensiveData: {
          ...formData,
          historicalData,
          recentData,
          userGoals,
          dataSource: formData.dataSource || 'manual',
        },
      };

      const result = await completeOnboarding(legacyData as any);
      
      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to complete setup. Please try again.');
        return;
      }

      Alert.alert(
        '🎉 Welcome to Soma!',
        'Your personalized health profile has been created.',
        [{ text: 'Get Started', onPress: () => console.log('Starting...') }]
      );
    } catch (error) {
      console.error('Error completing onboarding:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateAge = (dob?: string): number => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const mapSexToGender = (sex?: string): 'male' | 'female' | 'other' | 'prefer_not_to_say' => {
    if (sex === 'male') return 'male';
    if (sex === 'female') return 'female';
    return 'other';
  };

  const updateFormData = useCallback((updates: Partial<ComprehensiveOnboardingData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  // EHR file picker handler - JSON format only
  const handlePickEHRFile = async () => {
    try {
      setEhrError(null);
      
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      console.log('Document picker result:', JSON.stringify(result, null, 2));

      if (result.canceled) {
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        setEhrError('No file was selected. Please try again.');
        return;
      }

      setEhrFile(result);
      setIsParsingEHR(true);

      const asset = result.assets[0];
      console.log('Selected file:', asset.name, 'URI:', asset.uri, 'Size:', asset.size);
      
      let fileContent: string | null = null;
      
      // First, try to copy the file to our document directory
      const fileName = asset.name || 'ehr-upload.json';
      const destUri = FileSystem.documentDirectory + fileName;
      
      try {
        // Copy file to app's document directory where we have full access
        console.log('Copying file to:', destUri);
        await FileSystem.copyAsync({
          from: asset.uri,
          to: destUri,
        });
        console.log('File copied successfully');
        
        // Now read from our local copy
        fileContent = await FileSystem.readAsStringAsync(destUri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        console.log('Successfully read file, length:', fileContent.length);
        
        // Clean up the copied file
        await FileSystem.deleteAsync(destUri, { idempotent: true });
      } catch (copyError: any) {
        console.log('Copy approach failed:', copyError?.message);
        
        // Fallback: try reading directly with different URI formats
        const urisToTry = [
          asset.uri,
          decodeURIComponent(asset.uri),
          asset.uri.replace('file://', ''),
        ];
        
        for (const uri of urisToTry) {
          try {
            console.log('Trying direct read from:', uri);
            fileContent = await FileSystem.readAsStringAsync(uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            console.log('Successfully read file, length:', fileContent.length);
            break;
          } catch (readError: any) {
            console.log('Failed to read from', uri, ':', readError?.message);
          }
        }
      }
      
      if (!fileContent) {
        setEhrError('Could not access the selected file. Please ensure the file is stored locally on your device (not in iCloud) and try again.');
        return;
      }
      
      try {
        const ehrJson = JSON.parse(fileContent);
        const parsed = parseEHRData(ehrJson);

        if (parsed) {
          applyParsedEHRData(parsed);
        } else {
          setEhrError('Unable to parse the EHR file. Please ensure it matches the expected JSON format with patient demographics and medical history.');
        }
      } catch (parseError) {
        console.error('EHR parse error:', parseError);
        setEhrError('Invalid JSON format. Please upload a valid EHR JSON file.');
      }
    } catch (error: any) {
      console.error('Document picker error:', error);
      const errorMessage = error?.message || String(error);
      setEhrError(`Failed to read the file: ${errorMessage}`);
    } finally {
      setIsParsingEHR(false);
    }
  };

  // Handle pasted JSON content
  const handlePasteJson = () => {
    if (!pasteJsonText.trim()) {
      setEhrError('Please paste your JSON content first.');
      return;
    }

    setIsParsingEHR(true);
    setEhrError(null);

    try {
      const ehrJson = JSON.parse(pasteJsonText);
      const parsed = parseEHRData(ehrJson);

      if (parsed) {
        applyParsedEHRData(parsed);
        setShowPasteModal(false);
        setPasteJsonText('');
      } else {
        setEhrError('Unable to parse the JSON. Please ensure it matches the expected EHR format.');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      setEhrError('Invalid JSON format. Please check your JSON and try again.');
    } finally {
      setIsParsingEHR(false);
    }
  };

  // Apply parsed EHR data to form
  const applyParsedEHRData = (parsed: ParsedEHRData) => {
    setParsedEHR(parsed);
    
    // Convert parsed EHR to form data
    const convertedData = ehrToOnboardingData(parsed);
    
    // Update form data with EHR data
    // Historical data: conditions, surgeries, allergies, family history
    // Recent data: current medications, vitals, measurements
    updateFormData({
      dataSource: 'ehr_upload',
      basicInfo: {
        ...formData.basicInfo!,
        firstName: convertedData.basicInfo.firstName || formData.basicInfo?.firstName || '',
        lastName: convertedData.basicInfo.lastName || formData.basicInfo?.lastName || '',
        dateOfBirth: convertedData.basicInfo.dateOfBirth || formData.basicInfo?.dateOfBirth || '',
        biologicalSex: convertedData.basicInfo.biologicalSex || formData.basicInfo?.biologicalSex || 'male',
      },
      // Physical measurements from EHR (recent data)
      physicalMeasurements: {
        ...formData.physicalMeasurements!,
        height: convertedData.physicalMeasurements.height || 0,
        heightUnit: convertedData.physicalMeasurements.heightUnit || 'cm',
        weight: convertedData.physicalMeasurements.weight || 0,
        weightUnit: convertedData.physicalMeasurements.weightUnit || 'kg',
        bloodType: convertedData.physicalMeasurements.bloodType || 'unknown',
      },
      // Medical conditions from EHR (historical data)
      hasMedicalConditions: convertedData.medicalConditions.length > 0,
      medicalConditions: convertedData.medicalConditions,
      // Current medications from EHR (recent data)
      takesMedications: convertedData.medications.length > 0,
      medications: convertedData.medications,
      // Allergies from EHR (historical data)
      hasAllergies: convertedData.allergies.length > 0,
      allergies: convertedData.allergies,
      // Surgeries from EHR (historical data)
      hasSurgicalHistory: convertedData.surgeries.length > 0,
      surgeries: convertedData.surgeries,
      // Family history from EHR (historical data)
      familyHistory: convertedData.familyHistory,
      hasFamilyHistory: convertedData.familyHistory.length > 0,
      // Lifestyle from EHR (recent data)
      lifestyle: {
        ...formData.lifestyle,
        ...convertedData.lifestyle,
      },
      // Store structured data
      historicalData: parsed.historicalData,
      recentData: parsed.recentData,
    });

    const conditionCount = convertedData.medicalConditions.length;
    const medicationCount = convertedData.medications.length;
    Alert.alert(
      '✅ Health Records Imported',
      `Successfully imported data for ${parsed.demographics.firstName} ${parsed.demographics.lastName}.\n\n` +
      `📋 Historical Data:\n` +
      `• ${conditionCount} medical condition(s)\n` +
      `• ${convertedData.allergies.length} allergy(ies)\n` +
      `• ${convertedData.surgeries.length} surgery(ies)\n` +
      `• ${convertedData.familyHistory.length} family history record(s)\n\n` +
      `📊 Recent Data:\n` +
      `• ${medicationCount} current medication(s)\n` +
      `• Latest vitals imported\n` +
      `• Lifestyle information imported`,
      [{ text: 'Continue', onPress: () => {} }]
    );
  };

  const isStepValid = (): boolean => {
    switch (currentStep.id) {
      case 'welcome':
        return true;
      case 'data_source':
        return !!formData.dataSource;
      case 'ehr_upload':
        return parsedEHR !== null || formData.dataSource === 'manual';
      case 'ehr_review':
        return !!(formData.basicInfo?.firstName && formData.basicInfo?.lastName);
      case 'basic_info':
        return !!(formData.basicInfo?.firstName && formData.basicInfo?.lastName);
      case 'demographics':
        return !!(formData.basicInfo?.dateOfBirth && formData.basicInfo?.biologicalSex);
      case 'physical':
        return !!(formData.physicalMeasurements?.height && formData.physicalMeasurements?.weight);
      case 'conditions_check':
      case 'medications_check':
      case 'allergies_check':
      case 'surgery_check':
      case 'treatment_check':
      case 'family_history_check':
        return true;
      case 'conditions_detail':
        return (formData.medicalConditions?.length || 0) > 0;
      case 'medications_detail':
        return (formData.medications?.length || 0) > 0;
      case 'allergies_detail':
        return (formData.allergies?.length || 0) > 0;
      case 'surgery_detail':
        return (formData.surgeries?.length || 0) > 0;
      case 'treatment_detail':
        return !!(formData.currentTreatment?.type && formData.currentTreatment?.description);
      case 'goals_primary':
        return !!formData.primaryHealthFocus;
      case 'goals_detail':
        return (formData.healthGoals?.length || 0) > 0;
      case 'goals_freeform':
        // Free-form goals are optional but motivations should have at least one selection
        return selectedMotivations.length > 0 || freeFormGoals.trim().length > 0;
      case 'lifestyle':
        return !!(formData.lifestyle?.activityLevel && formData.lifestyle?.sleepQuality);
      case 'family_history_detail':
        return (formData.familyHistory?.length || 0) > 0;
      case 'preferences':
      case 'complete':
        return true;
      default:
        return true;
    }
  };

  // ============= STEP RENDERERS =============

  const renderWelcomeStep = () => (
    <View style={styles.welcomeContainer}>
      <View style={[styles.welcomeIcon, { backgroundColor: theme.colors.primary }]}>
        <Ionicons name="heart" size={64} color="white" />
      </View>
      <Text style={[styles.welcomeTitle, { color: theme.colors.text.primary }]}>
        Your Health, Your Way
      </Text>
      <Text style={[styles.welcomeDescription, { color: theme.colors.text.secondary }]}>
        We'll ask you some questions to create a personalized health profile. This helps us provide tailored recommendations, track your progress, and keep you on track with your goals.
      </Text>
      <View style={styles.featureList}>
        {[
          { icon: 'medical', text: 'Track conditions & medications' },
          { icon: 'fitness', text: 'Set measurable health goals' },
          { icon: 'analytics', text: 'Get personalized insights' },
          { icon: 'shield-checkmark', text: 'Your data stays private' },
        ].map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name={feature.icon as any} size={24} color={theme.colors.primary} />
            <Text style={[styles.featureText, { color: theme.colors.text.primary }]}>{feature.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderDataSourceStep = () => (
    <View style={styles.dataSourceContainer}>
      <Text style={[styles.dataSourceDescription, { color: theme.colors.text.secondary }]}>
        You can either upload your existing health records (EHR) to automatically fill in your information, or enter everything manually.
      </Text>
      
      {/* EHR Upload Option */}
      <TouchableOpacity
        style={[
          styles.dataSourceOption,
          {
            backgroundColor: formData.dataSource === 'ehr_upload' ? theme.colors.primaryLight : theme.colors.surface,
            borderColor: formData.dataSource === 'ehr_upload' ? theme.colors.primary : theme.colors.border.light,
          }
        ]}
        onPress={() => updateFormData({ dataSource: 'ehr_upload' })}
      >
        <View style={[styles.dataSourceIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
          <Ionicons name="cloud-upload" size={40} color={theme.colors.primary} />
        </View>
        <View style={styles.dataSourceContent}>
          <Text style={[styles.dataSourceTitle, { color: theme.colors.text.primary }]}>
            Upload EHR Data
          </Text>
          <Text style={[styles.dataSourceSubtitle, { color: theme.colors.text.secondary }]}>
            Import from your doctor's records
          </Text>
          <View style={styles.dataSourceBadge}>
            <Ionicons name="flash" size={14} color={theme.colors.semantic.success} />
            <Text style={[styles.dataSourceBadgeText, { color: theme.colors.semantic.success }]}>
              Fastest option - Skip most questions
            </Text>
          </View>
        </View>
        {formData.dataSource === 'ehr_upload' && (
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
        )}
      </TouchableOpacity>

      {/* Manual Entry Option */}
      <TouchableOpacity
        style={[
          styles.dataSourceOption,
          {
            backgroundColor: formData.dataSource === 'manual' ? theme.colors.primaryLight : theme.colors.surface,
            borderColor: formData.dataSource === 'manual' ? theme.colors.primary : theme.colors.border.light,
          }
        ]}
        onPress={() => updateFormData({ dataSource: 'manual' })}
      >
        <View style={[styles.dataSourceIconContainer, { backgroundColor: theme.colors.secondary + '20' }]}>
          <Ionicons name="create" size={40} color={theme.colors.secondary} />
        </View>
        <View style={styles.dataSourceContent}>
          <Text style={[styles.dataSourceTitle, { color: theme.colors.text.primary }]}>
            Enter Manually
          </Text>
          <Text style={[styles.dataSourceSubtitle, { color: theme.colors.text.secondary }]}>
            Answer questions about your health
          </Text>
          <View style={styles.dataSourceBadge}>
            <Ionicons name="time" size={14} color={theme.colors.text.tertiary} />
            <Text style={[styles.dataSourceBadgeText, { color: theme.colors.text.tertiary }]}>
              Takes about 5-10 minutes
            </Text>
          </View>
        </View>
        {formData.dataSource === 'manual' && (
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
        )}
      </TouchableOpacity>

      <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.text.secondary }]}>
          No matter which option you choose, you'll always be able to set your personal health goals at the end.
        </Text>
      </View>
    </View>
  );

  const renderEHRUploadStep = () => (
    <ScrollView style={styles.ehrUploadContainer} showsVerticalScrollIndicator={false}>
      {/* Upload Section */}
      {!parsedEHR && (
        <View style={styles.jsonUploadSection}>
          <View style={[styles.ehrUploadArea, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light }]}>
            {isParsingEHR ? (
              <View style={styles.ehrProcessing}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.ehrProcessingText, { color: theme.colors.text.secondary }]}>
                  Processing your health records...
                </Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.ehrDropzone} onPress={handlePickEHRFile}>
                <Ionicons name="document-text-outline" size={64} color={theme.colors.primary} />
                <Text style={[styles.ehrDropzoneTitle, { color: theme.colors.text.primary }]}>
                  Upload EHR File
                </Text>
                <Text style={[styles.ehrDropzoneSubtitle, { color: theme.colors.text.secondary }]}>
                  Tap to select your health records JSON file
                </Text>
                <View style={[styles.formatBadge, { backgroundColor: theme.colors.primaryLight }]}>
                  <Text style={[styles.formatBadgeText, { color: theme.colors.primary }]}>
                    JSON Format
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Alternative: Paste JSON */}
          <TouchableOpacity
            style={[styles.pasteJsonButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light }]}
            onPress={() => setShowPasteModal(true)}
          >
            <Ionicons name="clipboard-outline" size={24} color={theme.colors.primary} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[styles.pasteJsonButtonTitle, { color: theme.colors.text.primary }]}>
                Paste JSON Instead
              </Text>
              <Text style={[styles.pasteJsonButtonSubtitle, { color: theme.colors.text.tertiary }]}>
                Copy JSON content and paste it here
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
          </TouchableOpacity>

          {/* Paste JSON Modal */}
          <Modal visible={showPasteModal} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={[styles.pasteModalContainer, { backgroundColor: theme.colors.background }]}>
              <View style={styles.pasteModalHeader}>
                <TouchableOpacity onPress={() => { setShowPasteModal(false); setPasteJsonText(''); setEhrError(null); }}>
                  <Text style={[styles.pasteModalCancel, { color: theme.colors.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.pasteModalTitle, { color: theme.colors.text.primary }]}>Paste JSON</Text>
                <TouchableOpacity onPress={handlePasteJson} disabled={!pasteJsonText.trim()}>
                  <Text style={[styles.pasteModalDone, { color: pasteJsonText.trim() ? theme.colors.primary : theme.colors.text.tertiary }]}>Import</Text>
                </TouchableOpacity>
              </View>
              
              {ehrError && (
                <View style={[styles.pasteModalError, { backgroundColor: theme.colors.semantic.error + '15' }]}>
                  <Ionicons name="alert-circle" size={20} color={theme.colors.semantic.error} />
                  <Text style={[styles.pasteModalErrorText, { color: theme.colors.semantic.error }]}>{ehrError}</Text>
                </View>
              )}
              
              <TextInput
                style={[styles.pasteJsonInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
                placeholder="Paste your EHR JSON content here..."
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                value={pasteJsonText}
                onChangeText={setPasteJsonText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              
              <Text style={[styles.pasteJsonHint, { color: theme.colors.text.tertiary }]}>
                Open your JSON file in another app, select all text, copy it, and paste here.
              </Text>
            </SafeAreaView>
          </Modal>

          <View style={[styles.ehrInfoBox, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light }]}>
            <Text style={[styles.ehrInfoTitle, { color: theme.colors.text.primary }]}>
              What data will be imported?
            </Text>
            <View style={styles.ehrInfoList}>
              <View style={styles.ehrInfoItem}>
                <View style={[styles.ehrInfoBullet, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.ehrInfoBulletText}>H</Text>
                </View>
                <View style={styles.ehrInfoContent}>
                  <Text style={[styles.ehrInfoLabel, { color: theme.colors.text.primary }]}>Historical Data</Text>
                  <Text style={[styles.ehrInfoDesc, { color: theme.colors.text.tertiary }]}>
                    Medical conditions, allergies, surgeries, family history
                  </Text>
                </View>
              </View>
              <View style={styles.ehrInfoItem}>
                <View style={[styles.ehrInfoBullet, { backgroundColor: theme.colors.secondary }]}>
                  <Text style={styles.ehrInfoBulletText}>R</Text>
                </View>
                <View style={styles.ehrInfoContent}>
                  <Text style={[styles.ehrInfoLabel, { color: theme.colors.text.primary }]}>Recent Data</Text>
                  <Text style={[styles.ehrInfoDesc, { color: theme.colors.text.tertiary }]}>
                    Current medications, vitals, measurements, lifestyle
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Success State */}
      {parsedEHR && (
        <View style={[styles.ehrUploadArea, { backgroundColor: theme.colors.surface, borderColor: theme.colors.semantic.success }]}>
          <View style={styles.ehrSuccess}>
            <View style={[styles.ehrSuccessIcon, { backgroundColor: theme.colors.semantic.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={48} color={theme.colors.semantic.success} />
            </View>
            <Text style={[styles.ehrSuccessTitle, { color: theme.colors.text.primary }]}>
              Health Records Imported
            </Text>
            <Text style={[styles.ehrSuccessSubtitle, { color: theme.colors.text.secondary }]}>
              {parsedEHR.demographics.firstName} {parsedEHR.demographics.lastName} • Age {parsedEHR.demographics.age}
            </Text>
            
            <View style={styles.ehrSummaryGrid}>
              <View style={[styles.ehrSummaryCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.ehrSummaryNumber, { color: theme.colors.primary }]}>
                  {parsedEHR.historicalData.chronicDiseases.length}
                </Text>
                <Text style={[styles.ehrSummaryLabel, { color: theme.colors.text.tertiary }]}>Conditions</Text>
              </View>
              <View style={[styles.ehrSummaryCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.ehrSummaryNumber, { color: theme.colors.semantic.error }]}>
                  {parsedEHR.historicalData.allergies.length}
                </Text>
                <Text style={[styles.ehrSummaryLabel, { color: theme.colors.text.tertiary }]}>Allergies</Text>
              </View>
              <View style={[styles.ehrSummaryCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.ehrSummaryNumber, { color: theme.colors.secondary }]}>
                  {parsedEHR.recentData.currentMedications?.length || 0}
                </Text>
                <Text style={[styles.ehrSummaryLabel, { color: theme.colors.text.tertiary }]}>Medications</Text>
              </View>
              <View style={[styles.ehrSummaryCard, { backgroundColor: theme.colors.background }]}>
                <Text style={[styles.ehrSummaryNumber, { color: theme.colors.text.secondary }]}>
                  {parsedEHR.historicalData.pastSurgeries.length}
                </Text>
                <Text style={[styles.ehrSummaryLabel, { color: theme.colors.text.tertiary }]}>Surgeries</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.ehrChangeButton, { borderColor: theme.colors.border.light, marginTop: 16 }]}
              onPress={() => {
                setParsedEHR(null);
                setEhrFile(null);
              }}
            >
              <Text style={[styles.ehrChangeButtonText, { color: theme.colors.primary }]}>
                Upload Different File
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {ehrError && (
        <View style={[styles.ehrError, { backgroundColor: theme.colors.semantic.error + '15' }]}>
          <Ionicons name="warning" size={20} color={theme.colors.semantic.error} />
          <Text style={[styles.ehrErrorText, { color: theme.colors.semantic.error }]}>
            {ehrError}
          </Text>
        </View>
      )}

      <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="lock-closed" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.text.secondary }]}>
          Your health records are encrypted and stored securely. We never share your data without your permission.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.skipEHRButton}
        onPress={() => {
          updateFormData({ dataSource: 'manual' });
          handleNext();
        }}
      >
        <Text style={[styles.skipEHRText, { color: theme.colors.text.tertiary }]}>
          Don't have EHR data? Enter manually instead
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderEHRReviewStep = () => (
    <ScrollView style={styles.ehrReviewContainer} showsVerticalScrollIndicator={false}>
      <Text style={[styles.ehrReviewDescription, { color: theme.colors.text.secondary }]}>
        Review the information imported from your health records. You can edit any incorrect data.
      </Text>

      {/* Personal Info Section */}
      <View style={[styles.ehrReviewSection, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.ehrReviewSectionHeader}>
          <Ionicons name="person" size={20} color={theme.colors.primary} />
          <Text style={[styles.ehrReviewSectionTitle, { color: theme.colors.text.primary }]}>
            Personal Information
          </Text>
        </View>
        <View style={styles.ehrReviewItem}>
          <Text style={[styles.ehrReviewLabel, { color: theme.colors.text.tertiary }]}>Name</Text>
          <Text style={[styles.ehrReviewValue, { color: theme.colors.text.primary }]}>
            {formData.basicInfo?.firstName} {formData.basicInfo?.lastName}
          </Text>
        </View>
        <View style={styles.ehrReviewItem}>
          <Text style={[styles.ehrReviewLabel, { color: theme.colors.text.tertiary }]}>Date of Birth</Text>
          <Text style={[styles.ehrReviewValue, { color: theme.colors.text.primary }]}>
            {formData.basicInfo?.dateOfBirth || 'Not specified'}
          </Text>
        </View>
        <View style={styles.ehrReviewItem}>
          <Text style={[styles.ehrReviewLabel, { color: theme.colors.text.tertiary }]}>Sex</Text>
          <Text style={[styles.ehrReviewValue, { color: theme.colors.text.primary }]}>
            {formData.basicInfo?.biologicalSex ? formData.basicInfo.biologicalSex.charAt(0).toUpperCase() + formData.basicInfo.biologicalSex.slice(1) : 'Not specified'}
          </Text>
        </View>
      </View>

      {/* Measurements Section */}
      {(formData.physicalMeasurements?.height || formData.physicalMeasurements?.weight) && (
        <View style={[styles.ehrReviewSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.ehrReviewSectionHeader}>
            <Ionicons name="body" size={20} color={theme.colors.primary} />
            <Text style={[styles.ehrReviewSectionTitle, { color: theme.colors.text.primary }]}>
              Measurements
            </Text>
          </View>
          {formData.physicalMeasurements?.height ? (
            <View style={styles.ehrReviewItem}>
              <Text style={[styles.ehrReviewLabel, { color: theme.colors.text.tertiary }]}>Height</Text>
              <Text style={[styles.ehrReviewValue, { color: theme.colors.text.primary }]}>
                {formData.physicalMeasurements.height} {formData.physicalMeasurements.heightUnit}
              </Text>
            </View>
          ) : null}
          {formData.physicalMeasurements?.weight ? (
            <View style={styles.ehrReviewItem}>
              <Text style={[styles.ehrReviewLabel, { color: theme.colors.text.tertiary }]}>Weight</Text>
              <Text style={[styles.ehrReviewValue, { color: theme.colors.text.primary }]}>
                {formData.physicalMeasurements.weight} {formData.physicalMeasurements.weightUnit}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Medical Conditions Section */}
      {formData.medicalConditions && formData.medicalConditions.length > 0 && (
        <View style={[styles.ehrReviewSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.ehrReviewSectionHeader}>
            <Ionicons name="medical" size={20} color={theme.colors.primary} />
            <Text style={[styles.ehrReviewSectionTitle, { color: theme.colors.text.primary }]}>
              Medical Conditions ({formData.medicalConditions.length})
            </Text>
          </View>
          {formData.medicalConditions.map((condition, index) => (
            <View key={index} style={styles.ehrReviewChip}>
              <Text style={[styles.ehrReviewChipText, { color: theme.colors.text.primary }]}>
                {condition.name}
              </Text>
              <Text style={[styles.ehrReviewChipStatus, { color: theme.colors.text.tertiary }]}>
                {condition.status}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Medications Section */}
      {formData.medications && formData.medications.length > 0 && (
        <View style={[styles.ehrReviewSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.ehrReviewSectionHeader}>
            <Ionicons name="medkit" size={20} color={theme.colors.primary} />
            <Text style={[styles.ehrReviewSectionTitle, { color: theme.colors.text.primary }]}>
              Current Medications ({formData.medications.length})
            </Text>
          </View>
          {formData.medications.map((med, index) => (
            <View key={index} style={styles.ehrReviewChip}>
              <Text style={[styles.ehrReviewChipText, { color: theme.colors.text.primary }]}>
                {med.name}
              </Text>
              {med.dosage && (
                <Text style={[styles.ehrReviewChipStatus, { color: theme.colors.text.tertiary }]}>
                  {med.dosage} {med.dosageUnit}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Allergies Section */}
      {formData.allergies && formData.allergies.length > 0 && (
        <View style={[styles.ehrReviewSection, { backgroundColor: theme.colors.semantic.error + '10' }]}>
          <View style={styles.ehrReviewSectionHeader}>
            <Ionicons name="alert-circle" size={20} color={theme.colors.semantic.error} />
            <Text style={[styles.ehrReviewSectionTitle, { color: theme.colors.text.primary }]}>
              Allergies ({formData.allergies.length})
            </Text>
          </View>
          {formData.allergies.map((allergy, index) => (
            <View key={index} style={styles.ehrReviewChip}>
              <Text style={[styles.ehrReviewChipText, { color: theme.colors.text.primary }]}>
                {allergy.allergen}
              </Text>
              <Text style={[styles.ehrReviewChipStatus, { color: theme.colors.semantic.error }]}>
                {allergy.severity}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.infoCard, { backgroundColor: theme.colors.primaryLight, marginBottom: 24 }]}>
        <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.primary }]}>
          This data will be stored securely. You can update it anytime from your profile settings.
        </Text>
      </View>
    </ScrollView>
  );

  const renderGoalsFreeformStep = () => (
    <ScrollView style={styles.goalsFreeformContainer} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionSubtitle, { color: theme.colors.text.secondary }]}>
        This is the most important part! Tell us what you're hoping to achieve.
      </Text>

      {/* Motivations */}
      <View style={styles.goalsFreeformSection}>
        <Text style={[styles.goalsFreeformLabel, { color: theme.colors.text.primary }]}>
          What motivates you? (Select all that apply)
        </Text>
        <View style={styles.chipContainer}>
          {GOAL_MOTIVATIONS.map(motivation => {
            const isSelected = selectedMotivations.includes(motivation);
            return (
              <TouchableOpacity
                key={motivation}
                style={[
                  styles.selectableChip,
                  {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                    borderColor: theme.colors.border.light,
                  }
                ]}
                onPress={() => {
                  if (isSelected) {
                    setSelectedMotivations(prev => prev.filter(m => m !== motivation));
                  } else {
                    setSelectedMotivations(prev => [...prev, motivation]);
                  }
                }}
              >
                <Text style={[styles.chipText, { color: isSelected ? 'white' : theme.colors.text.primary }]}>
                  {motivation}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Challenges */}
      <View style={styles.goalsFreeformSection}>
        <Text style={[styles.goalsFreeformLabel, { color: theme.colors.text.primary }]}>
          What challenges do you face? (Optional)
        </Text>
        <View style={styles.chipContainer}>
          {GOAL_CHALLENGES.map(challenge => {
            const isSelected = selectedChallenges.includes(challenge);
            return (
              <TouchableOpacity
                key={challenge}
                style={[
                  styles.selectableChip,
                  {
                    backgroundColor: isSelected ? theme.colors.secondary : theme.colors.surface,
                    borderColor: theme.colors.border.light,
                  }
                ]}
                onPress={() => {
                  if (isSelected) {
                    setSelectedChallenges(prev => prev.filter(c => c !== challenge));
                  } else {
                    setSelectedChallenges(prev => [...prev, challenge]);
                  }
                }}
              >
                <Text style={[styles.chipText, { color: isSelected ? 'white' : theme.colors.text.primary }]}>
                  {challenge}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Free-form goals */}
      <View style={styles.goalsFreeformSection}>
        <Text style={[styles.goalsFreeformLabel, { color: theme.colors.text.primary }]}>
          Describe your goals in your own words
        </Text>
        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border.light,
              color: theme.colors.text.primary,
              minHeight: 120,
            }
          ]}
          placeholder="E.g., I want to lose 20 pounds by summer, improve my sleep quality, manage my diabetes better, have more energy to play with my kids..."
          placeholderTextColor={theme.colors.text.disabled}
          value={freeFormGoals}
          onChangeText={setFreeFormGoals}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      <View style={[styles.infoCard, { backgroundColor: theme.colors.primaryLight, marginBottom: 24 }]}>
        <Ionicons name="bulb" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.primary }]}>
          We'll use this to personalize your daily recommendations, checklists, and AI coaching.
        </Text>
      </View>
    </ScrollView>
  );

  const renderBasicInfoStep = () => (
    <View style={styles.inputSection}>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>First Name *</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
          placeholder="Enter your first name"
          placeholderTextColor={theme.colors.text.disabled}
          value={formData.basicInfo?.firstName}
          onChangeText={(text) => updateFormData({ basicInfo: { ...formData.basicInfo!, firstName: text } })}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Last Name *</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
          placeholder="Enter your last name"
          placeholderTextColor={theme.colors.text.disabled}
          value={formData.basicInfo?.lastName}
          onChangeText={(text) => updateFormData({ basicInfo: { ...formData.basicInfo!, lastName: text } })}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Preferred Name (Optional)</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
          placeholder="What should we call you?"
          placeholderTextColor={theme.colors.text.disabled}
          value={formData.basicInfo?.preferredName}
          onChangeText={(text) => updateFormData({ basicInfo: { ...formData.basicInfo!, preferredName: text } })}
          autoCapitalize="words"
        />
      </View>
    </View>
  );

  const renderDemographicsStep = () => (
    <View style={styles.inputSection}>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Date of Birth *</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.text.disabled}
          value={formData.basicInfo?.dateOfBirth}
          onChangeText={(text) => updateFormData({ basicInfo: { ...formData.basicInfo!, dateOfBirth: text } })}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={[styles.inputHint, { color: theme.colors.text.tertiary }]}>
          Example: 1990-05-15
        </Text>
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Biological Sex *</Text>
        <View style={styles.optionsRow}>
          {(['male', 'female', 'intersex'] as const).map((sex) => (
            <TouchableOpacity
              key={sex}
              style={[
                styles.optionButton,
                { backgroundColor: formData.basicInfo?.biologicalSex === sex ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
              ]}
              onPress={() => updateFormData({ basicInfo: { ...formData.basicInfo!, biologicalSex: sex } })}
            >
              <Text style={[styles.optionText, { color: formData.basicInfo?.biologicalSex === sex ? 'white' : theme.colors.text.primary }]}>
                {sex.charAt(0).toUpperCase() + sex.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Blood Type (Optional)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.optionsRow}>
            {(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionButtonSmall,
                  { backgroundColor: formData.physicalMeasurements?.bloodType === type ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
                ]}
                onPress={() => updateFormData({ physicalMeasurements: { ...formData.physicalMeasurements!, bloodType: type } })}
              >
                <Text style={[styles.optionTextSmall, { color: formData.physicalMeasurements?.bloodType === type ? 'white' : theme.colors.text.primary }]}>
                  {type === 'unknown' ? '?' : type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );

  const renderPhysicalStep = () => (
    <View style={styles.inputSection}>
      <View style={styles.measurementRow}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Height *</Text>
          <View style={styles.unitInputContainer}>
            <TextInput
              style={[styles.textInput, styles.unitInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
              placeholder="68"
              placeholderTextColor={theme.colors.text.disabled}
              value={formData.physicalMeasurements?.height?.toString()}
              onChangeText={(text) => updateFormData({ physicalMeasurements: { ...formData.physicalMeasurements!, height: parseFloat(text) || 0 } })}
              keyboardType="numeric"
            />
            <View style={[styles.unitToggle, { backgroundColor: theme.colors.surface }]}>
              {(['inches', 'cm'] as const).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.unitButton, formData.physicalMeasurements?.heightUnit === unit && { backgroundColor: theme.colors.primary }]}
                  onPress={() => updateFormData({ physicalMeasurements: { ...formData.physicalMeasurements!, heightUnit: unit } })}
                >
                  <Text style={[styles.unitButtonText, { color: formData.physicalMeasurements?.heightUnit === unit ? 'white' : theme.colors.text.secondary }]}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Weight *</Text>
          <View style={styles.unitInputContainer}>
            <TextInput
              style={[styles.textInput, styles.unitInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
              placeholder="150"
              placeholderTextColor={theme.colors.text.disabled}
              value={formData.physicalMeasurements?.weight?.toString()}
              onChangeText={(text) => updateFormData({ physicalMeasurements: { ...formData.physicalMeasurements!, weight: parseFloat(text) || 0 } })}
              keyboardType="numeric"
            />
            <View style={[styles.unitToggle, { backgroundColor: theme.colors.surface }]}>
              {(['lbs', 'kg'] as const).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.unitButton, formData.physicalMeasurements?.weightUnit === unit && { backgroundColor: theme.colors.primary }]}
                  onPress={() => updateFormData({ physicalMeasurements: { ...formData.physicalMeasurements!, weightUnit: unit } })}
                >
                  <Text style={[styles.unitButtonText, { color: formData.physicalMeasurements?.weightUnit === unit ? 'white' : theme.colors.text.secondary }]}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
      <View style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
        <Text style={[styles.infoText, { color: theme.colors.text.secondary }]}>
          These measurements help us calculate your BMI and track changes over time.
        </Text>
      </View>
    </View>
  );

  const renderYesNoStep = (
    field: 'hasMedicalConditions' | 'takesMedications' | 'hasAllergies' | 'hasSurgicalHistory' | 'isReceivingTreatment' | 'hasFamilyHistory',
    icon: string,
    description: string
  ) => (
    <View style={styles.yesNoContainer}>
      <View style={[styles.yesNoIcon, { backgroundColor: theme.colors.primaryLight }]}>
        <Ionicons name={icon as any} size={48} color={theme.colors.primary} />
      </View>
      <Text style={[styles.yesNoDescription, { color: theme.colors.text.secondary }]}>
        {description}
      </Text>
      <View style={styles.yesNoButtons}>
        <TouchableOpacity
          style={[
            styles.yesNoButton,
            { backgroundColor: formData[field] === true ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
          ]}
          onPress={() => updateFormData({ [field]: true } as any)}
        >
          <Ionicons name="checkmark-circle" size={24} color={formData[field] === true ? 'white' : theme.colors.text.secondary} />
          <Text style={[styles.yesNoButtonText, { color: formData[field] === true ? 'white' : theme.colors.text.primary }]}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.yesNoButton,
            { backgroundColor: formData[field] === false ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
          ]}
          onPress={() => updateFormData({ [field]: false } as any)}
        >
          <Ionicons name="close-circle" size={24} color={formData[field] === false ? 'white' : theme.colors.text.secondary} />
          <Text style={[styles.yesNoButtonText, { color: formData[field] === false ? 'white' : theme.colors.text.primary }]}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConditionsDetailStep = () => {
    const addCondition = (name: string, category: MedicalConditionCategory) => {
      const newCondition: MedicalCondition = {
        id: generateId(),
        name,
        category,
        severity: 'moderate',
        status: 'active',
      };
      updateFormData({ medicalConditions: [...(formData.medicalConditions || []), newCondition] });
    };

    const removeCondition = (id: string) => {
      updateFormData({ medicalConditions: formData.medicalConditions?.filter(c => c.id !== id) });
    };

    return (
      <View style={styles.detailSection}>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.text.secondary }]}>
          Select all conditions that apply:
        </Text>
        
        {/* Selected conditions */}
        {(formData.medicalConditions?.length || 0) > 0 && (
          <View style={styles.selectedItems}>
            {formData.medicalConditions?.map(condition => (
              <View key={condition.id} style={[styles.selectedChip, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.selectedChipText}>{condition.name}</Text>
                <TouchableOpacity onPress={() => removeCondition(condition.id)}>
                  <Ionicons name="close-circle" size={18} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Categories */}
        <ScrollView style={styles.categoryScroll} showsVerticalScrollIndicator={false}>
          {(Object.keys(CONDITION_OPTIONS) as MedicalConditionCategory[]).map(category => (
            <View key={category} style={styles.categorySection}>
              <Text style={[styles.categoryTitle, { color: theme.colors.text.primary }]}>
                {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
              </Text>
              <View style={styles.chipContainer}>
                {CONDITION_OPTIONS[category].map(condition => {
                  const isSelected = formData.medicalConditions?.some(c => c.name === condition);
                  return (
                    <TouchableOpacity
                      key={condition}
                      style={[
                        styles.selectableChip,
                        { backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          const existing = formData.medicalConditions?.find(c => c.name === condition);
                          if (existing) removeCondition(existing.id);
                        } else {
                          addCondition(condition, category);
                        }
                      }}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? 'white' : theme.colors.text.primary }]}>
                        {condition}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderMedicationsDetailStep = () => {
    const addMedication = () => {
      if (!newMedName.trim()) return;
      const newMed: Medication = {
        id: generateId(),
        name: newMedName,
        dosage: newMedDosage,
        dosageUnit: 'mg',
        frequency: newMedFrequency,
        timeOfDay: ['morning'],
        purpose: '',
        isActive: true,
      };
      updateFormData({ medications: [...(formData.medications || []), newMed] });
      setNewMedName('');
      setNewMedDosage('');
      setShowAddMedication(false);
    };

    const removeMedication = (id: string) => {
      updateFormData({ medications: formData.medications?.filter(m => m.id !== id) });
    };

    return (
      <View style={styles.detailSection}>
        {/* Current medications */}
        {(formData.medications?.length || 0) > 0 && (
          <View style={styles.listContainer}>
            {formData.medications?.map(med => (
              <View key={med.id} style={[styles.listItem, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.listItemContent}>
                  <Text style={[styles.listItemTitle, { color: theme.colors.text.primary }]}>{med.name}</Text>
                  <Text style={[styles.listItemSubtitle, { color: theme.colors.text.secondary }]}>
                    {med.dosage} {med.dosageUnit} - {med.frequency.replace('_', ' ')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeMedication(med.id)}>
                  <Ionicons name="trash-outline" size={20} color={theme.colors.semantic.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Add medication form */}
        {showAddMedication ? (
          <View style={[styles.addForm, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
              placeholder="Medication name"
              placeholderTextColor={theme.colors.text.disabled}
              value={newMedName}
              onChangeText={setNewMedName}
            />
            <View style={styles.addFormRow}>
              <TextInput
                style={[styles.textInput, { flex: 1, marginRight: 8, backgroundColor: theme.colors.background, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
                placeholder="Dosage (e.g., 500)"
                placeholderTextColor={theme.colors.text.disabled}
                value={newMedDosage}
                onChangeText={setNewMedDosage}
                keyboardType="numeric"
              />
              <View style={[styles.frequencyPicker, { backgroundColor: theme.colors.background }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {(['once_daily', 'twice_daily', 'as_needed'] as const).map(freq => (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.freqOption, newMedFrequency === freq && { backgroundColor: theme.colors.primary }]}
                      onPress={() => setNewMedFrequency(freq)}
                    >
                      <Text style={[styles.freqOptionText, { color: newMedFrequency === freq ? 'white' : theme.colors.text.secondary }]}>
                        {freq.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
            <View style={styles.addFormButtons}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: theme.colors.border.light }]} onPress={() => setShowAddMedication(false)}>
                <Text style={[styles.cancelButtonText, { color: theme.colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: theme.colors.primary }]} onPress={addMedication}>
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={[styles.addButton, { borderColor: theme.colors.primary }]} onPress={() => setShowAddMedication(true)}>
            <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
            <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>Add Medication</Text>
          </TouchableOpacity>
        )}

        {/* Common medications suggestions */}
        <Text style={[styles.suggestionLabel, { color: theme.colors.text.tertiary }]}>Common medications:</Text>
        <View style={styles.chipContainer}>
          {COMMON_MEDICATIONS.slice(0, 12).map(med => {
            const isAdded = formData.medications?.some(m => m.name === med);
            return (
              <TouchableOpacity
                key={med}
                style={[styles.suggestionChip, { backgroundColor: isAdded ? theme.colors.primaryLight : theme.colors.surface, borderColor: theme.colors.border.light }]}
                onPress={() => {
                  if (!isAdded) {
                    const newMed: Medication = {
                      id: generateId(),
                      name: med,
                      dosage: '',
                      dosageUnit: 'mg',
                      frequency: 'once_daily',
                      timeOfDay: ['morning'],
                      purpose: '',
                      isActive: true,
                    };
                    updateFormData({ medications: [...(formData.medications || []), newMed] });
                  }
                }}
              >
                <Text style={[styles.suggestionChipText, { color: isAdded ? theme.colors.primary : theme.colors.text.secondary }]}>
                  {med}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderAllergiesDetailStep = () => {
    const addAllergy = (name: string, type: AllergyType) => {
      const newAllergy: Allergy = {
        id: generateId(),
        allergen: name,
        type,
        severity: 'moderate',
        reaction: '',
        diagnosed: true,
      };
      updateFormData({ allergies: [...(formData.allergies || []), newAllergy] });
    };

    const removeAllergy = (id: string) => {
      updateFormData({ allergies: formData.allergies?.filter(a => a.id !== id) });
    };

    return (
      <View style={styles.detailSection}>
        {/* Selected allergies */}
        {(formData.allergies?.length || 0) > 0 && (
          <View style={styles.selectedItems}>
            {formData.allergies?.map(allergy => (
              <View key={allergy.id} style={[styles.selectedChip, { backgroundColor: theme.colors.semantic.error }]}>
                <Text style={styles.selectedChipText}>{allergy.allergen}</Text>
                <TouchableOpacity onPress={() => removeAllergy(allergy.id)}>
                  <Ionicons name="close-circle" size={18} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <ScrollView style={styles.categoryScroll} showsVerticalScrollIndicator={false}>
          {(Object.keys(COMMON_ALLERGIES) as AllergyType[]).map(type => (
            <View key={type} style={styles.categorySection}>
              <Text style={[styles.categoryTitle, { color: theme.colors.text.primary }]}>
                {type.charAt(0).toUpperCase() + type.slice(1)} Allergies
              </Text>
              <View style={styles.chipContainer}>
                {COMMON_ALLERGIES[type].map(allergen => {
                  const isSelected = formData.allergies?.some(a => a.allergen === allergen);
                  return (
                    <TouchableOpacity
                      key={allergen}
                      style={[
                        styles.selectableChip,
                        { backgroundColor: isSelected ? theme.colors.semantic.error : theme.colors.surface, borderColor: theme.colors.border.light }
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          const existing = formData.allergies?.find(a => a.allergen === allergen);
                          if (existing) removeAllergy(existing.id);
                        } else {
                          addAllergy(allergen, type);
                        }
                      }}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? 'white' : theme.colors.text.primary }]}>
                        {allergen}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderSurgeryDetailStep = () => {
    const addSurgery = (name: string, type: SurgeryType) => {
      const newSurgery: Surgery = {
        id: generateId(),
        name,
        type,
        currentStatus: 'fully_recovered',
      };
      updateFormData({ surgeries: [...(formData.surgeries || []), newSurgery] });
    };

    const removeSurgery = (id: string) => {
      updateFormData({ surgeries: formData.surgeries?.filter(s => s.id !== id) });
    };

    return (
      <View style={styles.detailSection}>
        {/* Selected surgeries */}
        {(formData.surgeries?.length || 0) > 0 && (
          <View style={styles.selectedItems}>
            {formData.surgeries?.map(surgery => (
              <View key={surgery.id} style={[styles.selectedChip, { backgroundColor: theme.colors.secondary }]}>
                <Text style={styles.selectedChipText}>{surgery.name}</Text>
                <TouchableOpacity onPress={() => removeSurgery(surgery.id)}>
                  <Ionicons name="close-circle" size={18} color="white" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <ScrollView style={styles.categoryScroll} showsVerticalScrollIndicator={false}>
          {(Object.keys(COMMON_SURGERIES) as SurgeryType[]).map(type => (
            <View key={type} style={styles.categorySection}>
              <Text style={[styles.categoryTitle, { color: theme.colors.text.primary }]}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
              <View style={styles.chipContainer}>
                {COMMON_SURGERIES[type].map(surgery => {
                  const isSelected = formData.surgeries?.some(s => s.name === surgery);
                  return (
                    <TouchableOpacity
                      key={surgery}
                      style={[
                        styles.selectableChip,
                        { backgroundColor: isSelected ? theme.colors.secondary : theme.colors.surface, borderColor: theme.colors.border.light }
                      ]}
                      onPress={() => {
                        if (isSelected) {
                          const existing = formData.surgeries?.find(s => s.name === surgery);
                          if (existing) removeSurgery(existing.id);
                        } else {
                          addSurgery(surgery, type);
                        }
                      }}
                    >
                      <Text style={[styles.chipText, { color: isSelected ? 'white' : theme.colors.text.primary }]}>
                        {surgery}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTreatmentDetailStep = () => (
    <View style={styles.inputSection}>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Type of Treatment *</Text>
        <View style={styles.chipContainer}>
          {(['physical_therapy', 'occupational_therapy', 'mental_health', 'cancer_treatment', 'dialysis', 'other'] as const).map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.selectableChip,
                { backgroundColor: formData.currentTreatment?.type === type ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
              ]}
              onPress={() => updateFormData({ currentTreatment: { ...formData.currentTreatment!, type } })}
            >
              <Text style={[styles.chipText, { color: formData.currentTreatment?.type === type ? 'white' : theme.colors.text.primary }]}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Describe your treatment *</Text>
        <TextInput
          style={[styles.textInput, styles.textArea, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
          placeholder="E.g., Physical therapy for knee surgery recovery, 2x per week"
          placeholderTextColor={theme.colors.text.disabled}
          value={formData.currentTreatment?.description}
          onChangeText={(text) => updateFormData({ currentTreatment: { ...formData.currentTreatment!, description: text } })}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Frequency</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
          placeholder="E.g., 2x per week, daily, monthly"
          placeholderTextColor={theme.colors.text.disabled}
          value={formData.currentTreatment?.frequency}
          onChangeText={(text) => updateFormData({ currentTreatment: { ...formData.currentTreatment!, frequency: text } })}
        />
      </View>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Treatment Goals</Text>
        <TextInput
          style={[styles.textInput, styles.textArea, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
          placeholder="What are you hoping to achieve?"
          placeholderTextColor={theme.colors.text.disabled}
          value={formData.currentTreatment?.goals}
          onChangeText={(text) => updateFormData({ currentTreatment: { ...formData.currentTreatment!, goals: text } })}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const renderGoalsPrimaryStep = () => (
    <View style={styles.inputSection}>
      <Text style={[styles.sectionSubtitle, { color: theme.colors.text.secondary }]}>
        What area of health is most important to you right now?
      </Text>
      <View style={styles.goalCategoryGrid}>
        {([
          { id: 'weight', icon: 'scale', label: 'Weight Management' },
          { id: 'fitness', icon: 'fitness', label: 'Fitness & Exercise' },
          { id: 'nutrition', icon: 'nutrition', label: 'Nutrition' },
          { id: 'sleep', icon: 'moon', label: 'Sleep' },
          { id: 'mental_health', icon: 'happy', label: 'Mental Health' },
          { id: 'chronic_disease', icon: 'medical', label: 'Manage Condition' },
          { id: 'recovery', icon: 'bandage', label: 'Recovery' },
          { id: 'preventive', icon: 'shield-checkmark', label: 'Preventive Care' },
        ] as { id: HealthGoalCategory; icon: string; label: string }[]).map(category => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.goalCategoryCard,
              { backgroundColor: formData.primaryHealthFocus === category.id ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
            ]}
            onPress={() => updateFormData({ primaryHealthFocus: category.id })}
          >
            <Ionicons
              name={category.icon as any}
              size={32}
              color={formData.primaryHealthFocus === category.id ? 'white' : theme.colors.primary}
            />
            <Text style={[styles.goalCategoryLabel, { color: formData.primaryHealthFocus === category.id ? 'white' : theme.colors.text.primary }]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGoalsDetailStep = () => {
    const addGoal = (title: string, unit?: string, defaultTarget?: number) => {
      const newGoal: HealthGoal = {
        id: generateId(),
        category: formData.primaryHealthFocus || 'fitness',
        title,
        targetValue: defaultTarget || 0,
        targetUnit: unit || '',
        priority: 'medium',
      };
      updateFormData({ healthGoals: [...(formData.healthGoals || []), newGoal] });
    };

    const updateGoalTarget = (id: string, value: number) => {
      updateFormData({
        healthGoals: formData.healthGoals?.map(g => g.id === id ? { ...g, targetValue: value } : g)
      });
    };

    const removeGoal = (id: string) => {
      updateFormData({ healthGoals: formData.healthGoals?.filter(g => g.id !== id) });
    };

    const templates = GOAL_TEMPLATES[formData.primaryHealthFocus || 'fitness'];

    return (
      <View style={styles.detailSection}>
        <Text style={[styles.sectionSubtitle, { color: theme.colors.text.secondary }]}>
          Set specific, measurable goals for your {(formData.primaryHealthFocus || 'health').replace('_', ' ')} journey:
        </Text>

        {/* Current goals with editable targets */}
        {(formData.healthGoals?.length || 0) > 0 && (
          <View style={styles.goalsListContainer}>
            {formData.healthGoals?.map(goal => (
              <View key={goal.id} style={[styles.goalItem, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.goalItemHeader}>
                  <Text style={[styles.goalItemTitle, { color: theme.colors.text.primary }]}>{goal.title}</Text>
                  <TouchableOpacity onPress={() => removeGoal(goal.id)}>
                    <Ionicons name="close-circle" size={20} color={theme.colors.semantic.error} />
                  </TouchableOpacity>
                </View>
                {goal.targetUnit && (
                  <View style={styles.goalTargetRow}>
                    <Text style={[styles.goalTargetLabel, { color: theme.colors.text.secondary }]}>Target:</Text>
                    <TextInput
                      style={[styles.goalTargetInput, { backgroundColor: theme.colors.background, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
                      value={goal.targetValue?.toString()}
                      onChangeText={(text) => updateGoalTarget(goal.id, parseFloat(text) || 0)}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.goalTargetUnit, { color: theme.colors.text.tertiary }]}>{goal.targetUnit}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Goal templates */}
        <Text style={[styles.suggestionLabel, { color: theme.colors.text.tertiary }]}>Available goals:</Text>
        <View style={styles.chipContainer}>
          {templates.map(template => {
            const isAdded = formData.healthGoals?.some(g => g.title === template.title);
            return (
              <TouchableOpacity
                key={template.title}
                style={[
                  styles.selectableChip,
                  { backgroundColor: isAdded ? theme.colors.primaryLight : theme.colors.surface, borderColor: theme.colors.border.light }
                ]}
                onPress={() => {
                  if (!isAdded) {
                    addGoal(template.title, template.unit, template.defaultTarget);
                  }
                }}
              >
                <Text style={[styles.chipText, { color: isAdded ? theme.colors.primary : theme.colors.text.primary }]}>
                  {template.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderLifestyleStep = () => (
    <ScrollView style={styles.lifestyleScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.inputSection}>
        {/* Activity Level */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Activity Level *</Text>
          <View style={styles.chipContainer}>
            {([
              { id: 'sedentary', label: 'Sedentary' },
              { id: 'lightly_active', label: 'Light' },
              { id: 'moderately_active', label: 'Moderate' },
              { id: 'very_active', label: 'Very Active' },
            ] as const).map(level => (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.selectableChip,
                  { backgroundColor: formData.lifestyle?.activityLevel === level.id ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
                ]}
                onPress={() => updateFormData({ lifestyle: { ...formData.lifestyle!, activityLevel: level.id } })}
              >
                <Text style={[styles.chipText, { color: formData.lifestyle?.activityLevel === level.id ? 'white' : theme.colors.text.primary }]}>
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Exercise */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Exercise (days per week)</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderNumbers}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.sliderNumber,
                    { backgroundColor: formData.lifestyle?.exerciseFrequency === num ? theme.colors.primary : theme.colors.surface }
                  ]}
                  onPress={() => updateFormData({ lifestyle: { ...formData.lifestyle!, exerciseFrequency: num } })}
                >
                  <Text style={[styles.sliderNumberText, { color: formData.lifestyle?.exerciseFrequency === num ? 'white' : theme.colors.text.primary }]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Sleep */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Average hours of sleep</Text>
          <View style={styles.measurementRow}>
            <TextInput
              style={[styles.textInput, { flex: 1, backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
              placeholder="7"
              placeholderTextColor={theme.colors.text.disabled}
              value={formData.lifestyle?.averageSleepHours?.toString()}
              onChangeText={(text) => updateFormData({ lifestyle: { ...formData.lifestyle!, averageSleepHours: parseFloat(text) || 0 } })}
              keyboardType="numeric"
            />
            <Text style={[styles.unitLabel, { color: theme.colors.text.tertiary }]}>hours/night</Text>
          </View>
        </View>

        {/* Sleep Quality */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Sleep Quality *</Text>
          <View style={styles.optionsRow}>
            {(['poor', 'fair', 'good', 'excellent'] as const).map(quality => (
              <TouchableOpacity
                key={quality}
                style={[
                  styles.optionButton,
                  { backgroundColor: formData.lifestyle?.sleepQuality === quality ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
                ]}
                onPress={() => updateFormData({ lifestyle: { ...formData.lifestyle!, sleepQuality: quality } })}
              >
                <Text style={[styles.optionText, { color: formData.lifestyle?.sleepQuality === quality ? 'white' : theme.colors.text.primary }]}>
                  {quality.charAt(0).toUpperCase() + quality.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stress Level */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Stress Level (1-10)</Text>
          <View style={styles.sliderContainer}>
            <View style={styles.sliderNumbers}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.stressNumber,
                    {
                      backgroundColor: formData.lifestyle?.stressLevel === num
                        ? num <= 3 ? theme.colors.semantic.success
                          : num <= 6 ? theme.colors.semantic.warning
                          : theme.colors.semantic.error
                        : theme.colors.surface
                    }
                  ]}
                  onPress={() => updateFormData({ lifestyle: { ...formData.lifestyle!, stressLevel: num as any } })}
                >
                  <Text style={[styles.stressNumberText, { color: formData.lifestyle?.stressLevel === num ? 'white' : theme.colors.text.primary }]}>
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Water Intake */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Daily Water Intake</Text>
          <View style={styles.measurementRow}>
            <TextInput
              style={[styles.textInput, { flex: 1, backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light, color: theme.colors.text.primary }]}
              placeholder="64"
              placeholderTextColor={theme.colors.text.disabled}
              value={formData.lifestyle?.waterIntakeOz?.toString()}
              onChangeText={(text) => updateFormData({ lifestyle: { ...formData.lifestyle!, waterIntakeOz: parseInt(text) || 0 } })}
              keyboardType="numeric"
            />
            <Text style={[styles.unitLabel, { color: theme.colors.text.tertiary }]}>oz/day</Text>
          </View>
        </View>

        {/* Smoking */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Smoking Status</Text>
          <View style={styles.optionsRow}>
            {(['never', 'former', 'current'] as const).map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.optionButton,
                  { backgroundColor: formData.lifestyle?.smokingStatus === status ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
                ]}
                onPress={() => updateFormData({ lifestyle: { ...formData.lifestyle!, smokingStatus: status } })}
              >
                <Text style={[styles.optionText, { color: formData.lifestyle?.smokingStatus === status ? 'white' : theme.colors.text.primary }]}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Alcohol */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Alcohol Consumption</Text>
          <View style={styles.chipContainer}>
            {(['never', 'rarely', 'occasionally', 'weekly', 'daily'] as const).map(freq => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.selectableChip,
                  { backgroundColor: formData.lifestyle?.alcoholFrequency === freq ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
                ]}
                onPress={() => updateFormData({ lifestyle: { ...formData.lifestyle!, alcoholFrequency: freq } })}
              >
                <Text style={[styles.chipText, { color: formData.lifestyle?.alcoholFrequency === freq ? 'white' : theme.colors.text.primary }]}>
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderFamilyHistoryDetailStep = () => {
    const addFamilyCondition = (relationship: FamilyMedicalHistory['relationship'], condition: string) => {
      const existing = formData.familyHistory?.find(f => f.relationship === relationship);
      if (existing) {
        if (!existing.conditions.includes(condition)) {
          updateFormData({
            familyHistory: formData.familyHistory?.map(f =>
              f.relationship === relationship
                ? { ...f, conditions: [...f.conditions, condition] }
                : f
            )
          });
        }
      } else {
        const newEntry: FamilyMedicalHistory = {
          relationship,
          conditions: [condition],
        };
        updateFormData({ familyHistory: [...(formData.familyHistory || []), newEntry] });
      }
    };

    const removeConditionFromFamily = (relationship: FamilyMedicalHistory['relationship'], condition: string) => {
      updateFormData({
        familyHistory: formData.familyHistory?.map(f =>
          f.relationship === relationship
            ? { ...f, conditions: f.conditions.filter(c => c !== condition) }
            : f
        ).filter(f => f.conditions.length > 0)
      });
    };

    return (
      <View style={styles.detailSection}>
        <ScrollView style={styles.categoryScroll} showsVerticalScrollIndicator={false}>
          {(['mother', 'father', 'sibling', 'grandparent'] as const).map(relation => {
            const familyMember = formData.familyHistory?.find(f => f.relationship === relation);
            return (
              <View key={relation} style={styles.familySection}>
                <Text style={[styles.categoryTitle, { color: theme.colors.text.primary }]}>
                  {relation.charAt(0).toUpperCase() + relation.slice(1)}
                </Text>
                {familyMember && familyMember.conditions.length > 0 && (
                  <View style={styles.selectedItems}>
                    {familyMember.conditions.map(cond => (
                      <View key={cond} style={[styles.selectedChipSmall, { backgroundColor: theme.colors.primaryLight }]}>
                        <Text style={[styles.selectedChipTextSmall, { color: theme.colors.primary }]}>{cond}</Text>
                        <TouchableOpacity onPress={() => removeConditionFromFamily(relation, cond)}>
                          <Ionicons name="close" size={14} color={theme.colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.chipContainer}>
                  {FAMILY_HISTORY_CONDITIONS.slice(0, 8).map(condition => {
                    const isSelected = familyMember?.conditions.includes(condition);
                    return (
                      <TouchableOpacity
                        key={condition}
                        style={[
                          styles.selectableChipSmall,
                          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border.light }
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            removeConditionFromFamily(relation, condition);
                          } else {
                            addFamilyCondition(relation, condition);
                          }
                        }}
                      >
                        <Text style={[styles.chipTextSmall, { color: theme.colors.text.secondary }]}>
                          {condition}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderPreferencesStep = () => (
    <View style={styles.inputSection}>
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>Measurement Units</Text>
        <View style={styles.optionsRow}>
          <TouchableOpacity
            style={[
              styles.optionButtonWide,
              { backgroundColor: formData.preferences?.units === 'imperial' ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
            ]}
            onPress={() => updateFormData({ preferences: { ...formData.preferences!, units: 'imperial' } })}
          >
            <Text style={[styles.optionText, { color: formData.preferences?.units === 'imperial' ? 'white' : theme.colors.text.primary }]}>
              Imperial (lbs, in)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionButtonWide,
              { backgroundColor: formData.preferences?.units === 'metric' ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border.light }
            ]}
            onPress={() => updateFormData({ preferences: { ...formData.preferences!, units: 'metric' } })}
          >
            <Text style={[styles.optionText, { color: formData.preferences?.units === 'metric' ? 'white' : theme.colors.text.primary }]}>
              Metric (kg, cm)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.toggleRow, { backgroundColor: theme.colors.surface }]}
        onPress={() => updateFormData({ preferences: { ...formData.preferences!, notifications: !formData.preferences?.notifications } })}
      >
        <View style={styles.toggleContent}>
          <Ionicons name="notifications" size={24} color={theme.colors.primary} />
          <View style={styles.toggleText}>
            <Text style={[styles.toggleTitle, { color: theme.colors.text.primary }]}>Daily Reminders</Text>
            <Text style={[styles.toggleSubtitle, { color: theme.colors.text.tertiary }]}>Get notified about your health tasks</Text>
          </View>
        </View>
        <View style={[styles.toggleSwitch, { backgroundColor: formData.preferences?.notifications ? theme.colors.primary : theme.colors.border.light }]}>
          <View style={[styles.toggleKnob, { transform: [{ translateX: formData.preferences?.notifications ? 20 : 0 }] }]} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toggleRow, { backgroundColor: theme.colors.surface }]}
        onPress={() => updateFormData({ preferences: { ...formData.preferences!, dataSharing: !formData.preferences?.dataSharing } })}
      >
        <View style={styles.toggleContent}>
          <Ionicons name="analytics" size={24} color={theme.colors.primary} />
          <View style={styles.toggleText}>
            <Text style={[styles.toggleTitle, { color: theme.colors.text.primary }]}>Anonymous Insights</Text>
            <Text style={[styles.toggleSubtitle, { color: theme.colors.text.tertiary }]}>Help improve health recommendations</Text>
          </View>
        </View>
        <View style={[styles.toggleSwitch, { backgroundColor: formData.preferences?.dataSharing ? theme.colors.primary : theme.colors.border.light }]}>
          <View style={[styles.toggleKnob, { transform: [{ translateX: formData.preferences?.dataSharing ? 20 : 0 }] }]} />
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderCompleteStep = () => (
    <View style={styles.completeContainer}>
      <View style={[styles.completeIcon, { backgroundColor: theme.colors.semantic.success }]}>
        <Ionicons name="checkmark-circle" size={64} color="white" />
      </View>
      <Text style={[styles.completeTitle, { color: theme.colors.text.primary }]}>
        Profile Complete!
      </Text>
      <Text style={[styles.completeDescription, { color: theme.colors.text.secondary }]}>
        {formData.dataSource === 'ehr_upload'
          ? "We've imported your health records and personalized your profile:"
          : "We've created your personalized health profile based on:"}
      </Text>
      <View style={styles.summaryList}>
        {formData.dataSource === 'ehr_upload' && (
          <View style={styles.summaryItem}>
            <Ionicons name="cloud-done" size={20} color={theme.colors.semantic.success} />
            <Text style={[styles.summaryText, { color: theme.colors.text.primary }]}>
              Health records imported
            </Text>
          </View>
        )}
        {formData.medicalConditions && formData.medicalConditions.length > 0 && (
          <View style={styles.summaryItem}>
            <Ionicons name="medical" size={20} color={theme.colors.primary} />
            <Text style={[styles.summaryText, { color: theme.colors.text.primary }]}>
              {formData.medicalConditions.length} medical condition(s)
            </Text>
          </View>
        )}
        {formData.medications && formData.medications.length > 0 && (
          <View style={styles.summaryItem}>
            <Ionicons name="medkit" size={20} color={theme.colors.primary} />
            <Text style={[styles.summaryText, { color: theme.colors.text.primary }]}>
              {formData.medications.length} medication(s)
            </Text>
          </View>
        )}
        {formData.allergies && formData.allergies.length > 0 && (
          <View style={styles.summaryItem}>
            <Ionicons name="alert-circle" size={20} color={theme.colors.semantic.error} />
            <Text style={[styles.summaryText, { color: theme.colors.text.primary }]}>
              {formData.allergies.length} allergy(ies) tracked
            </Text>
          </View>
        )}
        {formData.healthGoals && formData.healthGoals.length > 0 && (
          <View style={styles.summaryItem}>
            <Ionicons name="flag" size={20} color={theme.colors.primary} />
            <Text style={[styles.summaryText, { color: theme.colors.text.primary }]}>
              {formData.healthGoals.length} health goal(s)
            </Text>
          </View>
        )}
        {(selectedMotivations.length > 0 || freeFormGoals) && (
          <View style={styles.summaryItem}>
            <Ionicons name="heart" size={20} color={theme.colors.primary} />
            <Text style={[styles.summaryText, { color: theme.colors.text.primary }]}>
              Personal goals & motivations captured
            </Text>
          </View>
        )}
        <View style={styles.summaryItem}>
          <Ionicons name="person" size={20} color={theme.colors.primary} />
          <Text style={[styles.summaryText, { color: theme.colors.text.primary }]}>
            Lifestyle & preferences configured
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'welcome': return renderWelcomeStep();
      case 'data_source': return renderDataSourceStep();
      case 'ehr_upload': return renderEHRUploadStep();
      case 'ehr_review': return renderEHRReviewStep();
      case 'basic_info': return renderBasicInfoStep();
      case 'demographics': return renderDemographicsStep();
      case 'physical': return renderPhysicalStep();
      case 'conditions_check': return renderYesNoStep('hasMedicalConditions', 'medical', 'This includes any chronic conditions, ongoing health issues, or diagnosed diseases.');
      case 'conditions_detail': return renderConditionsDetailStep();
      case 'medications_check': return renderYesNoStep('takesMedications', 'medkit', 'Include prescription medications, over-the-counter drugs, and supplements you take regularly.');
      case 'medications_detail': return renderMedicationsDetailStep();
      case 'allergies_check': return renderYesNoStep('hasAllergies', 'alert-circle', 'Include medication allergies, food allergies, and environmental allergies.');
      case 'allergies_detail': return renderAllergiesDetailStep();
      case 'surgery_check': return renderYesNoStep('hasSurgicalHistory', 'cut', 'Include major surgeries, minor procedures, and any planned surgeries.');
      case 'surgery_detail': return renderSurgeryDetailStep();
      case 'treatment_check': return renderYesNoStep('isReceivingTreatment', 'fitness', 'This includes physical therapy, mental health therapy, cancer treatment, dialysis, etc.');
      case 'treatment_detail': return renderTreatmentDetailStep();
      case 'lifestyle': return renderLifestyleStep();
      case 'family_history_check': return renderYesNoStep('hasFamilyHistory', 'people', 'Family history can help identify potential health risks.');
      case 'family_history_detail': return renderFamilyHistoryDetailStep();
      case 'goals_primary': return renderGoalsPrimaryStep();
      case 'goals_detail': return renderGoalsDetailStep();
      case 'goals_freeform': return renderGoalsFreeformStep();
      case 'preferences': return renderPreferencesStep();
      case 'complete': return renderCompleteStep();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header with Cancel Button */}
        <View style={styles.onboardingHeader}>
          <TouchableOpacity
            style={[styles.headerCancelButton, { backgroundColor: theme.colors.semantic.error + '15' }]}
            onPress={handleCancelSignup}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={theme.colors.semantic.error} />
          </TouchableOpacity>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressText, { color: theme.colors.text.tertiary }]}>
              {currentStepIndex + 1} of {totalVisibleSteps}
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border.light }]}>
            <Animated.View 
              style={[
                styles.progressFill,
                { 
                  backgroundColor: theme.colors.primary,
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  })
                }
              ]} 
            />
          </View>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View 
            style={[
              styles.content,
              { 
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }]
              }
            ]}
          >
            {/* Step Header */}
            <View style={styles.stepHeader}>
              <Text style={[styles.stepTitle, { color: theme.colors.text.primary }]}>
                {currentStep.title}
              </Text>
              <Text style={[styles.stepSubtitle, { color: theme.colors.text.secondary }]}>
                {currentStep.subtitle}
              </Text>
            </View>

            {/* Step Content */}
            {renderStepContent()}
          </Animated.View>
        </ScrollView>

        {/* Navigation */}
        <View style={[styles.navigation, { borderTopColor: theme.colors.border.light }]}>
          {currentStepIndex > 0 && (
            <TouchableOpacity
              style={[styles.backButton, { borderColor: theme.colors.border.light }]}
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={20} color={theme.colors.text.secondary} />
              <Text style={[styles.backButtonText, { color: theme.colors.text.secondary }]}>Back</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextButton,
              { 
                backgroundColor: isStepValid() ? theme.colors.primary : theme.colors.border.light,
                opacity: isStepValid() ? 1 : 0.5,
                flex: currentStepIndex === 0 ? 1 : undefined,
              }
            ]}
            onPress={handleNext}
            disabled={!isStepValid() || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Ionicons name="refresh" size={20} color="white" style={styles.spinning} />
                <Text style={styles.nextButtonText}>Setting up...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {currentStep.id === 'welcome' ? 'Get Started' : currentStep.id === 'complete' ? 'Start My Journey' : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ============= STYLES =============
const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  
  // Header with cancel
  onboardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    zIndex: 100,
  },
  headerCancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 101,
  },
  progressInfo: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 44 },

  // Data Source Selection
  dataSourceContainer: { paddingVertical: 16 },
  dataSourceDescription: { fontSize: 15, lineHeight: 22, marginBottom: 24, textAlign: 'center' },
  dataSourceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 16,
  },
  dataSourceIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataSourceContent: { flex: 1, marginLeft: 16 },
  dataSourceTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  dataSourceSubtitle: { fontSize: 14, marginBottom: 8 },
  dataSourceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dataSourceBadgeText: { fontSize: 12, fontWeight: '500' },

  // EHR Upload
  ehrUploadContainer: { flex: 1, paddingBottom: 20 },
  
  // JSON Upload Section
  jsonUploadSection: { marginBottom: 24 },
  
  // Format Badge
  formatBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 16, 
    marginTop: 12,
  },
  formatBadgeText: { fontSize: 12, fontWeight: '600' },
  
  // EHR Info Box
  ehrInfoBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  ehrInfoTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  ehrInfoList: { gap: 12 },
  ehrInfoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ehrInfoBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ehrInfoBulletText: { color: 'white', fontSize: 12, fontWeight: '700' },
  ehrInfoContent: { flex: 1 },
  ehrInfoLabel: { fontSize: 14, fontWeight: '600' },
  ehrInfoDesc: { fontSize: 12, marginTop: 2 },
  
  // EHR Summary Grid
  ehrSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  ehrSummaryCard: {
    width: '48%',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  ehrSummaryNumber: { fontSize: 24, fontWeight: '700' },
  ehrSummaryLabel: { fontSize: 11, marginTop: 2, textTransform: 'uppercase' },
  ehrUploadArea: {
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    minHeight: 200,
  },
  ehrDropzone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 200,
  },
  ehrDropzoneTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  ehrDropzoneSubtitle: { fontSize: 14, textAlign: 'center' },
  ehrProcessing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  ehrProcessingText: { fontSize: 16, marginTop: 16 },
  ehrSuccess: { alignItems: 'center', padding: 24 },
  ehrSuccessIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ehrSuccessTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  ehrSuccessSubtitle: { fontSize: 14, marginBottom: 16 },
  ehrSummary: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 16 },
  ehrSummaryItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ehrSummaryText: { fontSize: 13 },
  ehrChangeButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  ehrChangeButtonText: { fontSize: 14, fontWeight: '500' },
  ehrError: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginTop: 12, gap: 8 },
  ehrErrorText: { flex: 1, fontSize: 13 },
  skipEHRButton: { alignItems: 'center', marginTop: 24, padding: 12 },
  skipEHRText: { fontSize: 14 },

  // EHR Review
  ehrReviewContainer: { flex: 1 },
  ehrReviewDescription: { fontSize: 14, marginBottom: 16 },
  ehrReviewSection: { padding: 16, borderRadius: 12, marginBottom: 12 },
  ehrReviewSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  ehrReviewSectionTitle: { fontSize: 16, fontWeight: '600' },
  ehrReviewItem: { marginBottom: 8 },
  ehrReviewLabel: { fontSize: 12, marginBottom: 2 },
  ehrReviewValue: { fontSize: 15 },
  ehrReviewChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  ehrReviewChipText: { fontSize: 14 },
  ehrReviewChipStatus: { fontSize: 12, textTransform: 'capitalize' },

  // Goals Free-form
  goalsFreeformContainer: { flex: 1 },
  goalsFreeformSection: { marginBottom: 24 },
  goalsFreeformLabel: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  
  // Progress bar
  progressContainer: { paddingHorizontal: 24, paddingBottom: 8 },
  progressBar: { height: 4, borderRadius: 2 },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 12, textAlign: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  content: { paddingHorizontal: 24 },
  stepHeader: { marginBottom: 32, marginTop: 16 },
  stepTitle: { fontSize: 28, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  stepSubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  
  // Welcome step
  welcomeContainer: { alignItems: 'center', paddingVertical: 24 },
  welcomeIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  welcomeTitle: { fontSize: 24, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  welcomeDescription: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32, paddingHorizontal: 16 },
  featureList: { width: '100%' },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 16 },
  featureText: { fontSize: 16, marginLeft: 16 },
  
  // Input sections
  inputSection: { marginBottom: 24 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputHint: { fontSize: 12, marginTop: 4 },
  textInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  
  // Options
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, minWidth: 80, alignItems: 'center' },
  optionButtonWide: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, flex: 1, alignItems: 'center', marginHorizontal: 4 },
  optionButtonSmall: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  optionText: { fontSize: 14, fontWeight: '500' },
  optionTextSmall: { fontSize: 13, fontWeight: '500' },
  
  // Measurements
  measurementRow: { flexDirection: 'row', alignItems: 'center' },
  unitInputContainer: { flex: 1 },
  unitInput: { marginBottom: 8 },
  unitToggle: { flexDirection: 'row', borderRadius: 8, padding: 4 },
  unitButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  unitButtonText: { fontSize: 12, fontWeight: '500' },
  unitLabel: { fontSize: 14, marginLeft: 8 },
  
  // Info card
  infoCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginTop: 16 },
  infoText: { flex: 1, marginLeft: 12, fontSize: 14, lineHeight: 20 },
  
  // Yes/No steps
  yesNoContainer: { alignItems: 'center', paddingVertical: 24 },
  yesNoIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  yesNoDescription: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32, paddingHorizontal: 16 },
  yesNoButtons: { flexDirection: 'row', gap: 16 },
  yesNoButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 16, gap: 8 },
  yesNoButtonText: { fontSize: 18, fontWeight: '600' },
  
  // Detail sections
  detailSection: { flex: 1 },
  sectionSubtitle: { fontSize: 14, marginBottom: 16 },
  categoryScroll: { flex: 1, maxHeight: 400 },
  categorySection: { marginBottom: 20 },
  categoryTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  
  // Chips
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectableChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  selectableChipSmall: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 14 },
  chipTextSmall: { fontSize: 12 },
  selectedItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  selectedChipSmall: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  selectedChipText: { color: 'white', fontSize: 14, fontWeight: '500' },
  selectedChipTextSmall: { fontSize: 12, fontWeight: '500' },
  suggestionLabel: { fontSize: 12, marginTop: 16, marginBottom: 8 },
  suggestionChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  suggestionChipText: { fontSize: 13 },
  
  // List items
  listContainer: { marginBottom: 16 },
  listItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8 },
  listItemContent: { flex: 1 },
  listItemTitle: { fontSize: 16, fontWeight: '600' },
  listItemSubtitle: { fontSize: 13, marginTop: 2 },
  
  // Add form
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderRadius: 12, padding: 16, gap: 8 },
  addButtonText: { fontSize: 16, fontWeight: '600' },
  addForm: { padding: 16, borderRadius: 12, marginBottom: 16 },
  addFormRow: { flexDirection: 'row', marginTop: 12 },
  addFormButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 8 },
  cancelButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  cancelButtonText: { fontSize: 14, fontWeight: '500' },
  saveButton: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  saveButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  frequencyPicker: { borderRadius: 8, padding: 4 },
  freqOption: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginRight: 4 },
  freqOptionText: { fontSize: 12 },
  
  // Goals
  goalCategoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  goalCategoryCard: { width: '45%', aspectRatio: 1.3, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 16 },
  goalCategoryLabel: { fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 8 },
  goalsListContainer: { marginBottom: 16 },
  goalItem: { padding: 16, borderRadius: 12, marginBottom: 8 },
  goalItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalItemTitle: { fontSize: 16, fontWeight: '600' },
  goalTargetRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  goalTargetLabel: { fontSize: 14, marginRight: 8 },
  goalTargetInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, width: 80, fontSize: 16, textAlign: 'center' },
  goalTargetUnit: { fontSize: 14, marginLeft: 8 },
  
  // Lifestyle
  lifestyleScroll: { flex: 1 },
  sliderContainer: { marginTop: 8 },
  sliderNumbers: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderNumber: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sliderNumberText: { fontSize: 14, fontWeight: '600' },
  stressNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stressNumberText: { fontSize: 12, fontWeight: '600' },
  
  // Family history
  familySection: { marginBottom: 24 },
  
  // Preferences
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, marginBottom: 12 },
  toggleContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  toggleText: { marginLeft: 12, flex: 1 },
  toggleTitle: { fontSize: 16, fontWeight: '600' },
  toggleSubtitle: { fontSize: 13, marginTop: 2 },
  toggleSwitch: { width: 48, height: 28, borderRadius: 14, justifyContent: 'center', padding: 2 },
  toggleKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'white' },
  
  // Complete step
  completeContainer: { alignItems: 'center', paddingVertical: 24 },
  completeIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  completeTitle: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  completeDescription: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  summaryList: { width: '100%' },
  summaryItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 },
  summaryText: { fontSize: 16, marginLeft: 12 },
  
  // Navigation
  navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1 },
  backButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  backButtonText: { fontSize: 16, fontWeight: '600' },
  nextButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, gap: 8 },
  nextButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center' },
  spinning: { marginRight: 8 },
  
  // Paste JSON
  pasteJsonButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 16 },
  pasteJsonButtonTitle: { fontSize: 16, fontWeight: '600' },
  pasteJsonButtonSubtitle: { fontSize: 13, marginTop: 2 },
  pasteModalContainer: { flex: 1, padding: 20 },
  pasteModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pasteModalCancel: { fontSize: 16 },
  pasteModalTitle: { fontSize: 17, fontWeight: '600' },
  pasteModalDone: { fontSize: 16, fontWeight: '600' },
  pasteModalError: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  pasteModalErrorText: { fontSize: 14, flex: 1 },
  pasteJsonInput: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 14, textAlignVertical: 'top', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  pasteJsonHint: { fontSize: 13, marginTop: 12, textAlign: 'center' },
});
