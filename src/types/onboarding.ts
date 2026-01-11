// Comprehensive Onboarding Data Types
// Structured for future AI/ML processing and healthcare integrations

// ============= DATA SOURCE & STRUCTURED DATA =============
export type OnboardingDataSource = 'manual' | 'ehr_upload';

// Historical Health Data - Long-term, rarely changing data
export interface HistoricalHealthData {
  geneticConditions: {
    name: string;
    inheritedFrom?: 'mother' | 'father' | 'both' | 'unknown';
    notes?: string;
  }[];
  chronicDiseases: {
    name: string;
    diagnosedDate?: string;
    status: 'active' | 'managed' | 'resolved' | 'monitoring';
    category?: string;
    severity?: 'mild' | 'moderate' | 'severe';
  }[];
  familyHistory: {
    relationship: 'mother' | 'father' | 'sibling' | 'grandparent' | 'aunt_uncle';
    conditions: string[];
    ageOfOnset?: number;
  }[];
  allergies: {
    allergen: string;
    type: 'medication' | 'food' | 'environmental' | 'insect' | 'latex' | 'other';
    severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
    reaction?: string;
  }[];
  pastSurgeries: {
    name: string;
    date?: string;
    hospital?: string;
    outcome?: 'fully_recovered' | 'recovering' | 'ongoing_issues';
    type?: string;
  }[];
  bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
}

// Recent Health Data - Current, frequently changing data
export interface RecentHealthData {
  measurements: {
    height?: { value: number; unit: 'inches' | 'cm'; recordedAt: string };
    weight?: { value: number; unit: 'lbs' | 'kg'; recordedAt: string };
    bmi?: { value: number; recordedAt: string };
  };
  vitals: {
    bloodPressure?: { systolic: number; diastolic: number; recordedAt: string };
    heartRate?: { value: number; unit: string; recordedAt: string };
    temperature?: { value: number; unit: string; recordedAt: string };
  };
  currentMedications: {
    name: string;
    dosage?: string;
    dosageUnit?: string;
    frequency?: string;
    temporary: boolean;
    startDate?: string;
    endDate?: string;
    purpose?: string;
  }[];
  lifestyle: {
    activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
    sleepHours?: number;
    sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
    stressLevel?: number;
    smokingStatus?: 'never' | 'former' | 'current' | 'vaping';
    alcoholFrequency?: 'never' | 'rarely' | 'occasionally' | 'weekly' | 'daily';
  };
}

// User Goals Structure - Required for all users
export interface UserGoalsData {
  primaryFocus: HealthGoalCategory;
  goals: HealthGoal[];
  motivations: string[];
  challenges: string[];
  freeFormGoals?: string; // User's goals in their own words
}

// ============= MEDICAL CONDITIONS =============
export interface MedicalCondition {
  id: string;
  name: string;
  category: MedicalConditionCategory;
  severity: 'mild' | 'moderate' | 'severe';
  diagnosisDate?: string; // ISO date string
  status: 'active' | 'managed' | 'resolved' | 'monitoring';
  medications?: string[]; // References to medication IDs
  notes?: string;
}

export type MedicalConditionCategory =
  | 'cardiovascular'
  | 'respiratory'
  | 'endocrine'
  | 'neurological'
  | 'musculoskeletal'
  | 'gastrointestinal'
  | 'mental_health'
  | 'autoimmune'
  | 'cancer'
  | 'infectious'
  | 'skin'
  | 'kidney'
  | 'liver'
  | 'reproductive'
  | 'other';

