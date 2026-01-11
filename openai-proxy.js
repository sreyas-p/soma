const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const EHRProcessor = require('./ehr-processor');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize EHR processor
let ehrProcessor = null;
let patientData = null;

// Load and process EHR data on startup
async function initializeEHRData() {
  try {
    console.log('🏥 Initializing EHR data...');
    ehrProcessor = new EHRProcessor();
    
    const loaded = ehrProcessor.loadEHRData('./ehr.json');
    if (!loaded) {
      console.log('⚠️ Could not load EHR data, agents will work without patient context');
      return;
    }

    const processed = ehrProcessor.processEHRData();
    if (processed) {
      patientData = processed;
      console.log('✅ EHR data loaded and processed successfully');
      console.log('📊 Patient Summary:', patientData.summary);
    } else {
      console.log('⚠️ Could not process EHR data, agents will work without patient context');
    }
  } catch (error) {
    console.error('❌ Error initializing EHR data:', error.message);
    console.log('⚠️ Agents will work without patient context');
  }
}

/**
 * Clean AI response - remove all reference tags and formatting artifacts
 */
function cleanResponse(response) {
  let cleaned = response;
  
  // Remove ALL variations of [REF:...] tags
  cleaned = cleaned.replace(/\[REF:[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[ref:[^\]]*\]/gi, '');
  cleaned = cleaned.replace(/\[Ref:[^\]]*\]/gi, '');
  
  // Remove bracketed references like [lifestyle_exercise], [profile], etc.
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
  
  // Remove "based on/according to" phrases
  cleaned = cleaned.replace(/based on your (profile|data|health data|records|information)/gi, '');
  cleaned = cleaned.replace(/according to your (profile|data|health data|records|information)/gi, '');
  cleaned = cleaned.replace(/as per your (profile|data|health data|records|information)/gi, '');
  
  // Clean up extra whitespace and punctuation issues from removals
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\.\s*\./g, '.');
  cleaned = cleaned.trim();
  
  return cleaned;
}

// Shared response style instructions
const RESPONSE_STYLE = `
CRITICAL RULES - FOLLOW EXACTLY:
1. Talk like a FRIEND texting, not a doctor or robot
2. Keep responses to 2-4 sentences MAX
3. ONE main point, ONE action suggestion
4. NEVER use [REF:...] or any bracketed tags
5. NEVER say "based on your data" or "from your profile"
6. Just naturally mention things without citing sources
7. Use casual language and contractions (you're, don't, etc.)
8. Be warm and encouraging, not clinical
`;

