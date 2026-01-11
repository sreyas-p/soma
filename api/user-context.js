/**
 * User Context API
 * 
 * Fetches comprehensive user data from Supabase including:
 * - Onboarding data (health profile, goals, conditions, medications)
 * - Recent health data from Apple Health
 * - Historical health trends
 * - Dynamic insights learned from chat conversations
 * 
 * This context is injected into all AI agent prompts for personalized,
 * data-backed responses.
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://rzgynrkidzsafmcfhnod.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z3lucmtpZHpzYWZtY2Zobm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Mjk0MzIsImV4cCI6MjA4MzMwNTQzMn0.mc_L3r5qPGDSJIZ1STvHcJCwiLtyntwU_U41XbzdrQw';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'Not recorded';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Format health data trends with citations
 */
function formatHealthTrends(healthData) {
  if (!healthData) return null;

  const trends = [];
  const citations = [];
  const today = new Date().toISOString().split('T')[0];
  
  if (healthData.steps !== undefined && healthData.steps > 0) {
    trends.push(`• Daily steps: ${healthData.steps.toLocaleString()}`);
    citations.push({ type: 'health_steps', date: today, value: healthData.steps, unit: 'steps' });
  }
  
  if (healthData.calories !== undefined && healthData.calories > 0) {
    trends.push(`• Active calories burned: ${Math.round(healthData.calories)} kcal`);
    citations.push({ type: 'health_calories', date: today, value: healthData.calories, unit: 'kcal' });
  }
  
  if (healthData.distance !== undefined && healthData.distance > 0) {
    const miles = (healthData.distance / 1609.34).toFixed(2);
    trends.push(`• Distance walked/ran: ${miles} miles`);
    citations.push({ type: 'health_distance', date: today, value: healthData.distance, unit: 'meters' });
  }
  
  if (healthData.heart_rate !== undefined && healthData.heart_rate !== null) {
    trends.push(`• Latest heart rate: ${healthData.heart_rate} BPM`);
    citations.push({ type: 'health_hr', date: today, value: healthData.heart_rate, unit: 'BPM' });
  }
  
  if (healthData.sleep_hours !== undefined && healthData.sleep_hours !== null) {
    trends.push(`• Sleep last night: ${healthData.sleep_hours.toFixed(1)} hours`);
    citations.push({ type: 'health_sleep', date: today, value: healthData.sleep_hours, unit: 'hours' });
  }
  
  if (healthData.weight !== undefined && healthData.weight !== null) {
    trends.push(`• Current weight: ${healthData.weight} lbs`);
    citations.push({ type: 'health_weight', date: today, value: healthData.weight, unit: 'lbs' });
  }
  
  if (healthData.workout_minutes !== undefined && healthData.workout_minutes > 0) {
    trends.push(`• Workout time (last 7 days): ${healthData.workout_minutes} min across ${healthData.workout_count || 0} sessions`);
    citations.push({ type: 'health_workout', date: today, value: healthData.workout_minutes, unit: 'minutes' });
  }
  
  if (healthData.mindfulness_minutes !== undefined && healthData.mindfulness_minutes > 0) {
    trends.push(`• Mindfulness (last 7 days): ${healthData.mindfulness_minutes} min`);
    citations.push({ type: 'health_mindfulness', date: today, value: healthData.mindfulness_minutes, unit: 'minutes' });
  }

  return { trends, citations, lastSynced: healthData.last_synced_at };
}

/**
 * Format onboarding data into context with citations
 */