// Common conditions by category for selection
export const CONDITION_OPTIONS: Record<MedicalConditionCategory, string[]> = {
  cardiovascular: [
    'High Blood Pressure (Hypertension)',
    'Heart Disease',
    'Heart Failure',
    'Arrhythmia',
    'High Cholesterol',
    'Coronary Artery Disease',
    'Peripheral Artery Disease',
    'Previous Heart Attack',
    'Previous Stroke',
  ],
  respiratory: [
    'Asthma',
    'COPD',
    'Sleep Apnea',
    'Chronic Bronchitis',
    'Emphysema',
    'Pulmonary Fibrosis',
  ],
  endocrine: [
    'Type 1 Diabetes',
    'Type 2 Diabetes',
    'Pre-diabetes',
    'Hypothyroidism',
    'Hyperthyroidism',
    'Thyroid Nodules',
    'Polycystic Ovary Syndrome (PCOS)',
    'Adrenal Insufficiency',
  ],
  neurological: [
    'Migraines',
    'Epilepsy',
    'Multiple Sclerosis',
    'Parkinson\'s Disease',
    'Neuropathy',
    'Chronic Pain Syndrome',
    'Fibromyalgia',
  ],
  musculoskeletal: [
    'Osteoarthritis',
    'Rheumatoid Arthritis',
    'Osteoporosis',
    'Back Pain (Chronic)',
    'Joint Problems',
    'Tendinitis',
    'Bursitis',
    'Scoliosis',
  ],
  gastrointestinal: [
    'GERD / Acid Reflux',
    'IBS (Irritable Bowel Syndrome)',
    'IBD (Crohn\'s or Ulcerative Colitis)',
    'Celiac Disease',
    'Gastritis',
    'Peptic Ulcer',
    'Fatty Liver Disease',
  ],
  mental_health: [
    'Anxiety Disorder',
    'Depression',
    'Bipolar Disorder',
    'PTSD',
    'ADHD',
    'OCD',
    'Eating Disorder',
    'Panic Disorder',
  ],
  autoimmune: [
    'Lupus',
    'Psoriasis',
    'Hashimoto\'s Disease',
    'Graves\' Disease',
    'Sjögren\'s Syndrome',
    'Celiac Disease',
  ],
  cancer: [
    'Breast Cancer (History)',
    'Prostate Cancer (History)',
    'Lung Cancer (History)',
    'Colon Cancer (History)',
    'Skin Cancer (History)',
    'Other Cancer (History)',
    'Currently in Treatment',
    'In Remission',
  ],
  infectious: [
    'HIV/AIDS',
    'Hepatitis B',
    'Hepatitis C',
    'Tuberculosis (History)',
    'Lyme Disease',
  ],
  skin: [
    'Eczema',
    'Psoriasis',
    'Rosacea',
    'Chronic Hives',
    'Acne (Severe)',
  ],
  kidney: [
    'Chronic Kidney Disease',
    'Kidney Stones (Recurrent)',
    'Polycystic Kidney Disease',
  ],
  liver: [
    'Fatty Liver Disease',
    'Cirrhosis',
    'Hepatitis',
  ],
  reproductive: [
    'Endometriosis',
    'PCOS',
    'Infertility',
    'Erectile Dysfunction',
    'Menopause Symptoms',
  ],
  other: [
    'Other (Please Specify)',
  ],
};

// ============= MEDICATIONS =============
export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  dosageUnit: 'mg' | 'g' | 'mcg' | 'ml' | 'units' | 'other';
  frequency: MedicationFrequency;
  timeOfDay: ('morning' | 'afternoon' | 'evening' | 'night' | 'with_meals')[];
  purpose: string;
  prescribedBy?: string;
  startDate?: string;
  isActive: boolean;
  sideEffectsExperienced?: string[];
}

export type MedicationFrequency =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'four_times_daily'
  | 'every_other_day'
  | 'weekly'
  | 'as_needed'
  | 'other';

// Common medications for suggestions
export const COMMON_MEDICATIONS = [
  'Metformin',
  'Lisinopril',
  'Amlodipine',
  'Metoprolol',
  'Atorvastatin',
  'Levothyroxine',
  'Omeprazole',
  'Losartan',
  'Gabapentin',
  'Sertraline',
  'Fluoxetine',
  'Escitalopram',
  'Alprazolam',
  'Trazodone',
  'Prednisone',
  'Albuterol',
  'Montelukast',
  'Insulin',
  'Aspirin',
  'Ibuprofen',
];

// ============= ALLERGIES =============
export interface Allergy {
  id: string;
  allergen: string;
  type: AllergyType;
  severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
  reaction: string;
  diagnosed: boolean;
}

export type AllergyType =
  | 'medication'
  | 'food'
  | 'environmental'
  | 'insect'
  | 'latex'
  | 'other';

