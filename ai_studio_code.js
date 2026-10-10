require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { BiharRtpsAgent } = require('./agent');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const activeSessions = new Map();

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Vorixa AI Backend',
    geminiConfigured: !!GEMINI_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, files } = req.body;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY सर्वर पर उपलब्ध नहीं है।' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: `आप Vorixa AI हैं - भारतीय AI साथी। आपके ओनर चंदन कुमार हैं (बिहार से)। आप हिंदी में मदद करते हैं।`
    });

    const parts = [];
    if (files && Array.isArray(files)) {
      for (const f of files) {
        if (f.data && f.data.startsWith('data:image/')) {
          const match = f.data.match(/^data:(image\/\w+);base64,(.+)$/);
          if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }
    }
    parts.push(message || 'नमस्ते');
    const result = await model.generateContent(parts);
    return res.json({ reply: result.response.text() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/agent/session', async (req, res) => {
  try {
    const sessionId = 'rtps_' + Date.now();
    const agent = new BiharRtpsAgent(sessionId, GEMINI_API_KEY);
    activeSessions.set(sessionId, agent);
    const stepResult = await agent.handleStep(req.body.message || 'जाति प्रमाण पत्र ऑनलाइन करना है', req.body.files || []);
    return res.json({ sessionId, ...stepResult });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/agent/step', async (req, res) => {
  try {
    const { sessionId, message, files } = req.body;
    const agent = activeSessions.get(sessionId) || new BiharRtpsAgent(sessionId, GEMINI_API_KEY);
    activeSessions.set(sessionId, agent);
    const stepResult = await agent.handleStep(message || '', files || []);
    if (stepResult.completed) activeSessions.delete(sessionId);
    return res.json({ sessionId, ...stepResult });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Vorixa AI सर्वर पोर्ट ${PORT} पर चालू है!`);
});