function formatOnboardingContext(data) {
  if (!data) return { context: '', citations: [] };

  const sections = [];
  const citations = [];
  const comp = data.comprehensive_data || {};

  // Basic Info
  const name = data.name || comp.basicInfo?.firstName || 'User';
  const age = data.age || calculateAge(comp.basicInfo?.dateOfBirth);
  const gender = data.gender || comp.basicInfo?.biologicalSex;
  const weight = data.weight || comp.physicalMeasurements?.weight;
  const height = data.height || comp.physicalMeasurements?.height;

  sections.push(`== USER PROFILE ==`);
  sections.push(`Name: ${name}`);
  if (age) sections.push(`Age: ${age} years`);
  if (gender) sections.push(`Biological Sex: ${gender}`);
  if (weight) sections.push(`Weight: ${weight} ${comp.physicalMeasurements?.weightUnit || 'lbs'}`);
  if (height) sections.push(`Height: ${height} ${comp.physicalMeasurements?.heightUnit || 'inches'}`);
  if (comp.physicalMeasurements?.bloodType && comp.physicalMeasurements.bloodType !== 'unknown') {
    sections.push(`Blood Type: ${comp.physicalMeasurements.bloodType}`);
  }

  // Add citations for profile data
  citations.push({ type: 'profile', field: 'name', value: name });
  if (age) citations.push({ type: 'profile', field: 'age', value: age, source: 'onboarding' });
  if (gender) citations.push({ type: 'profile', field: 'gender', value: gender, source: 'onboarding' });
  if (weight) citations.push({ type: 'profile', field: 'weight', value: weight, source: 'onboarding' });
  if (height) citations.push({ type: 'profile', field: 'height', value: height, source: 'onboarding' });

  // Health Goals
  if (data.goals || comp.healthGoals?.length > 0 || comp.userGoals) {
    sections.push(`\n== HEALTH GOALS ==`);
    
    if (comp.primaryHealthFocus) {
      sections.push(`Primary Focus: ${comp.primaryHealthFocus.replace(/_/g, ' ')}`);
      citations.push({ type: 'goals', field: 'primary_focus', value: comp.primaryHealthFocus, source: 'onboarding' });
    }
    
    if (comp.userGoals?.freeFormGoals) {
      sections.push(`Goal Statement: "${comp.userGoals.freeFormGoals}"`);
      citations.push({ type: 'goals', field: 'statement', value: comp.userGoals.freeFormGoals, source: 'onboarding' });
    }
    
    if (comp.healthGoals && comp.healthGoals.length > 0) {
      comp.healthGoals.forEach((goal, idx) => {
        const target = goal.targetValue ? ` (Target: ${goal.targetValue} ${goal.targetUnit || ''})` : '';
        sections.push(`• ${goal.title}${target} [${goal.priority} priority]`);
        citations.push({ type: 'goal', index: idx, title: goal.title, target: goal.targetValue, unit: goal.targetUnit, priority: goal.priority });
      });
    }
    
    if (data.goals && typeof data.goals === 'string') {
      sections.push(`Other: ${data.goals}`);
    }
  }

  // Medical Conditions
  if (comp.hasMedicalConditions && comp.medicalConditions?.length > 0) {
    sections.push(`\n== MEDICAL CONDITIONS ==`);
    comp.medicalConditions.forEach((condition, idx) => {
      const severity = condition.severity ? ` (${condition.severity})` : '';
      const status = condition.status ? ` - ${condition.status}` : '';
      sections.push(`• ${condition.name}${severity}${status}`);
      citations.push({ type: 'medical_condition', index: idx, name: condition.name, severity: condition.severity, status: condition.status });
    });
  }

  // Medications
  if (comp.takesMedications && comp.medications?.length > 0) {
    sections.push(`\n== MEDICATIONS ==`);
    comp.medications.forEach((med, idx) => {
      const dosage = med.dosage ? ` ${med.dosage}${med.dosageUnit || ''}` : '';
      const freq = med.frequency ? ` (${med.frequency.replace(/_/g, ' ')})` : '';
      const purpose = med.purpose ? ` - ${med.purpose}` : '';
      sections.push(`• ${med.name}${dosage}${freq}${purpose}`);
      citations.push({ type: 'medication', index: idx, name: med.name, dosage: med.dosage, frequency: med.frequency, purpose: med.purpose });
    });
  }

  // Allergies
  if (comp.hasAllergies && comp.allergies?.length > 0) {
    sections.push(`\n== ALLERGIES ==`);
    comp.allergies.forEach((allergy, idx) => {
      const severity = allergy.severity ? ` [${allergy.severity.toUpperCase()}]` : '';
      sections.push(`• ${allergy.allergen} (${allergy.type})${severity}`);
      citations.push({ type: 'allergy', index: idx, allergen: allergy.allergen, allergyType: allergy.type, severity: allergy.severity });
    });
  }

  // Surgical History
  if (comp.hasSurgicalHistory && comp.surgeries?.length > 0) {
    sections.push(`\n== SURGERIES ==`);
    comp.surgeries.forEach((surgery, idx) => {
      const date = surgery.date ? ` (${formatDate(surgery.date)})` : '';
      sections.push(`• ${surgery.name}${date}`);
      citations.push({ type: 'surgery', index: idx, name: surgery.name, date: surgery.date, status: surgery.currentStatus });
    });
  }

  // Current Treatment
  if (comp.isReceivingTreatment && comp.currentTreatment) {
    sections.push(`\n== CURRENT TREATMENT ==`);
    const treatment = comp.currentTreatment;
    sections.push(`Type: ${treatment.type?.replace(/_/g, ' ')}`);
    if (treatment.description) sections.push(`Details: ${treatment.description}`);
    if (treatment.frequency) sections.push(`Frequency: ${treatment.frequency}`);
    if (treatment.goals) sections.push(`Goals: ${treatment.goals}`);
    citations.push({ type: 'treatment', ...treatment });
  }

  // Lifestyle
  if (comp.lifestyle) {
    sections.push(`\n== LIFESTYLE ==`);
    const ls = comp.lifestyle;
    if (ls.activityLevel) sections.push(`Activity: ${ls.activityLevel.replace(/_/g, ' ')}`);
    if (ls.averageSleepHours) sections.push(`Sleep: ${ls.averageSleepHours} hrs/night`);
    if (ls.dietType) sections.push(`Diet: ${ls.dietType.replace(/_/g, ' ')}`);
    if (ls.stressLevel) sections.push(`Stress: ${ls.stressLevel}/10`);
    if (ls.exerciseFrequency) sections.push(`Exercise: ${ls.exerciseFrequency}x/week`);
    citations.push({ type: 'lifestyle', ...ls });
  }

  // Family History
  if (comp.hasFamilyHistory && comp.familyHistory?.length > 0) {
    sections.push(`\n== FAMILY HISTORY ==`);
    comp.familyHistory.forEach((fh, idx) => {
      sections.push(`• ${fh.relationship}: ${fh.conditions.join(', ')}`);
      citations.push({ type: 'family_history', index: idx, relationship: fh.relationship, conditions: fh.conditions });
    });
  }

  // Care Team
  if (comp.hasExistingProviders && comp.careTeam?.length > 0) {
    sections.push(`\n== CARE TEAM ==`);
    comp.careTeam.forEach((member, idx) => {
      sections.push(`• ${member.name} (${member.role?.replace(/_/g, ' ')})`);
      citations.push({ type: 'care_team', index: idx, name: member.name, role: member.role });
    });
  }

  return { context: sections.join('\n'), citations };
}