export const COMMON_ALLERGIES: Record<AllergyType, string[]> = {
  medication: [
    'Penicillin',
    'Sulfa Drugs',
    'Aspirin',
    'NSAIDs',
    'Codeine',
    'Morphine',
    'Contrast Dye',
    'Anesthesia',
  ],
  food: [
    'Peanuts',
    'Tree Nuts',
    'Shellfish',
    'Fish',
    'Eggs',
    'Milk/Dairy',
    'Wheat/Gluten',
    'Soy',
    'Sesame',
  ],
  environmental: [
    'Pollen',
    'Dust Mites',
    'Mold',
    'Pet Dander',
    'Grass',
    'Ragweed',
  ],
  insect: [
    'Bee Stings',
    'Wasp Stings',
    'Fire Ants',
    'Mosquitoes',
  ],
  latex: ['Latex'],
  other: ['Other'],
};

// ============= SURGERIES / PROCEDURES =============
export interface Surgery {
  id: string;
  name: string;
  type: SurgeryType;
  date?: string;
  hospital?: string;
  complications?: string;
  currentStatus: 'fully_recovered' | 'recovering' | 'ongoing_issues';
  relatedCondition?: string;
}

export type SurgeryType =
  | 'orthopedic'
  | 'cardiac'
  | 'abdominal'
  | 'neurological'
  | 'cosmetic'
  | 'eye'
  | 'dental'
  | 'cancer'
  | 'transplant'
  | 'other';

export const COMMON_SURGERIES: Record<SurgeryType, string[]> = {
  orthopedic: [
    'Knee Replacement',
    'Hip Replacement',
    'ACL Repair',
    'Rotator Cuff Repair',
    'Spinal Fusion',
    'Arthroscopy',
    'Fracture Repair',
  ],
  cardiac: [
    'Bypass Surgery (CABG)',
    'Angioplasty / Stent',
    'Pacemaker Implant',
    'Valve Repair/Replacement',
  ],
  abdominal: [
    'Appendectomy',
    'Cholecystectomy (Gallbladder)',
    'Hernia Repair',
    'Gastric Bypass',
    'Gastric Sleeve',
    'Hysterectomy',
    'C-Section',
    'Colonoscopy with Polyp Removal',
  ],
  neurological: [
    'Brain Surgery',
    'Spine Surgery',
    'Carpal Tunnel Release',
  ],
  cosmetic: [
    'Breast Augmentation/Reduction',
    'Liposuction',
    'Rhinoplasty',
  ],
  eye: [
    'LASIK',
    'Cataract Surgery',
    'Retinal Surgery',
  ],
  dental: [
    'Wisdom Teeth Removal',
    'Dental Implants',
    'Root Canal',
  ],
  cancer: [
    'Tumor Removal',
    'Mastectomy',
    'Prostatectomy',
    'Lymph Node Removal',
  ],
  transplant: [
    'Kidney Transplant',
    'Liver Transplant',
    'Heart Transplant',
    'Bone Marrow Transplant',
  ],
  other: ['Other Surgery'],
};

// ============= HEALTH GOALS =============
export interface HealthGoal {
  id: string;
  category: HealthGoalCategory;
  title: string;
  description?: string;
  targetValue?: number;
  targetUnit?: string;
  currentValue?: number;
  targetDate?: string;
  priority: 'low' | 'medium' | 'high';
  milestones?: GoalMilestone[];
}

export interface GoalMilestone {
  id: string;
  title: string;
  targetValue: number;
  targetDate?: string;
  achieved: boolean;
  achievedDate?: string;
}

export type HealthGoalCategory =
  | 'weight'
  | 'fitness'
  | 'nutrition'
  | 'sleep'
  | 'mental_health'
  | 'chronic_disease'
  | 'recovery'
  | 'preventive'
  | 'habit'
  | 'other';

