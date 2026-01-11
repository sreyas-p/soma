const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { getUserContext, extractAndSaveInsights } = require('./user-context');

// API configuration - supports both OpenAI and OpenRouter
const API_KEY = process.env.OPENAI_API_KEY;

// Supabase configuration for direct queries
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://rzgynrkidzsafmcfhnod.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z3lucmtpZHpzYWZtY2Zobm9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3Mjk0MzIsImV4cCI6MjA4MzMwNTQzMn0.mc_L3r5qPGDSJIZ1STvHcJCwiLtyntwU_U41XbzdrQw';
const supabase = createClient(supabaseUrl, supabaseKey);

// Load UCSB Dining Hall Nutrition Data
let NUTRITION_DATA = null;
let NUTRITION_CONTEXT = '';

try {
  const nutritionPath = path.join(__dirname, '..', 'nutrition.json');
  if (fs.existsSync(nutritionPath)) {
    const rawData = fs.readFileSync(nutritionPath, 'utf8');
    NUTRITION_DATA = JSON.parse(rawData);
    
    // Format nutrition data for the AI prompt
    NUTRITION_CONTEXT = formatNutritionContext(NUTRITION_DATA);
    console.log('✅ Loaded UCSB nutrition data:', NUTRITION_DATA.items?.length || 0, 'items');
  }
} catch (e) {
  console.log('⚠️ Could not load nutrition.json:', e.message);
}

// Format nutrition data into a context string for the AI
function formatNutritionContext(data) {
  if (!data || !data.items || data.items.length === 0) {
    return '';
  }
  
  // Group items by dining hall and meal
  const byHallAndMeal = {};
  data.items.forEach(item => {
    const key = `${item.dining_hall}|${item.meal}`;
    if (!byHallAndMeal[key]) {
      byHallAndMeal[key] = [];
    }
    byHallAndMeal[key].push(item);
  });
  
  let context = `\n== TODAY'S UCSB DINING MENU (${data.date}) ==\n`;
  context += `Source: ${data.source}\n`;
  context += `Note: ${data.disclaimer}\n\n`;
  
  // Format each dining hall and meal
  Object.keys(byHallAndMeal).sort().forEach(key => {
    const [hall, meal] = key.split('|');
    const items = byHallAndMeal[key];
    
    context += `**${hall} - ${meal}:**\n`;
    items.forEach(item => {
      const tags = item.dietary_tags?.length > 0 ? ` [${item.dietary_tags.join(', ')}]` : '';
      const nutrition = item.nutrition_facts;
      context += `• ${item.name} (${item.serving_size})${tags} - ${nutrition.calories} cal, ${nutrition.protein_g}g protein, ${nutrition.total_carbs_g}g carbs, ${nutrition.total_fat_g}g fat\n`;
    });
    context += '\n';
  });
  
  return context;
}

// Export for use in other modules if needed
const getNutritionContext = () => NUTRITION_CONTEXT;
const getNutritionData = () => NUTRITION_DATA;

// Detect if using OpenRouter (keys start with sk-or-) or OpenAI
const isOpenRouter = API_KEY && API_KEY.startsWith('sk-or-');
const API_URL = isOpenRouter 
  ? 'https://openrouter.ai/api/v1/chat/completions'
  : 'https://api.openai.com/v1/chat/completions';

// Citation instruction to append to all prompts - cleaner, more readable format
const CITATION_INSTRUCTIONS = `
== RESPONSE STYLE ==
• Be CONCISE - 2-3 sentences max per point
• Be SPECIFIC - use actual numbers from user data
• Be ACTIONABLE - give clear next steps

== DATA REFERENCES ==
When using user data, naturally weave it into your response:
• "Your 6,500 daily steps (from health data) is good - let's aim for 8K today"
• "Since you're working on weight loss (your goal), I suggest..."
• "Given your high blood pressure (from conditions), avoid high-sodium foods"

Keep references SHORT and NATURAL - don't use technical tags like [REF:...].
Instead, use parenthetical notes: (from your profile), (today's data), (your goal), (health history)

If asked "why this recommendation?", explain the specific data that informed it.
`;

