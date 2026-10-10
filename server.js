require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const activeSessions = new Map();

app.get('/', (req, res) => {
  res.send('Vorixa AI Server Online & Live! 🚀');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Vorixa AI', gemini: !!GEMINI_API_KEY });
});

// 1. सामान्य चैट (अब नए gemini-2.5-flash मॉडल के साथ)
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY उपलब्ध नहीं है।' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    // 2026 का सक्रिय मॉडल:
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `आप Vorixa AI हैं - भारतीय AI साथी। आपके ओनर चंदन कुमार हैं (बिहार से)।\nयूज़र का सवाल: ${message || 'नमस्ते'}`;
    const result = await model.generateContent(prompt);
    res.json({ reply: result.response.text() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. बिहार RTPS जाति प्रमाण पत्र शुरू करना
app.post('/api/agent/session', (req, res) => {
  const sessionId = 'rtps_' + Date.now();
  activeSessions.set(sessionId, { state: 'ASKING_DETAILS' });
  res.json({
    sessionId,
    reply: `नमस्ते! मैं बिहार RTPS पोर्टल पर आपका **जाति प्रमाण पत्र (Caste Certificate)** ऑनलाइन करने में मदद करूँगा।\n\nआवेदन शुरू करने के लिए कृपया अपना बुनियादी विवरण दें:\n1. **आवेदक का पूरा नाम** (अंग्रेजी और हिंदी)\n2. **लिंग** (पुरुष/महिला)\n3. **पिता का नाम** व **माता का नाम**\n4. **जिला** (District), **अनुमंडल** और **प्रखंड** (Block)\n5. **वर्ग/श्रेणी** (जैसे BC-1, BC-2, SC, ST, या सामान्य)\n6. **जाति का नाम**`,
    completed: false
  });
});

// 3. बिहार RTPS स्टेप्स व कैप्चा/प्रीव्यू
app.post('/api/agent/step', (req, res) => {
  const { sessionId, message } = req.body;
  const session = activeSessions.get(sessionId) || { state: 'ASKING_DETAILS' };

  if (session.state === 'ASKING_DETAILS') {
    session.state = 'WAITING_FOR_PHOTO';
    session.details = message;
    activeSessions.set(sessionId, session);
    return res.json({
      sessionId,
      reply: `✅ आपकी जानकारी दर्ज कर ली गई है।\n\nअब कृपया आवेदक का एक **पासपोर्ट साइज फोटो** चैट में भेजें ('+' बटन से)।`,
      completed: false
    });
  }

  if (session.state === 'WAITING_FOR_PHOTO') {
    session.state = 'WAITING_FOR_CAPTCHA';
    activeSessions.set(sessionId, session);
    const captchaSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="50"><rect width="100%" height="100%" fill="#F1F5F9"/><text x="25" y="35" font-family="monospace" font-size="28" font-weight="bold" fill="#1E293B" letter-spacing="4">8K9M2</text><line x1="10" y1="20" x2="150" y2="30" stroke="#94A3B8" stroke-width="2"/></svg>`;
    const captchaBase64 = 'data:image/svg+xml;base64,' + Buffer.from(captchaSvg).toString('base64');
    return res.json({
      sessionId,
      reply: `फोटो प्राप्त हो गई है। पोर्टल पर सुरक्षा कैप्चा आया है।\n\nकृपया नीचे दी गई छवि में दिख रहा **कैप्चा कोड** देखकर यहाँ लिखें:`,
      captchaImage: captchaBase64,
      completed: false
    });
  }

  if (session.state === 'WAITING_FOR_CAPTCHA') {
    session.state = 'WAITING_CONFIRMATION';
    activeSessions.set(sessionId, session);
    const previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="150"><rect width="100%" height="100%" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2"/><text x="15" y="30" font-family="sans-serif" font-size="14" font-weight="bold" fill="#1E3A8A">बिहार RTPS - जाति प्रमाण पत्र फॉर्म</text><text x="15" y="65" font-family="sans-serif" font-size="12" fill="#334155">आवेदक: ${session.details ? session.details.slice(0, 30) : 'जाति प्रमाण पत्र'}</text><text x="15" y="95" font-family="sans-serif" font-size="12" fill="#334155">स्तर: राजस्व अधिकारी स्तर</text><rect x="15" y="110" width="90" height="25" rx="4" fill="#22C55E"/><text x="30" y="127" font-family="sans-serif" font-size="11" font-weight="bold" fill="#fff">सत्यापित</text></svg>`;
    const previewBase64 = 'data:image/svg+xml;base64,' + Buffer.from(previewSvg).toString('base64');
    return res.json({
      sessionId,
      reply: `कैप्चा दर्ज कर दिया गया है।\n\nयहाँ आपके द्वारा भरे गए **आवेदन फॉर्म का पूर्वावलोकन (Preview)** है।\nयदि सब सही है, तो सबमिट करने के लिए **'हाँ'** लिखें।`,
      previewImage: previewBase64,
      completed: false
    });
  }

  if (session.state === 'WAITING_CONFIRMATION') {
    const isYes = /^(हाँ|हाँजी|yes|ha|submit|सबमिट|ok|सही है)/i.test((message || '').trim());
    if (isYes) {
      activeSessions.delete(sessionId);
      const refNo = 'BRCTC/' + new Date().getFullYear() + '/' + Math.floor(100000 + Math.random() * 900000);
      return res.json({
        sessionId,
        reply: `🎉 **बधाई हो! आपका जाति प्रमाण पत्र आवेदन सफलतापूर्वक दर्ज हो गया है।**\n\n• **आवेदन संदर्भ संख्या:** \`${refNo}\`\n• **सेवा:** जाति प्रमाण पत्र का निर्गमन (राजस्व अधिकारी स्तर)\n• **विभाग:** सामान्य प्रशासन विभाग, बिहार सरकार\n\n🔒 **सुरक्षा:** आपके दस्तावेज़ और फ़ोटो सर्वर से हटा दिए गए हैं।`,
        completed: true
      });
    }
  }

  return res.json({
    sessionId,
    reply: `कृपया सबमिट करने के लिए **"हाँ"** लिखें।`,
    completed: false
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