export const GOAL_TEMPLATES: Record<HealthGoalCategory, { title: string; unit?: string; defaultTarget?: number }[]> = {
  weight: [
    { title: 'Lose Weight', unit: 'lbs' },
    { title: 'Gain Weight', unit: 'lbs' },
    { title: 'Maintain Current Weight', unit: 'lbs' },
    { title: 'Reduce Body Fat', unit: '%' },
    { title: 'Increase Muscle Mass', unit: 'lbs' },
  ],
  fitness: [
    { title: 'Steps Per Day', unit: 'steps', defaultTarget: 10000 },
    { title: 'Exercise Minutes Per Week', unit: 'minutes', defaultTarget: 150 },
    { title: 'Run Distance Per Week', unit: 'miles' },
    { title: 'Strength Training Sessions Per Week', unit: 'sessions', defaultTarget: 3 },
    { title: 'Improve Cardiovascular Endurance', unit: 'minutes' },
    { title: 'Flexibility/Mobility Improvement', unit: 'sessions/week' },
  ],
  nutrition: [
    { title: 'Daily Calorie Target', unit: 'calories' },
    { title: 'Daily Protein Intake', unit: 'grams' },
    { title: 'Daily Water Intake', unit: 'oz', defaultTarget: 64 },
    { title: 'Reduce Sugar Intake', unit: 'grams' },
    { title: 'Eat More Vegetables', unit: 'servings', defaultTarget: 5 },
    { title: 'Reduce Sodium Intake', unit: 'mg', defaultTarget: 2300 },
  ],
  sleep: [
    { title: 'Hours of Sleep Per Night', unit: 'hours', defaultTarget: 8 },
    { title: 'Consistent Sleep Schedule', unit: 'days/week', defaultTarget: 7 },
    { title: 'Reduce Sleep Latency', unit: 'minutes' },
    { title: 'Improve Sleep Quality Score', unit: 'score' },
  ],
  mental_health: [
    { title: 'Meditation Minutes Per Day', unit: 'minutes', defaultTarget: 10 },
    { title: 'Stress Level Reduction', unit: 'score (1-10)' },
    { title: 'Therapy Sessions Per Month', unit: 'sessions' },
    { title: 'Journaling Days Per Week', unit: 'days' },
    { title: 'Screen-Free Time Per Day', unit: 'hours' },
  ],
  chronic_disease: [
    { title: 'Target A1C Level', unit: '%', defaultTarget: 7 },
    { title: 'Target Blood Pressure', unit: 'mmHg' },
    { title: 'Target Blood Sugar (Fasting)', unit: 'mg/dL', defaultTarget: 100 },
    { title: 'Target Cholesterol (LDL)', unit: 'mg/dL', defaultTarget: 100 },
    { title: 'Target Heart Rate (Resting)', unit: 'bpm' },
  ],
  recovery: [
    { title: 'Physical Therapy Sessions Per Week', unit: 'sessions' },
    { title: 'Range of Motion Improvement', unit: 'degrees' },
    { title: 'Pain Level Reduction', unit: 'score (1-10)' },
    { title: 'Return to Activity Date', unit: 'date' },
    { title: 'Medication Reduction', unit: '%' },
  ],
  preventive: [
    { title: 'Annual Physical Exam', unit: 'date' },
    { title: 'Dental Checkup', unit: 'date' },
    { title: 'Eye Exam', unit: 'date' },
    { title: 'Cancer Screening', unit: 'date' },
    { title: 'Vaccinations Up to Date', unit: 'yes/no' },
  ],
  habit: [
    { title: 'Quit Smoking', unit: 'days smoke-free' },
    { title: 'Reduce Alcohol', unit: 'drinks/week' },
    { title: 'Reduce Caffeine', unit: 'cups/day' },
    { title: 'Take Medications Consistently', unit: '% adherence', defaultTarget: 100 },
  ],
  other: [
    { title: 'Custom Goal', unit: '' },
  ],
};

// ============= LIFESTYLE FACTORS =============
export interface LifestyleFactors {
  // Activity Level
  activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  occupationType: 'desk_job' | 'light_physical' | 'moderate_physical' | 'heavy_physical' | 'variable';
  exerciseTypes: string[];
  exerciseFrequency: number; // days per week
  exerciseDuration: number; // average minutes per session

  // Sleep
  averageSleepHours: number;
  sleepQuality: 'poor' | 'fair' | 'good' | 'excellent';
  sleepIssues: string[];
  
  // Nutrition
  dietType: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean' | 'other';
  mealsPerDay: number;
  waterIntakeOz: number;
  alcoholFrequency: 'never' | 'rarely' | 'occasionally' | 'weekly' | 'daily';
  alcoholUnitsPerWeek?: number;
  caffeinePerDay: number; // cups/servings
  
  // Substances
  smokingStatus: 'never' | 'former' | 'current' | 'vaping';
  smokingPacksPerDay?: number;
  smokingYears?: number;
  
  // Stress
  stressLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  stressSources: string[];
  copingMechanisms: string[];
}