// Agent System Prompts - conversational, friendly, human-like
const AGENT_PROMPTS = {
  Soma: `You're Soma, a friendly health buddy. Chat like a supportive friend.

{patientContext}

${RESPONSE_STYLE}

Keep it to 2-3 sentences. One tip, one encouragement. Be warm!

Example: "Hey! Nice job hitting those steps today! Try a quick walk after dinner to keep the momentum going. 💪"`,

  Nutri: `You're Nutri, a chill nutrition friend. Chat casually about food.

{patientContext}

${RESPONSE_STYLE}

Keep it to 2-3 sentences. Suggest one food idea. Be friendly!

Example: "Sounds good! Maybe try adding some protein to your lunch - keeps you fuller longer. Greek yogurt or grilled chicken would be perfect! 🥗"`,

  Luna: `You're Luna, a calm sleep buddy. Talk like a friend who cares about rest.

{patientContext}

${RESPONSE_STYLE}

Keep it calming and brief - 2-3 sentences. One sleep tip.

Example: "Sounds like you've been getting around 6 hours - not bad! Try putting your phone away by 10pm tonight. Your body will thank you! 😴"`,

  Rex: `You're Rex, an upbeat fitness buddy. Energetic but not over the top.

{patientContext}

${RESPONSE_STYLE}

Keep it short and motivating - 2-3 sentences. One exercise tip.

Example: "Nice work on those steps! Quick idea - add a 15-min walk after lunch and you'll crush your goal. Let's go! 🏃"`,

  Meni: `You're Meni, a helpful health reminder buddy. Supportive and careful.

{patientContext}

${RESPONSE_STYLE}

Keep it brief - 2-3 sentences. Never give medical advice, just friendly reminders.

Example: "Just a heads up - don't forget your morning routine! Let me know if you need anything. 💊"`,

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

// Function to get patient context for a specific agent
function getPatientContext(agentType) {
  if (!ehrProcessor || !patientData) {
    return 'No patient data available. Provide general guidance based on best practices.';
  }

  try {
    const context = ehrProcessor.formatForAgentPrompt(agentType);
    return context || 'Limited patient data available. Provide general guidance based on best practices.';
  } catch (error) {
    console.error('Error formatting patient context:', error.message);
    return 'Patient data processing error. Provide general guidance based on best practices.';
  }
}

// Chat endpoint for AI agents
app.post('/chat', async (req, res) => {
  try {
    const { agent, messages, userContext } = req.body;

    if (!agent || !messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get agent-specific prompt
    const basePrompt = AGENT_PROMPTS[agent];
    if (!basePrompt) {
      return res.status(400).json({ error: 'Unknown agent' });
    }

    // Get patient context for this agent
    const patientContext = getPatientContext(agent);
    
    // Combine patient context with user context for personalized responses
    let combinedContext = patientContext;
    if (userContext && userContext.trim()) {
      combinedContext = `${patientContext}\n\n${userContext}`;
    }
    
    const systemPrompt = basePrompt.replace('{patientContext}', combinedContext);

    console.log('Sending request to OpenAI for agent:', agent);
    console.log('User context provided:', !!userContext);

    // Prepare messages for OpenAI
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // Call OpenAI API - lower token limit for shorter responses
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 200
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('OpenAI API response received successfully');
    
    // Clean the response to remove any [REF:...] tags
    const rawResponse = response.data.choices[0].message.content;
    const cleanedResponse = cleanResponse(rawResponse);
    
    console.log('Response content (cleaned):', cleanedResponse);

    res.json({
      choices: [{
        message: {
          role: 'assistant',
          content: cleanedResponse
        }
      }]
    });

  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to get response from AI agent',
      details: error.response?.data || error.message 
    });
  }
});

// New endpoint for generating personalized daily checklists
app.post('/generate-checklist', async (req, res) => {
  try {
    const { userContext } = req.body;

    if (!userContext) {
      return res.status(400).json({ error: 'User context is required' });
    }

    console.log('Generating personalized daily checklist for user...');

    // Use the Checklist agent prompt
    const systemPrompt = AGENT_PROMPTS.Checklist;

    // Prepare messages for OpenAI
    const openaiMessages = [
      { 
        role: 'system', 
        content: systemPrompt 
      },
      { 
        role: 'user', 
        content: `Generate a personalized daily checklist for this user: ${userContext}` 
      }
    ];

    // Call OpenAI API
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 600
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Checklist generated successfully');
    
    const responseContent = response.data.choices[0].message.content;
    
    // Try to parse the JSON response
    try {
      const checklistData = JSON.parse(responseContent);
      res.json(checklistData);
    } catch (parseError) {
      console.error('Failed to parse checklist JSON:', parseError);
      res.json({
        tasks: [
          {
            id: "1",
            title: "Check response format",
            description: "AI response needs JSON formatting",
            category: "monitoring",
            scheduledTime: "Now",
            isCompleted: false
          }
        ],
        rawResponse: responseContent
      });
    }

  } catch (error) {
    console.error('Checklist generation error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to generate personalized checklist',
      details: error.response?.data || error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    ehrDataLoaded: !!patientData,
    availableAgents: Object.keys(AGENT_PROMPTS)
  });
});

// Patient data endpoint (for debugging)
app.get('/patient-data', (req, res) => {
  if (!patientData) {
    return res.status(404).json({ error: 'No patient data available' });
  }
  
  const { agent } = req.query;
  if (agent) {
    const context = getPatientContext(agent);
    res.json({ agent, context });
  } else {
    res.json({ 
      summary: patientData.summary,
      demographics: patientData.demographics,
      conditions: patientData.conditions?.length || 0,
      medications: patientData.medications?.length || 0,
      allergies: patientData.allergies?.length || 0
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`OpenAI proxy listening on port ${PORT}`);
  console.log(`Server accessible at:`);
  console.log(`  - Local: http://localhost:${PORT}`);
  console.log(`  - Network: http://0.0.0.0:${PORT}`);
  console.log('Available agents:', Object.keys(AGENT_PROMPTS).join(', '));
  
  // Initialize EHR data
  await initializeEHRData();
});