/**
 * Format dynamic insights learned from conversations
 */
function formatDynamicInsights(insights) {
  if (!insights || insights.length === 0) return { context: '', citations: [] };

  const sections = [`\n== NOTES FROM PREVIOUS CONVERSATIONS ==`];
  const citations = [];

  insights.forEach((insight, idx) => {
    sections.push(`• ${insight.insight}`);
    citations.push({ type: 'dynamic_insight', index: idx, category: insight.category, insight: insight.insight, learnedAt: insight.learned_at });
  });

  return { context: sections.join('\n'), citations };
}

/**
 * Fetch complete user context for AI agents
 */
async function getUserContext(userId) {
  if (!userId) {
    return { success: false, error: 'No user ID provided' };
  }

  try {
    // Fetch onboarding data
    const { data: onboardingData, error: onboardingError } = await supabase
      .from('onboarding_data')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (onboardingError && onboardingError.code !== 'PGRST116') {
      console.error('Error fetching onboarding data:', onboardingError);
    }

    // Fetch health data
    const { data: healthData, error: healthError } = await supabase
      .from('health_data')
      .select('*')
      .eq('user_id', userId)
      .order('last_synced_at', { ascending: false })
      .limit(1)
      .single();

    if (healthError && healthError.code !== 'PGRST116') {
      console.error('Error fetching health data:', healthError);
    }

    // Fetch dynamic insights
    const { data: insightsData, error: insightsError } = await supabase
      .from('user_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('learned_at', { ascending: false })
      .limit(20);

    if (insightsError && insightsError.code !== 'PGRST116') {
      console.error('Error fetching insights:', insightsError);
    }

    // Fetch historical health trends (last 30 days)
    const { data: historicalData, error: histError } = await supabase
      .from('health_data_history')
      .select('*')
      .eq('user_id', userId)
      .order('data_date', { ascending: false })
      .limit(30);

    if (histError && histError.code !== 'PGRST116') {
      console.error('Error fetching historical data:', histError);
    }

    // Format all data
    const onboardingContext = formatOnboardingContext(onboardingData);
    const healthTrends = formatHealthTrends(healthData);
    const dynamicInsights = formatDynamicInsights(insightsData || []);

    // Build comprehensive context
    const contextSections = [];
    const allCitations = [...onboardingContext.citations];

    if (onboardingContext.context) {
      contextSections.push(onboardingContext.context);
    }

    if (healthTrends && healthTrends.trends.length > 0) {
      contextSections.push(`\n== RECENT HEALTH DATA (from Apple Health) ==`);
      contextSections.push(`Last synced: ${formatDate(healthTrends.lastSynced)}`);
      contextSections.push(healthTrends.trends.join('\n'));
      allCitations.push(...healthTrends.citations);
    }

    // Add historical trends analysis
    if (historicalData && historicalData.length > 0) {
      contextSections.push(`\n== HEALTH TRENDS (Last ${historicalData.length} days) ==`);
      
      // Calculate averages
      const avgSteps = Math.round(historicalData.reduce((sum, d) => sum + (d.steps || 0), 0) / historicalData.length);
      const avgCalories = Math.round(historicalData.reduce((sum, d) => sum + (d.calories || 0), 0) / historicalData.length);
      const avgSleep = historicalData.filter(d => d.sleep_hours).length > 0
        ? (historicalData.reduce((sum, d) => sum + (d.sleep_hours || 0), 0) / historicalData.filter(d => d.sleep_hours).length).toFixed(1)
        : null;

      contextSections.push(`• Avg steps (${historicalData.length} days): ${avgSteps.toLocaleString()}`);
      contextSections.push(`• Avg calories: ${avgCalories} kcal`);
      if (avgSleep) contextSections.push(`• Avg sleep: ${avgSleep} hrs`);

      allCitations.push(
        { type: 'trend', metric: 'steps', value: avgSteps, period: `${historicalData.length}_days` },
        { type: 'trend', metric: 'calories', value: avgCalories, period: `${historicalData.length}_days` }
      );
      if (avgSleep) {
        allCitations.push({ type: 'trend', metric: 'sleep', value: parseFloat(avgSleep), period: `${historicalData.length}_days` });
      }
    }

    if (dynamicInsights.context) {
      contextSections.push(dynamicInsights.context);
      allCitations.push(...dynamicInsights.citations);
    }

    const fullContext = contextSections.join('\n');

    return {
      success: true,
      context: fullContext,
      citations: allCitations,
      rawData: {
        onboarding: onboardingData,
        health: healthData,
        insights: insightsData || [],
        historical: historicalData || [],
      }
    };
  } catch (error) {
    console.error('Error in getUserContext:', error);
    return {
      success: false,
      error: error.message,
      context: '',
      citations: []
    };
  }
}

/**
 * Extract and save new insights from AI responses
 */
async function extractAndSaveInsights(userId, userMessage, aiResponse, agentName) {
  // Check if the user message contains new information to learn
  const learnablePatterns = [
    { pattern: /(?:i (?:usually|normally|always|never|often|sometimes))/i, category: 'habit' },
    { pattern: /(?:i (?:have|got|developed|was diagnosed))/i, category: 'health' },
    { pattern: /(?:my (?:doctor|therapist|dietitian) (?:said|told|recommended))/i, category: 'medical_advice' },
    { pattern: /(?:i (?:prefer|like|don't like|hate|love|enjoy))/i, category: 'preference' },
    { pattern: /(?:i'm (?:allergic|sensitive|intolerant) to)/i, category: 'allergy' },
    { pattern: /(?:i (?:can't|cannot|shouldn't) (?:eat|have|do))/i, category: 'restriction' },
    { pattern: /(?:i work (?:out|exercise))/i, category: 'exercise' },
    { pattern: /(?:i (?:sleep|wake up|go to bed))/i, category: 'sleep' },
    { pattern: /(?:i (?:eat|drink|have for (?:breakfast|lunch|dinner)))/i, category: 'nutrition' },
  ];

  const matchedPatterns = learnablePatterns.filter(p => p.pattern.test(userMessage));
  
  if (matchedPatterns.length > 0) {
    // Ask the AI to extract the insight
    const insightPrompt = `Based on the user's message: "${userMessage}"
    
Please extract any important health-related information that should be remembered for future conversations.
Return ONLY a JSON object in this format (or null if no valuable insight):
{
  "insight": "brief description of what was learned",
  "category": "${matchedPatterns[0].category}",
  "confidence": 0.8
}`;

    try {
      // This would call the AI to extract - for now, we'll save directly
      const insight = {
        user_id: userId,
        insight: `User mentioned: ${userMessage.substring(0, 200)}`,
        category: matchedPatterns[0].category,
        source_agent: agentName,
        confidence: 0.7,
        learned_at: new Date().toISOString(),
        is_active: true
      };

      const { error } = await supabase
        .from('user_insights')
        .insert(insight);

      if (error) {
        console.error('Error saving insight:', error);
      } else {
        console.log('Saved new insight:', insight.category);
      }
    } catch (error) {
      console.error('Error extracting insight:', error);
    }
  }
}

/**
 * API Handler for fetching user context
 */
module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = req.body?.userId || req.query?.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const result = await getUserContext(userId);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('User context API error:', error);
    res.status(500).json({ error: 'Failed to fetch user context' });
  }
};

// Export functions for use in other modules
module.exports.getUserContext = getUserContext;
module.exports.extractAndSaveInsights = extractAndSaveInsights;
module.exports.formatHealthTrends = formatHealthTrends;
module.exports.formatOnboardingContext = formatOnboardingContext;
