module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Soma AI Agents API',
    version: '1.0.0',
    availableAgents: ['Nutri', 'Luna', 'Rex', 'Meni', 'Checklist']
  });
};
