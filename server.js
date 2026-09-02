const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const StoryEngine = require('./src/story_engine');
const ttsService = require('./src/tts_service');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Robust story-assets handler supporting UTF-8 NFC/NFD and URL decoding
app.use('/story-assets', (req, res, next) => {
  try {
    const decoded = decodeURIComponent(req.path);
    const nfcPath = decoded.normalize('NFC');
    const nfdPath = decoded.normalize('NFD');

    const fullNFC = path.join(__dirname, 'assets/stories', nfcPath);
    const fullNFD = path.join(__dirname, 'assets/stories', nfdPath);

    if (fs.existsSync(fullNFC) && fs.statSync(fullNFC).isFile()) {
      return res.sendFile(fullNFC);
    }
    if (fs.existsSync(fullNFD) && fs.statSync(fullNFD).isFile()) {
      return res.sendFile(fullNFD);
    }
  } catch(e) {}
  next();
});
app.use('/story-assets', express.static(path.join(__dirname, 'assets/stories')));
app.use('/images', express.static(path.join(__dirname, '图片')));
app.use('/audio_cache', express.static(path.join(__dirname, 'public/audio_cache')));

const engine = new StoryEngine();

// Periodic session cleanup (every 30 mins, purge sessions > 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [id, sess] of engine.sessions.entries()) {
    if (sess.startTime && now - sess.startTime > 2 * 60 * 60 * 1000) {
      engine.sessions.delete(id);
    }
  }
}, 30 * 60 * 1000);

// API: Get stories
app.get('/api/stories', (req, res) => {
  try {
    const { ageGroup } = req.query;
    const stories = engine.getStories(ageGroup);
    res.json({ success: true, stories });
  } catch (err) {
    console.error('Error fetching stories:', err);
    res.json({ success: true, stories: engine.getStories() });
  }
});

// API: Get available voice personas & sample audios
app.get('/api/tts/voices', async (req, res) => {
  try {
    const voices = ttsService.getVoiceConfigs();
    const enriched = await Promise.all(voices.map(async (v) => {
      let sampleAudio = null;
      try {
        sampleAudio = await ttsService.synthesize(v.sampleText, v.id);
      } catch(e) {}
      return {
        ...v,
        sampleAudio
      };
    }));
    res.json({ success: true, voices: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Start Session
app.post('/api/session/start', async (req, res) => {
  try {
    const { storyId, ageGroup, voiceId } = req.body;
    const sessionData = await engine.startSession(storyId, ageGroup, voiceId || 'flo');
    res.json({ success: true, session: sessionData });
  } catch (err) {
    console.error('Error starting session:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Child Interaction
app.post('/api/session/interact', async (req, res) => {
  try {
    const { sessionId, userInput, storyId } = req.body;
    const cleanInput = typeof userInput === 'string' ? userInput.slice(0, 500) : '';
    const result = await engine.interact(sessionId, cleanInput, storyId);
    res.json(result);
  } catch (err) {
    console.error('Error in interaction:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get Clue
app.post('/api/session/clue', async (req, res) => {
  try {
    const { sessionId } = req.body;
    const result = await engine.getClue(sessionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: TTS on demand
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceId } = req.body;
    const cleanText = typeof text === 'string' ? text.slice(0, 300) : '';
    const audioUrl = await ttsService.synthesize(cleanText, voiceId || 'xiaoxiao');
    res.json({ success: true, audioUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Audio Speech Recognition (ASR)
const asrService = require('./src/asr_service');
app.post('/api/asr', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) throw new Error('缺少音频数据');
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const transcript = await asrService.transcribeAudio(audioBuffer, mimeType || 'audio/webm');
    res.json({ success: true, text: transcript });
  } catch (err) {
    console.error('[ASR API] 语音识别失败:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: LLM Agent Status
const llmAgentCore = require('./src/llm_agent_core');
const dataCollector = require('./src/data_collector');

app.get('/api/llm/status', (req, res) => {
  res.json({
    available: llmAgentCore.isConfigured(),
    model: llmAgentCore.model || 'qwen3.8-flash',
    provider: 'tongyi-tp (阿里通义千问)'
  });
});

// API: Recent Interactions Analytics
app.get('/api/analytics/recent', (req, res) => {
  const limit = parseInt(req.query.limit || '20', 10);
  res.json({
    success: true,
    total: dataCollector.getRecentInteractions(limit).length,
    interactions: dataCollector.getRecentInteractions(limit)
  });
});

const http = require('http');

const httpServer = http.createServer(app);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[StoryEngine] 成功加载 ${Object.keys(engine.stories).length} 套真实绘本知识库\n`);
  console.log(`🎉 幼儿看图讲故事服务已就绪 (已接入百炼 Qwen3.8 Agent + Qwen-Audio ASR 语音识别)！`);
  console.log(`💻 访问地址: http://localhost:${PORT}`);
  console.log(`📱 局域网访问: http://192.168.110.56:${PORT}\n`);
});

// Background non-blocking warm up for common phrases
setTimeout(async () => {
  try {
    const phrases = engine.getStories('small').slice(0, 15).map(s => `今天来看《${s.title}》！快看第 1 幅画，谁走过来啦？`);
    phrases.push('真细心！那小朋友仔细瞧瞧，画面里是谁呀？');
    phrases.push('答对啦！整本故事都被你讲完啦！快来听听你的故事吧～');
    await ttsService.warmup(phrases);
    console.log(`[TTSService] 常用名师幼教原声音频预热完成 (${phrases.length} 条)`);
  } catch(e) {}
}, 1000);