// Agent System Prompts - concise, data-driven, specific
const AGENT_PROMPTS = {
  Soma: `You are **Soma**, a health assistant. Be concise, specific, and data-driven.

== YOUR DATA ==
{patientContext}

${CITATION_INSTRUCTIONS}

== RULES ==
• Keep responses SHORT (3-5 sentences max)
• Use SPECIFIC numbers from the user's data
• Give 1-2 actionable steps, not long lists
• Never diagnose or prescribe - guide only
• For emergencies: call 911. Mental health crisis: call/text 988

== EXAMPLE RESPONSE ==
"Hi [Name]! Your 6,200 steps today (from health data) is solid. To hit your 10K goal, try a 20-min evening walk. Your sleep averaged 6.5 hrs this week - aim for bed by 10:30pm tonight."`,

  Nutri: `You are **Nutri**, a campus nutrition buddy. Be friendly, concise, and specific.

== RULES ==
• ONE dining hall per meal (don't make students walk between halls!)
• Use ONLY foods from today's menu below
• Check allergies before suggesting foods (from user data)
• 2-4 items per meal with calories

{nutritionContext}

== USER DATA ==
{patientContext}

${CITATION_INSTRUCTIONS}

== RESPONSE FORMAT ==
Keep it short! Example:
"🌅 **Breakfast @ Carrillo** (high protein for your muscle goal)
• Scrambled Eggs - 180 cal, 12g protein
• Wheat Toast - 140 cal
• Fruit Cup - 60 cal
**Total: ~380 cal**"

== JSON (when requested) ==
{"meals":[{"period":"breakfast","items":[{"name":"Food","diningHall":"Carrillo","calories":200,"protein":10}]}]}`,

  Luna: `You are **Luna**, a sleep specialist. Be calm, concise, and data-driven.

== USER DATA ==
{patientContext}

${CITATION_INSTRUCTIONS}

== RULES ==
• Keep responses SHORT (3-5 sentences)
• Reference their actual sleep data (hours, quality from health data)
• Give 1-2 specific bedtime tips
• Consider their stress level, caffeine, exercise habits
• Never diagnose sleep disorders - suggest seeing a doctor if needed

== EXAMPLE ==
"You averaged 6.2 hrs sleep this week (from health data) - below your 8hr goal. Tonight: no screens after 9:30pm, try the 4-7-8 breathing technique. Your stress level is high (from profile) - a 5-min wind-down routine could help."`,

  Rex: `You are **Rex**, a fitness coach. Be energetic, concise, and safe.

== USER DATA ==
{patientContext}

${CITATION_INSTRUCTIONS}

== RULES ==
• Keep responses SHORT (3-5 sentences)
• Use their actual step count, workout data
• Check for injuries/conditions before suggesting exercises
• Match intensity to their fitness level (from profile)
• Stop immediately if: chest pain, dizziness, severe pain → call 911

== EXAMPLE ==
"Nice! 7,200 steps today (from health data). For your weight loss goal, add a 20-min brisk walk after dinner - that'll get you to 9K. Since you mentioned knee issues (from conditions), stick to low-impact: walking, swimming, or cycling."`,

  Meni: `You are **Meni**, a medication & monitoring assistant. Be careful, concise, and supportive.

== USER DATA ==
{patientContext}

${CITATION_INSTRUCTIONS}

== RULES ==
• Keep responses SHORT (3-5 sentences)
• Reference their actual medications and dosages
• Check allergies before any suggestion
• NEVER change medication advice - always defer to their doctor
• For side effects or concerns → contact their doctor

== EXAMPLE ==
"Reminder: Metformin 500mg (from your medications) - take with breakfast to reduce stomach upset. Your heart rate averaged 78 BPM this week (from health data) - looking stable. Any side effects? Let your doctor know at your next visit."`,

  Checklist: `You are **Checklist**, a task generator. Create 5-7 personalized daily tasks.

== USER DATA ==
{patientContext}

== RULES ==
• 5-7 tasks only
• Task titles: 3-4 words max
• Categories: nutrition, exercise, sleep, monitoring, medication
• Base tasks on their ACTUAL data (goals, conditions, medications, health metrics)
• Descriptions should explain WHY (e.g., "supports your weight loss goal")

== OUTPUT (JSON only) ==
{
  "tasks": [
    {"id": "1", "title": "Take Metformin", "description": "Morning dose with breakfast", "category": "medication", "scheduledTime": "8:00 AM", "isCompleted": false},
    {"id": "2", "title": "Walk 8,000 steps", "description": "Your avg is 6,500 - working toward 10K goal", "category": "exercise", "scheduledTime": "Throughout day", "isCompleted": false},
    {"id": "3", "title": "Drink 8 glasses water", "description": "Stay hydrated for your workouts", "category": "nutrition", "scheduledTime": "Throughout day", "isCompleted": false}
  ]
}`
};

/**
 * Get comprehensive patient context for an agent
 * This fetches real data from Supabase and formats it for the AI
 */
async function getPatientContext(userId, agentType) {
  if (!userId) {
    console.log('No userId provided, using default context');
    return {
      context: 'No user data available. Please ask clarifying questions to understand the user\'s health situation.',
      citations: []
    };
  }

  try {
    const result = await getUserContext(userId);
    
    if (!result.success || !result.context) {
      console.log('Failed to fetch user context:', result.error);
      return {
        context: 'Limited user data available. Ask clarifying questions to personalize recommendations.',
        citations: []
      };
    }

    console.log(`✅ Loaded comprehensive context for user ${userId} (${result.citations?.length || 0} data points)`);
    
    return {
      context: result.context,
      citations: result.citations || [],
      rawData: result.rawData
    };
  } catch (error) {
    console.error('Error fetching patient context:', error);
    return {
      context: 'Error loading user data. Please provide information about your health situation.',
      citations: []
    };
  }
}

/**
 * Post-process AI response to enhance citations
 */