export const EXERCISE_TYPES = [
  'Walking',
  'Running',
  'Cycling',
  'Swimming',
  'Weight Training',
  'Yoga',
  'Pilates',
  'HIIT',
  'CrossFit',
  'Sports',
  'Dancing',
  'Martial Arts',
  'Hiking',
  'Rowing',
  'Elliptical',
  'Group Fitness Classes',
  'Physical Therapy Exercises',
  'Stretching',
];

export const SLEEP_ISSUES = [
  'Difficulty falling asleep',
  'Waking up during the night',
  'Waking up too early',
  'Not feeling rested',
  'Snoring',
  'Sleep apnea',
  'Restless legs',
  'Nightmares',
  'Insomnia',
];

export const STRESS_SOURCES = [
  'Work/Career',
  'Financial',
  'Relationships',
  'Family',
  'Health concerns',
  'Major life changes',
  'Daily hassles',
  'Social situations',
  'World events',
  'Academic/School',
];

export const COPING_MECHANISMS = [
  'Exercise',
  'Meditation',
  'Deep breathing',
  'Talking to friends/family',
  'Therapy/Counseling',
  'Hobbies',
  'Nature/Outdoors',
  'Music',
  'Reading',
  'Journaling',
  'Prayer/Spirituality',
];

// ============= FAMILY HISTORY =============
export interface FamilyMedicalHistory {
  relationship: 'mother' | 'father' | 'sibling' | 'grandparent' | 'aunt_uncle';
  conditions: string[];
  ageOfOnset?: number;
  notes?: string;
}

export const FAMILY_HISTORY_CONDITIONS = [
  'Heart Disease',
  'High Blood Pressure',
  'Stroke',
  'Diabetes (Type 1)',
  'Diabetes (Type 2)',
  'Cancer (Breast)',
  'Cancer (Colon)',
  'Cancer (Prostate)',
  'Cancer (Lung)',
  'Cancer (Other)',
  'Alzheimer\'s/Dementia',
  'Parkinson\'s Disease',
  'Mental Health Conditions',
  'Autoimmune Disease',
  'Kidney Disease',
  'Liver Disease',
  'Obesity',
  'High Cholesterol',
  'Blood Clots/DVT',
  'Thyroid Disease',
];

// ============= CARE TEAM =============
export interface CareTeamMember {
  id: string;
  role: CareTeamRole;
  name: string;
  practice?: string;
  phone?: string;
  email?: string;
  lastVisit?: string;
  nextAppointment?: string;
}

export type CareTeamRole =
  | 'primary_care'
  | 'specialist'
  | 'surgeon'
  | 'physical_therapist'
  | 'mental_health'
  | 'nutritionist'
  | 'dentist'
  | 'optometrist'
  | 'pharmacist'
  | 'other';

// ============= COMPREHENSIVE ONBOARDING DATA =============
export interface ComprehensiveOnboardingData {
  // Data Source - How the user provided their data
  dataSource: OnboardingDataSource;
  
  // Step 1: Basic Info
  basicInfo: {
    firstName: string;
    lastName: string;
    preferredName?: string;
    dateOfBirth: string; // ISO date
    biologicalSex: 'male' | 'female' | 'intersex';
    genderIdentity?: string;
    pronouns?: string;
  };

  // Step 2: Contact & Emergency
  contactInfo: {
    phone?: string;
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
  };

  // Step 3: Physical Measurements
  physicalMeasurements: {
    height: number; // in inches
    heightUnit: 'inches' | 'cm';
    weight: number; // in lbs
    weightUnit: 'lbs' | 'kg';
    bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';
  };

  // Step 4: Medical Conditions (Dynamic)
  hasMedicalConditions: boolean;
  medicalConditions: MedicalCondition[];

  // Step 5: Medications (Dynamic)
  takesMedications: boolean;
  medications: Medication[];

  // Step 6: Allergies (Dynamic)
  hasAllergies: boolean;
  allergies: Allergy[];

  // Step 7: Surgical History (Dynamic)
  hasSurgicalHistory: boolean;
  surgeries: Surgery[];

  // Step 8: Current Treatment/Therapy
  isReceivingTreatment: boolean;
  currentTreatment?: {
    type: 'physical_therapy' | 'occupational_therapy' | 'speech_therapy' | 'mental_health' | 'cancer_treatment' | 'dialysis' | 'other';
    description: string;
    frequency: string;
    provider?: string;
    startDate?: string;
    expectedEndDate?: string;
    goals?: string;
  };

