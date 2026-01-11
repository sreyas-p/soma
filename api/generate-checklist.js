const axios = require('axios');
const { getUserContext } = require('./user-context');

// API configuration - supports both OpenAI and OpenRouter
const API_KEY = process.env.OPENAI_API_KEY;

// Supabase configuration
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://rzgynrkidzsafmcfhnod.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z3lucmtpZHpzYWZtY2Zobm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Mjk0MzIsImV4cCI6MjA4MzMwNTQzMn0.mc_L3r5qPGDSJIZ1STvHcJCwiLtyntwU_U41XbzdrQw';
const supabase = createClient(supabaseUrl, supabaseKey);

// Detect if using OpenRouter (keys start with sk-or-) or OpenAI
const isOpenRouter = API_KEY && API_KEY.startsWith('sk-or-');
const API_URL = isOpenRouter 
  ? 'https://openrouter.ai/api/v1/chat/completions'
  : 'https://api.openai.com/v1/chat/completions';

// Fallback tasks when API is unavailable
const FALLBACK_TASKS = [
  {
    id: "1",
    title: "Drink 8 glasses water",
    description: "Stay hydrated throughout the day for better energy and health",
    category: "nutrition",
    scheduledTime: "Throughout day",
    isCompleted: false,
    dataSource: "default"
  },
  {
    id: "2",
    title: "30 min morning walk",
    description: "Get your body moving with a brisk morning walk",
    category: "exercise",
    scheduledTime: "7:00 AM",
    isCompleted: false,
    dataSource: "default"
  },
  {
    id: "3",
    title: "Eat balanced breakfast",
    description: "Include protein, fiber, and healthy fats",
    category: "nutrition",
    scheduledTime: "8:00 AM",
    isCompleted: false,
    dataSource: "default"
  },
  {
    id: "4",
    title: "Take daily vitamins",
    description: "Don't forget your daily supplements",
    category: "medication",
    scheduledTime: "9:00 AM",
    isCompleted: false,
    dataSource: "default"
  },
  {
    id: "5",
    title: "Track sleep quality",
    description: "Log how you slept last night",
    category: "monitoring",
    scheduledTime: "Morning",
    isCompleted: false,
    dataSource: "default"
  },
  {
    id: "6",
    title: "Healthy lunch prep",
    description: "Prepare a nutritious meal with vegetables and lean protein",
    category: "nutrition",
    scheduledTime: "12:00 PM",
    isCompleted: false,
    dataSource: "default"
  },
  {
    id: "7",
    title: "Evening stretch routine",
    description: "10 minutes of gentle stretching before bed",
    category: "exercise",
    scheduledTime: "9:00 PM",
    isCompleted: false,
    dataSource: "default"
  }
];

/**
 * Analyze historical data to identify patterns and areas needing attention
 */
function analyzeHistoricalTrends(historical) {
  if (!historical || historical.length === 0) {
    return { analysis: '', recommendations: [] };
  }

  const analysis = [];
  const recommendations = [];
  
  // Calculate averages
  const avgSteps = Math.round(historical.reduce((sum, d) => sum + (d.steps || 0), 0) / historical.length);
  const avgCalories = Math.round(historical.reduce((sum, d) => sum + (d.calories || 0), 0) / historical.length);
  const sleepData = historical.filter(d => d.sleep_hours);
  const avgSleep = sleepData.length > 0 
    ? (sleepData.reduce((sum, d) => sum + d.sleep_hours, 0) / sleepData.length).toFixed(1)
    : null;
  
  // Identify trends (comparing recent 7 days vs previous)
  const recent = historical.slice(0, 7);
  const older = historical.slice(7, 14);
  
  if (recent.length >= 3 && older.length >= 3) {
    const recentAvgSteps = recent.reduce((sum, d) => sum + (d.steps || 0), 0) / recent.length;
    const olderAvgSteps = older.reduce((sum, d) => sum + (d.steps || 0), 0) / older.length;
    
    if (recentAvgSteps < olderAvgSteps * 0.8) {
      analysis.push(`⚠️ Activity declining: Recent step average (${Math.round(recentAvgSteps)}) is lower than previous (${Math.round(olderAvgSteps)})`);
      recommendations.push({ type: 'exercise', priority: 'high', reason: 'declining_activity' });
    } else if (recentAvgSteps > olderAvgSteps * 1.2) {
      analysis.push(`✅ Great progress! Step count increasing from ${Math.round(olderAvgSteps)} to ${Math.round(recentAvgSteps)}`);
    }
  }

  // Check sleep patterns
  if (avgSleep && parseFloat(avgSleep) < 7) {
    analysis.push(`💤 Sleep averaging ${avgSleep} hrs - below recommended 7-9 hours`);
    recommendations.push({ type: 'sleep', priority: 'high', reason: 'low_sleep' });
  }

  // Check step consistency
  const stepsBelow5k = historical.filter(d => (d.steps || 0) < 5000).length;
  if (stepsBelow5k > historical.length * 0.5) {
    analysis.push(`👟 ${stepsBelow5k} of last ${historical.length} days had fewer than 5,000 steps`);
    recommendations.push({ type: 'exercise', priority: 'medium', reason: 'low_steps' });
  }

  // Check workout frequency
  const workoutDays = historical.filter(d => (d.workout_minutes || 0) > 0).length;
  if (workoutDays < historical.length * 0.3) {
    analysis.push(`💪 Only ${workoutDays} workout sessions in ${historical.length} days`);
    recommendations.push({ type: 'exercise', priority: 'medium', reason: 'low_workout_frequency' });
  }

  return {
    analysis: analysis.join('\n'),
    recommendations,
    stats: {
      avgSteps,
      avgCalories,
      avgSleep: avgSleep ? parseFloat(avgSleep) : null,
      daysTracked: historical.length,
      workoutDays
    }
  };
}