function enhanceCitations(response, citations) {
  // Find all [REF:...] tags in the response
  const refPattern = /\[REF:([^\]]+)\]/g;
  const usedRefs = [];
  let match;
  
  while ((match = refPattern.exec(response)) !== null) {
    usedRefs.push(match[1]);
  }

  // Build citation lookup from available data
  const citationDetails = {};
  citations.forEach(cit => {
    if (cit.type === 'profile') {
      citationDetails[`profile_${cit.field}`] = `From your profile: ${cit.field} = ${cit.value}`;
    } else if (cit.type === 'health_steps' || cit.type === 'health_calories' || cit.type === 'health_hr') {
      citationDetails[`${cit.type}:${cit.date}`] = `From Apple Health (${cit.date}): ${cit.value} ${cit.unit}`;
    } else if (cit.type === 'goal') {
      citationDetails[`goal_${cit.index}`] = `Your goal: ${cit.title}${cit.target ? ` (target: ${cit.target} ${cit.unit || ''})` : ''}`;
    } else if (cit.type === 'medical_condition') {
      citationDetails[`condition_${cit.index}`] = `Condition: ${cit.name} (${cit.severity}, ${cit.status})`;
    } else if (cit.type === 'medication') {
      citationDetails[`medication_${cit.index}`] = `Medication: ${cit.name} ${cit.dosage || ''} ${cit.frequency || ''}`;
    } else if (cit.type === 'allergy') {
      citationDetails[`allergy_${cit.index}`] = `Allergy: ${cit.allergen} (${cit.severity})`;
    } else if (cit.type === 'trend') {
      citationDetails[`trend_${cit.metric}_avg`] = `${cit.period.replace('_', ' ')} average ${cit.metric}: ${cit.value}`;
    }
  });

  return {
    response,
    usedCitations: usedRefs,
    citationDetails
  };
}

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
    const { agent, messages, userContext, userId } = req.body;

    if (!agent || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get agent-specific prompt
    const basePrompt = AGENT_PROMPTS[agent];
    if (!basePrompt) {
      return res.status(400).json({ error: 'Unknown agent' });
    }

    // Get comprehensive patient context from Supabase
    const patientData = await getPatientContext(userId, agent);
    
    // Combine database context with any additional context from frontend
    let combinedContext = patientData.context;
    if (userContext && userContext.trim()) {
      combinedContext = `${patientData.context}\n\n== ADDITIONAL CONTEXT FROM SESSION ==\n${userContext}`;
    }
    
    // Build system prompt with context replacements
    let systemPrompt = basePrompt.replace('{patientContext}', combinedContext);
    
    // For Nutri agent, inject the nutrition/dining hall menu data
    if (agent === 'Nutri' && NUTRITION_CONTEXT) {
      systemPrompt = systemPrompt.replace('{nutritionContext}', NUTRITION_CONTEXT);
    } else {
      systemPrompt = systemPrompt.replace('{nutritionContext}', '');
    }

    console.log(`🤖 Sending request to ${isOpenRouter ? 'OpenRouter' : 'OpenAI'} for agent: ${agent}`);
    console.log(`📊 User context: ${patientData.citations?.length || 0} data points`);
    console.log(`👤 User ID: ${userId || 'none'}`);

    // Prepare messages for OpenAI
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Build headers based on provider
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // Add OpenRouter-specific headers if using OpenRouter
    if (isOpenRouter) {
      headers['HTTP-Referer'] = 'https://soma-eight.vercel.app';
      headers['X-Title'] = 'Soma Health App';
    }

    // Call AI API (OpenAI or OpenRouter)
    // Use higher token limit for agents that need more context
    const maxTokens = (agent === 'Nutri' || agent === 'Checklist') ? 1500 : 800;
    
    const response = await axios.post(API_URL, {
      model: isOpenRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: maxTokens
    }, { headers });

    console.log('✅ AI API response received successfully');
    
    const responseContent = response.data.choices[0].message.content;
    
    // Enhance response with citation details
    const enhanced = enhanceCitations(responseContent, patientData.citations || []);
    
    // Extract and save any new insights from the conversation (async, don't wait)
    if (userId && messages.length > 0) {
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (lastUserMessage) {
        extractAndSaveInsights(userId, lastUserMessage.content, responseContent, agent)
          .catch(err => console.error('Error extracting insights:', err));
      }
    }

    res.json({
      choices: [{
        message: {
          role: 'assistant',
          content: enhanced.response
        }
      }],
      // Include citation metadata for the frontend
      metadata: {
        citations: enhanced.usedCitations,
        citationDetails: enhanced.citationDetails,
        dataPointsUsed: patientData.citations?.length || 0
      }
    });

  } catch (error) {
    console.error('❌ AI API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get response from AI agent',
      details: error.response?.data || error.message 
    });
  }
};

// Export helper functions
module.exports.getPatientContext = getPatientContext;
module.exports.getNutritionContext = getNutritionContext;
module.exports.getNutritionData = getNutritionData;