  // Step 9: Health Goals (Dynamic with numerical targets) - ALWAYS REQUIRED
  healthGoals: HealthGoal[];
  primaryHealthFocus: HealthGoalCategory;
  userGoals?: UserGoalsData; // New structured goals data

  // Step 10: Lifestyle Assessment
  lifestyle: LifestyleFactors;

  // Step 11: Family History (Dynamic)
  hasFamilyHistory: boolean;
  familyHistory: FamilyMedicalHistory[];

  // Step 12: Healthcare Providers
  hasExistingProviders: boolean;
  careTeam: CareTeamMember[];

  // Step 13: Preferences
  preferences: {
    units: 'imperial' | 'metric';
    notifications: boolean;
    reminderTime?: string; // HH:MM format
    dataSharing: boolean;
    healthDataSources: ('apple_health' | 'google_fit' | 'fitbit' | 'garmin' | 'manual')[];
  };

  // Structured data for Supabase storage
  historicalData?: HistoricalHealthData;
  recentData?: RecentHealthData;

  // Metadata
  completedAt?: string;
  version: string;
}

// Default/initial state for onboarding
export const getInitialOnboardingData = (): Partial<ComprehensiveOnboardingData> => ({
  dataSource: 'manual',
  basicInfo: {
    firstName: '',
    lastName: '',
    preferredName: '',
    dateOfBirth: '',
    biologicalSex: 'male',
    genderIdentity: '',
    pronouns: '',
  },
  contactInfo: {},
  physicalMeasurements: {
    height: 0,
    heightUnit: 'inches',
    weight: 0,
    weightUnit: 'lbs',
    bloodType: 'unknown',
  },
  hasMedicalConditions: false,
  medicalConditions: [],
  takesMedications: false,
  medications: [],
  hasAllergies: false,
  allergies: [],
  hasSurgicalHistory: false,
  surgeries: [],
  isReceivingTreatment: false,
  healthGoals: [],
  primaryHealthFocus: 'fitness',
  userGoals: {
    primaryFocus: 'fitness',
    goals: [],
    motivations: [],
    challenges: [],
    freeFormGoals: '',
  },
  lifestyle: {
    activityLevel: 'moderately_active',
    occupationType: 'desk_job',
    exerciseTypes: [],
    exerciseFrequency: 0,
    exerciseDuration: 0,
    averageSleepHours: 7,
    sleepQuality: 'good',
    sleepIssues: [],
    dietType: 'omnivore',
    mealsPerDay: 3,
    waterIntakeOz: 64,
    alcoholFrequency: 'occasionally',
    caffeinePerDay: 2,
    smokingStatus: 'never',
    stressLevel: 5,
    stressSources: [],
    copingMechanisms: [],
  },
  hasFamilyHistory: false,
  familyHistory: [],
  hasExistingProviders: false,
  careTeam: [],
  preferences: {
    units: 'imperial',
    notifications: true,
    dataSharing: false,
    healthDataSources: ['manual'],
  },
  historicalData: {
    geneticConditions: [],
    chronicDiseases: [],
    familyHistory: [],
    allergies: [],
    pastSurgeries: [],
    bloodType: 'unknown',
  },
  recentData: {
    measurements: {},
    vitals: {},
    currentMedications: [],
    lifestyle: {},
  },
  version: '2.0',
});

// Goal motivations options
export const GOAL_MOTIVATIONS = [
  'Improve overall health',
  'Lose weight',
  'Gain muscle',
  'Manage a health condition',
  'Have more energy',
  'Sleep better',
  'Reduce stress',
  'Live longer',
  'Feel more confident',
  'Be healthier for family',
  'Athletic performance',
  'Recovery from injury/surgery',
  'Doctor\'s recommendation',
  'Preventive health',
];

// Common challenges options
export const GOAL_CHALLENGES = [
  'Lack of time',
  'Lack of motivation',
  'Not sure where to start',
  'Health limitations',
  'Financial constraints',
  'Busy work schedule',
  'Family responsibilities',
  'Social eating/drinking',
  'Travel frequently',
  'Stress eating',
  'Poor sleep',
  'Chronic pain',
  'Previous failed attempts',
];

// Helper to generate unique IDs
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