/**
 * Generate medication-based tasks from user's medication list
 */
function generateMedicationTasks(medications) {
  if (!medications || medications.length === 0) return [];
  
  const tasks = [];
  medications.forEach((med, idx) => {
    if (!med.isActive && med.isActive !== undefined) return;
    
    const timeMapping = {
      morning: '8:00 AM',
      afternoon: '12:00 PM',
      evening: '6:00 PM',
      night: '9:00 PM',
      with_meals: 'With meals'
    };
    
    const times = med.timeOfDay || ['morning'];
    const scheduledTime = times.map(t => timeMapping[t] || t).join(', ');
    
    tasks.push({
      id: `med_${idx}`,
      title: `Take ${med.name}`,
      description: `${med.dosage || ''} ${med.dosageUnit || ''} - ${med.purpose || 'as prescribed'}`,
      category: 'medication',
      scheduledTime,
      isCompleted: false,
      dataSource: `medication_${idx}`
    });
  });
  
  return tasks;
}

/**
 * Generate condition-specific tasks
 */
function generateConditionTasks(conditions) {
  if (!conditions || conditions.length === 0) return [];
  
  const tasks = [];
  const conditionTaskMap = {
    'diabetes': [
      { title: 'Check blood sugar', category: 'monitoring', time: '7:00 AM' },
      { title: 'Walk after meals', category: 'exercise', time: 'After meals' }
    ],
    'hypertension': [
      { title: 'Check blood pressure', category: 'monitoring', time: '8:00 AM' },
      { title: 'Low sodium lunch', category: 'nutrition', time: '12:00 PM' }
    ],
    'high blood pressure': [
      { title: 'Check blood pressure', category: 'monitoring', time: '8:00 AM' },
      { title: 'Reduce sodium intake', category: 'nutrition', time: 'Throughout day' }
    ],
    'anxiety': [
      { title: '5 min breathing exercise', category: 'sleep', time: 'Morning' },
      { title: 'Gratitude journaling', category: 'monitoring', time: '9:00 PM' }
    ],
    'depression': [
      { title: 'Morning sunlight', category: 'exercise', time: '8:00 AM' },
      { title: 'Connect with someone', category: 'monitoring', time: 'Afternoon' }
    ],
    'insomnia': [
      { title: 'No caffeine after 2pm', category: 'nutrition', time: '2:00 PM' },
      { title: 'Wind down routine', category: 'sleep', time: '9:00 PM' }
    ],
    'back pain': [
      { title: 'Gentle stretches', category: 'exercise', time: '8:00 AM' },
      { title: 'Posture check', category: 'monitoring', time: 'Every 2 hours' }
    ]
  };

  conditions.forEach((condition, idx) => {
    const name = condition.name?.toLowerCase() || '';
    
    Object.keys(conditionTaskMap).forEach(key => {
      if (name.includes(key)) {
        conditionTaskMap[key].forEach((task, taskIdx) => {
          tasks.push({
            id: `cond_${idx}_${taskIdx}`,
            title: task.title,
            description: `For managing ${condition.name}`,
            category: task.category,
            scheduledTime: task.time,
            isCompleted: false,
            dataSource: `condition_${idx}`
          });
        });
      }
    });
  });
  
  return tasks;
}

