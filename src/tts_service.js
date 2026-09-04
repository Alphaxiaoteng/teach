const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const VOICE_CONFIGS = {
  xiaoxiao: {
    id: 'xiaoxiao',
    alias: ['xiaoxiao', 'tingting'],
    name: '晓晓老师',
    badge: '温柔名师 · 推荐',
    subtitle: '温润甜美自然 · 幼教名师面对面启发',
    icon: '🌸',
    edgeVoice: 'zh-CN-XiaoxiaoNeural',
    rate: '+10%',
    macVoice: 'Tingting',
    sampleText: '哇～小眼睛真亮！快瞧瞧第①幅图里是谁呀？'
  },
  xiaoyi: {
    id: 'xiaoyi',
    alias: ['xiaoyi', 'meijia'],
    name: '依依姐姐',
    badge: '童趣故事',
    subtitle: '灵动活泼亲切 · 童趣绘本电台主播',
    icon: '🧸',
    edgeVoice: 'zh-CN-XiaoyiNeural',
    rate: '+10%',
    macVoice: 'Tingting',
    sampleText: '哇塞！这里好多好吃的果子呀，快和我一起讲故事吧！'
  },
  yunxi: {
    id: 'yunxi',
    alias: ['yunxi', 'reed'],
    name: '云健哥哥',
    badge: '阳光朝气',
    subtitle: '阳光爽朗少年 · 充满活力与真诚鼓励',
    icon: '🚀',
    edgeVoice: 'zh-CN-YunjianNeural',
    rate: '+10%',
    macVoice: 'Reed',
    sampleText: '太棒啦小朋友！你讲得真好，快看下一张画发生了什么！'
  },
  yunxia: {
    id: 'yunxia',
    alias: ['yunxia'],
    name: '云夏萌宝',
    badge: '可爱萌宝',
    subtitle: '软萌可爱童声 · 像同龄小伙伴一起看画',
    icon: '👶',
    edgeVoice: 'zh-CN-YunxiaNeural',
    rate: '+10%',
    macVoice: 'Tingting',
    sampleText: '宝贝别着急，慢慢看，我和你一起看图讲故事呢～'
  }
};

class TTSService {
  constructor() {
    this.cacheDir = path.join(__dirname, '../public/audio_cache');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  resolveVoiceConfig(voiceId) {
    if (!voiceId) return VOICE_CONFIGS.xiaoxiao;
    const vLower = String(voiceId).toLowerCase();
    for (const key of Object.keys(VOICE_CONFIGS)) {
      const cfg = VOICE_CONFIGS[key];
      if (cfg.id === vLower || (cfg.alias && cfg.alias.includes(vLower))) {
        return cfg;
      }
    }
    return VOICE_CONFIGS.xiaoxiao;
  }

  getVoiceConfigs() {
    return Object.values(VOICE_CONFIGS).map(cfg => ({
      id: cfg.id,
      name: cfg.name,
      badge: cfg.badge,
      subtitle: cfg.subtitle,
      icon: cfg.icon,
      sampleText: cfg.sampleText
    }));
  }

  sanitizeTextForTTS(rawText) {
    if (!rawText) return '';
    return String(rawText)
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F100}-\u{1F6FF}]/gu, '')
      .replace(/[👏🎉🌟💡🏅🎈👑✨💎👀🐾❤️👍😊😄😃🐰🐼🐱🐶🐻🦆🦊🌸⭐🌻✓🎙️💬🔄▶⚙️📋]/g, '')
      .replace(/\[\[ACTION:[A-Z_]+\]\]/g, '')
      .replace(/【|】/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async synthesize(text, voiceId = 'xiaoxiao') {
    const cleanText = this.sanitizeTextForTTS(text);
    if (!cleanText) return null;

    const vConfig = this.resolveVoiceConfig(voiceId);
    const hash = crypto.createHash('md5').update(`v2_${vConfig.id}_${vConfig.rate}_${cleanText}`).digest('hex');
    const filename = `tts_neural_${vConfig.id}_${hash}.mp3`;
    const filepath = path.join(this.cacheDir, filename);

    // Cache hit check
    if (fs.existsSync(filepath) && fs.statSync(filepath).size > 100) {
      return `/audio_cache/${filename}`;
    }

    // Tier 1: Microsoft Edge Neural TTS (Studio-quality lifelike human voice)
    try {
      const success = await new Promise((resolve) => {
        execFile('python3', [
          '-m', 'edge_tts',
          '--voice', vConfig.edgeVoice,
          `--rate=${vConfig.rate}`,
          '--text', cleanText,
          '--write-media', filepath
        ], { timeout: 8000 }, (err) => {
          if (err) {
            resolve(false);
          } else {
            resolve(fs.existsSync(filepath) && fs.statSync(filepath).size > 100);
          }
        });
      });

      if (success) {
        return `/audio_cache/${filename}`;
      }
    } catch (e) {
      // Fall through to Tier 2
    }

    // Tier 2: macOS Local Native TTS (Say + afconvert fallback)
    try {
      const aiffTemp = path.join(this.cacheDir, `temp_${vConfig.id}_${hash}.aiff`);
      const m4aFile = path.join(this.cacheDir, `tts_local_${vConfig.id}_${hash}.m4a`);

      await new Promise((resolve, reject) => {
        execFile('say', ['-v', vConfig.macVoice || 'Flo', '-r', '155', cleanText, '-o', aiffTemp], { timeout: 5000 }, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      if (fs.existsSync(aiffTemp)) {
        await new Promise((resolve, reject) => {
          execFile('afconvert', ['-f', 'm4af', '-d', 'aac', aiffTemp, m4aFile], { timeout: 4000 }, (err) => {
            try { fs.unlinkSync(aiffTemp); } catch(e) {}
            if (err) return reject(err);
            resolve();
          });
        });

        if (fs.existsSync(m4aFile) && fs.statSync(m4aFile).size > 100) {
          return `/audio_cache/tts_local_${vConfig.id}_${hash}.m4a`;
        }
      }
    } catch(e) {
      // Graceful fallback
    }

    return null;
  }

  // Pre-warm sample audios for all 4 voice personas
  async warmupSamples() {
    console.log('[TTSService] 正在预热 4 款顶级中文幼教神经网络音色试听样本...');
    for (const vConfig of Object.values(VOICE_CONFIGS)) {
      try {
        const audioUrl = await this.synthesize(vConfig.sampleText, vConfig.id);
        console.log(`  ✨ [音色就绪] ${vConfig.icon} ${vConfig.name} -> ${audioUrl}`);
      } catch(e) {
        console.warn(`  ⚠️ 音色预热跳过: ${vConfig.name}`);
      }
    }
  }

  // Pre-warm audio for common sentences
  async warmup(sentences = []) {
    await this.warmupSamples();
    for (const text of sentences) {
      try {
        await this.synthesize(text, 'xiaoxiao');
      } catch(e) {}
    }
  }
}

module.exports = new TTSService();
