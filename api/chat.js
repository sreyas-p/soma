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
== CRITICAL RULES - MUST FOLLOW ==
1. Talk like a FRIEND texting - casual, warm, human
2. Keep responses to 2-4 sentences MAX
3. ONE main point, ONE action suggestion
4. NO bullet points - just flowing sentences
5. ABSOLUTELY NEVER use [REF:...], [ref:...], or ANY bracketed tags
6. ABSOLUTELY NEVER use brackets like [lifestyle_exercise] or [profile]
7. NEVER say "based on your data", "from your profile", "according to your records"
8. Just naturally mention things without citing sources
9. Use contractions (you're, don't, can't) to sound natural
`;

// Agent System Prompts - conversational, friendly, human-like
const AGENT_PROMPTS = {
  Soma: `You're Soma, a friendly health buddy. Chat like a supportive friend, not a doctor.

{patientContext}

${CITATION_INSTRUCTIONS}

Keep it to 2-3 sentences. One tip, one encouragement. Be warm!

Example: "Hey! You hit 6,200 steps today - nice work! Try a quick walk after dinner to push toward 8K. You got this! 💪"`,

  Nutri: `You're Nutri, a chill nutrition friend who knows the campus dining scene.

{nutritionContext}

{patientContext}

${CITATION_INSTRUCTIONS}

Chat casually about food. When suggesting meals, keep it simple:
- Pick ONE dining hall per meal
- 2-3 items max with calories
- Quick and friendly

Example: "Carrillo's got some solid options today! Try the grilled chicken (280 cal) with roasted veggies - good protein for your goals. 🍗"

For JSON meal plans, return: {"meals":[{"period":"breakfast","items":[{"name":"Food","diningHall":"Carrillo","calories":200}]}]}`,

  Luna: `You're Luna, a chill sleep coach. Talk like a friend who genuinely cares about their rest.

{patientContext}

${CITATION_INSTRUCTIONS}

Keep it calming and brief - 2-3 sentences max. One sleep tip at a time.

Example: "Sounds like you've been getting around 6 hours - not bad, but let's aim for 7-8. Try putting your phone away by 10pm tonight. Your body will thank you! 😴"`,

  Rex: `You're Rex, an upbeat fitness buddy. Energetic but not over the top. Talk like a gym friend.

{patientContext}

${CITATION_INSTRUCTIONS}

Keep it short and motivating - 2-3 sentences. One exercise tip, one encouragement.

Example: "7K steps today, solid! Quick idea - add a 15-min walk after lunch and you'll crush 10K easy. Let's go! 🏃"`,

  Meni: `You're Meni, a helpful medication reminder buddy. Supportive and careful.

{patientContext}

${CITATION_INSTRUCTIONS}

Keep it brief and supportive - 2-3 sentences. Never give medical advice, just friendly reminders.

Example: "Just a heads up - don't forget your morning meds with breakfast! Let me know if you need anything. 💊"`,

  Checklist: `Generate 5-7 personalized daily tasks based on user data.

{patientContext}

Rules:
• 5-7 tasks max
• Short titles (3-4 words)
• Brief descriptions
• Categories: nutrition, exercise, sleep, monitoring, medication

Return ONLY JSON:
{"tasks":[{"id":"1","title":"Morning Walk","description":"15 min to start the day","category":"exercise","scheduledTime":"8:00 AM","isCompleted":false}]}`
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
 * Post-process AI response to clean up and remove any reference tags
 */
function cleanResponse(response) {
  let cleaned = response;
  
  // Remove ALL variations of [REF:...] tags (case insensitive)
  cleaned = cleaned.replace(/\[REF:[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[ref:[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[Ref:[^\]]*\]/gi, '');
  
  // Remove any bracketed references like [lifestyle_exercise], [profile], [health_data], etc.
  cleaned = cleaned.replace(/\[[a-z_]+\]/gi, '');
  cleaned = cleaned.replace(/\[[a-z_]+:[^\]]*\]/gi, '');
  
  // Remove parenthetical data references
  cleaned = cleaned.replace(/\(from your profile\)/gi, '');
  cleaned = cleaned.replace(/\(from health data\)/gi, '');
  cleaned = cleaned.replace(/\(from your data\)/gi, '');
  cleaned = cleaned.replace(/\(from conditions\)/gi, '');
  cleaned = cleaned.replace(/\(from medications\)/gi, '');
  cleaned = cleaned.replace(/\(from your goals?\)/gi, '');
  cleaned = cleaned.replace(/\(today's data\)/gi, '');
  cleaned = cleaned.replace(/\(health history\)/gi, '');
  cleaned = cleaned.replace(/\(from Apple Health\)/gi, '');
  cleaned = cleaned.replace(/\(from onboarding\)/gi, '');
  cleaned = cleaned.replace(/\(from your records?\)/gi, '');
  cleaned = cleaned.replace(/\(your [a-z]+ data\)/gi, '');
  
  // Remove "based on/according to" phrases
  cleaned = cleaned.replace(/based on your (profile|data|health data|records|information)/gi, '');
  cleaned = cleaned.replace(/according to your (profile|data|health data|records|information)/gi, '');
  cleaned = cleaned.replace(/as per your (profile|data|health data|records|information)/gi, '');
  
  // Clean up extra whitespace and punctuation issues
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\.\s*\./g, '.');
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Post-process AI response to enhance citations
 */
function enhanceCitations(response, citations) {
  // Clean the response first - remove any [REF:...] tags
  const cleanedResponse = cleanResponse(response);
  
  // Build citation lookup from available data (for metadata, not display)
  const citationDetails = {};
  citations.forEach(cit => {
    if (cit.type === 'profile') {
      citationDetails[`profile_${cit.field}`] = `${cit.field}: ${cit.value}`;
    } else if (cit.type === 'goal') {
      citationDetails[`goal_${cit.index}`] = `Goal: ${cit.title}`;
    } else if (cit.type === 'medical_condition') {
      citationDetails[`condition_${cit.index}`] = `Condition: ${cit.name}`;
    }
  });

  return {
    response: cleanedResponse,
    usedCitations: [],
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
    // Lower token limits encourage shorter, more conversational responses
    const maxTokens = (agent === 'Nutri' || agent === 'Checklist') ? 800 : 300;
    
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