// Checklist agent prompt - concise and data-driven
const CHECKLIST_PROMPT = `You are a task generator. Create 6-8 personalized daily tasks.

== RULES ==
• Task titles: 3-5 words max (e.g., "Walk 8,000 steps")
• Categories: nutrition, exercise, sleep, monitoring, medication
• Use ACTUAL numbers from user data
• Descriptions explain WHY briefly (e.g., "Your avg is 6,500 - working toward 10K goal")
• Be concise - no long explanations

== OUTPUT (JSON only) ==
{
  "tasks": [
    {"id": "1", "title": "Walk 8,000 steps", "description": "Your avg is 6,500 - toward your 10K goal", "category": "exercise", "scheduledTime": "Throughout day", "isCompleted": false},
    {"id": "2", "title": "Take Metformin", "description": "Morning dose with breakfast", "category": "medication", "scheduledTime": "8:00 AM", "isCompleted": false}
  ]
}`;

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userContext, userId } = req.body;

    // Fetch comprehensive user data from Supabase if userId provided
    let comprehensiveContext = userContext || '';
    let rawData = null;
    let predefinedTasks = [];

    if (userId) {
      console.log('📊 Fetching comprehensive data for user:', userId);
      
      const contextResult = await getUserContext(userId);
      
      if (contextResult.success) {
        comprehensiveContext = contextResult.context;
        rawData = contextResult.rawData;
        
        console.log('✅ Loaded user context with', contextResult.citations?.length || 0, 'data points');
        
        // Analyze historical trends
        const trendAnalysis = analyzeHistoricalTrends(rawData?.historical || []);
        if (trendAnalysis.analysis) {
          comprehensiveContext += `\n\n== TREND ANALYSIS ==\n${trendAnalysis.analysis}`;
        }
        
        // Generate medication tasks from actual data
        if (rawData?.onboarding?.comprehensive_data?.medications) {
          predefinedTasks.push(...generateMedicationTasks(rawData.onboarding.comprehensive_data.medications));
        }
        
        // Generate condition-specific tasks
        if (rawData?.onboarding?.comprehensive_data?.medicalConditions) {
          predefinedTasks.push(...generateConditionTasks(rawData.onboarding.comprehensive_data.medicalConditions));
        }
        
        console.log('📋 Generated', predefinedTasks.length, 'predefined tasks from user data');
      }
    }

    if (!comprehensiveContext && !userContext) {
      return res.status(400).json({ error: 'User context or userId is required' });
    }

    // Check if API key is configured
    if (!API_KEY) {
      console.log('⚠️ API key not configured, returning predefined + fallback tasks');
      return res.json({ 
        tasks: [...predefinedTasks, ...FALLBACK_TASKS].slice(0, 7),
        source: 'predefined+fallback',
        message: 'Using predefined tasks from user data - configure OPENAI_API_KEY for AI-enhanced checklists'
      });
    }

    console.log('🤖 Generating personalized daily checklist...');

    // Build the prompt with predefined tasks as context
    let taskContext = '';
    if (predefinedTasks.length > 0) {
      taskContext = `\n\n== MEDICATION & CONDITION TASKS (include these) ==\n${JSON.stringify(predefinedTasks, null, 2)}`;
    }

    // Prepare messages for AI
    const openaiMessages = [
      { 
        role: 'system', 
        content: CHECKLIST_PROMPT 
      },
      { 
        role: 'user', 
        content: `Create 6-8 personalized tasks based on this data. Use actual numbers. Be concise.

${comprehensiveContext}
${taskContext}

Return ONLY valid JSON.` 
      }
    ];

    // Build headers based on provider
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };
    
    if (isOpenRouter) {
      headers['HTTP-Referer'] = 'https://soma-eight.vercel.app';
      headers['X-Title'] = 'Soma Health App';
    }

    // Call AI API
    const response = await axios.post(API_URL, {
      model: isOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 1200
    }, { headers });

    console.log('✅ Checklist generated successfully');
    
    const responseContent = response.data.choices[0].message.content;
    
    // Try to parse the JSON response
    try {
      // Clean up potential markdown code blocks
      let cleanContent = responseContent;
      if (cleanContent.includes('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanContent.includes('```')) {
        cleanContent = cleanContent.replace(/```\n?/g, '');
      }
      
      const checklistData = JSON.parse(cleanContent.trim());
      
      // Add source information
      checklistData.source = 'ai_generated';
      checklistData.generatedAt = new Date().toISOString();
      checklistData.userId = userId;
      
      res.json(checklistData);
    } catch (parseError) {
      console.error('❌ Failed to parse checklist JSON:', parseError.message);
      console.log('Raw response:', responseContent);
      
      // Fall back to predefined tasks plus fallback
      res.json({
        tasks: [...predefinedTasks, ...FALLBACK_TASKS].slice(0, 7),
        source: 'predefined+fallback',
        parseError: true,
        message: 'Using predefined tasks due to AI formatting issue'
      });
    }

  } catch (error) {
    console.error('❌ Checklist generation error:', error.response?.data || error.message);
    
    // Return fallback tasks instead of error
    console.log('📋 Returning fallback tasks due to API error');
    res.json({ 
      tasks: FALLBACK_TASKS,
      source: 'fallback',
      message: 'Using default tasks due to temporary service issue'
    });
  }
};
