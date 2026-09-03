// State variables
let currentAge = 'small';
let currentStories = [];
let currentStory = null;
let currentSession = null;
let currentStoryData = null;
let currentTheme = localStorage.getItem('app_theme') || 'candy';
let currentVoiceId = localStorage.getItem('app_voice') || 'xiaochen';
let availableVoicePersonas = [];
let isStartingStory = false;
let preloadedStories = []; // Client-side preloaded stories cache for 0ms instant display

// Standard Professional SVG Icons (Strictly No Emojis for Controls)
const SVG_ICONS = {
  mic: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`,
  micRecording: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7" fill="#ef4444"></circle></svg>`,
  keyboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2.5"></rect><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8"></path></svg>`
};

// Robust Single Audio Manager
let activeAudioPlayer = null;
let masterAudioChannel = null;
let globalAudioToken = 0;
let currentPlayingButton = null;

// Trace Logger (Inside Settings Modal - Safe TextContent Only)
const logsList = [];
const AppLogger = {
  log(tag, msg, extra = null) {
    const timeStr = new Date().toTimeString().split(' ')[0] + '.' + String(Date.now() % 1000).padStart(3, '0');
    const logItem = { tag, msg, extra, time: timeStr };
    logsList.push(logItem);
    if (logsList.length > 200) logsList.shift();

    const body = document.getElementById('settingsLogBody');
    const badge = document.getElementById('settingsLogCount');
    if (badge) badge.textContent = String(logsList.length);

    if (body) {
      const row = document.createElement('div');
      row.className = 'log-item-row';

      const timeEl = document.createElement('span');
      timeEl.className = 'log-time';
      timeEl.textContent = timeStr;

      const tagEl = document.createElement('span');
      tagEl.className = `log-tag tag-${tag}`;
      tagEl.textContent = `[${tag}]`;

      const msgEl = document.createElement('span');
      msgEl.className = 'log-msg';
      msgEl.textContent = `${msg} ${extra ? (typeof extra === 'object' ? JSON.stringify(extra) : String(extra)) : ''}`;

      row.appendChild(timeEl);
      row.appendChild(tagEl);
      row.appendChild(msgEl);
      body.appendChild(row);
      body.scrollTop = body.scrollHeight;
    }
    console.log(`[${timeStr}] [${tag}] ${msg}`, extra || '');
  }
};

function toggleSettingsLogs() {
  const container = document.getElementById('settingsLogsContainer');
  const arrow = document.getElementById('settingsLogToggleIcon');
  if (container) {
    const isHidden = container.classList.toggle('hidden');
    if (arrow) arrow.textContent = isHidden ? '▼' : '▲';
  }
}

function clearLogs() {
  logsList.length = 0;
  const body = document.getElementById('settingsLogBody');
  if (body) body.innerHTML = '';
  const badge = document.getElementById('settingsLogCount');
  if (badge) badge.textContent = '0';
}

// Elegant Toast Notification (Zero-alert, silky smooth animation)
let toastTimer = null;
function showToast(msg, type = 'success') {
  let toast = document.getElementById('appToastLayer');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToastLayer';
    toast.className = 'app-toast-layer';
    document.body.appendChild(toast);
  }

  const iconSvg = type === 'success' 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  toast.innerHTML = `${iconSvg}<span>${msg}</span>`;
  toast.className = `app-toast-layer ${type} show`;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1600);
}

// Input mode: 'text' | 'voice' (Default Voice-First for Kids)
let inputMode = 'voice';
let isRecording = false;
let speechRecognizer = null;

// DOM references
const stepAge = document.getElementById('stepAge');
const stepStory = document.getElementById('stepStory');
const stepStage = document.getElementById('stepStage');
const stepPlayback = document.getElementById('stepPlayback');

const btnRestart = document.getElementById('btnRestart');
const storyListGrid = document.getElementById('storyListGrid');

const stageStoryTitle = document.getElementById('stageStoryTitle');
const currentStepIndicator = document.getElementById('currentStepIndicator');
const ambientStageImage = document.getElementById('ambientStageImage');
const mainBigStageImage = document.getElementById('mainBigStageImage');
const chatMessageFlow = document.getElementById('chatMessageFlow');
const childTextInput = document.getElementById('childTextInput');
const celebrationAnim = document.getElementById('celebrationAnim');

const assembledStoryText = document.getElementById('assembledStoryText');
const feedbackText = document.getElementById('feedbackText');
const playbackTitle = document.getElementById('playbackTitle');
const btnPlayFullStory = document.getElementById('btnPlayFullStory');
const fullStoryPlayText = document.getElementById('fullStoryPlayText');

const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const llmModal = document.getElementById('llmModal');
const statusDot = document.getElementById('statusDot');
const inputApiKey = document.getElementById('inputApiKey');
const inputBaseURL = document.getElementById('inputBaseURL');
const inputModel = document.getElementById('inputModel');
const testResultBox = document.getElementById('testResultBox');

const btnInputModeToggle = document.getElementById('btnInputModeToggle');
const modeToggleIcon = document.getElementById('modeToggleIcon');
const textInputContainer = document.getElementById('textInputContainer');
const voiceInputContainer = document.getElementById('voiceInputContainer');
const btnVoiceRecord = document.getElementById('btnVoiceRecord');
const voiceRecordText = document.getElementById('voiceRecordText');

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  AppLogger.log('ENGINE', '系统前端初始化就绪');
  selectAppTheme(currentTheme);
  loadVoicePersonas();
  loadCustomApiConfig();
  preloadStories();
  checkLLMStatus();
  setupGlobalKeyHandlers();
  initSpeechRecognition();
  resetToHome();
});

async function checkLLMStatus() {
  try {
    const res = await fetch('/api/llm/status');
    const data = await res.json();
    if (data && data.available) {
      if (statusDot) statusDot.classList.add('online');
      const badge = document.getElementById('apiStatusBadge');
      if (badge) {
        badge.textContent = `🟢 已激活 ${data.model} (${data.provider})`;
        badge.style.color = '#10B981';
      }
      AppLogger.log('AI', `大模型 Agent 就绪: ${data.model} (${data.provider})`);
    }
  } catch (e) {
    // static mode
  }
}

// 1. Theme Switcher with 4 Distinct Child-Centric Styles
function selectAppTheme(theme) {
  currentTheme = theme || 'candy';
  localStorage.setItem('app_theme', currentTheme);

  document.body.classList.remove('theme-candy', 'theme-forest', 'theme-galaxy', 'theme-craft');
  document.body.classList.add(`theme-${currentTheme}`);

  const cards = document.querySelectorAll('.theme-preview-card');
  cards.forEach(card => {
    card.classList.toggle('active', card.dataset.theme === currentTheme);
  });

  AppLogger.log('USER', `切换视觉风格: ${currentTheme}`);
}

// 2. Audio Singleton & Master Kindergarten Voice Synthesizer
let chineseVoice = null;
function initChineseVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;

  const zhVoices = voices.filter(v => v.lang && (v.lang.toLowerCase().includes('zh') || v.lang.toLowerCase().includes('cmn')));
  
  // 严格优先匹配极度自然的“真人/神经网络/增强版”音色，彻底淘汰机械单调发音
  let priorityKeywords = [];
  if (currentVoiceId === 'xiaochen') {
    priorityKeywords = ['HsiaoChen', 'Xiaochen', '晓臻', 'Natural', 'Enhanced', 'Tingting (Enhanced)', 'Tingting'];
  } else if (currentVoiceId === 'xiaoyu') {
    priorityKeywords = ['HsiaoYu', 'Xiaoyu', 'Natural', 'Enhanced', 'Tingting (Enhanced)', 'Tingting'];
  } else if (currentVoiceId === 'xiaoyi') {
    priorityKeywords = ['Xiaoyi', 'Natural', 'Enhanced', 'Tingting (Enhanced)', 'Tingting'];
  } else if (currentVoiceId === 'yunxi') {
    priorityKeywords = ['Yunjian', 'Yunxi', 'Reed', 'Natural', 'Tingting'];
  } else {
    // 默认 晓晓老师：优先选择带 Natural / Enhanced 柔和亲切的女声
    priorityKeywords = [
      'Xiaoxiao (Natural)', 'Xiaoxiao', 'HsiaoChen', 'Tingting (Enhanced)', 'Enhanced', 'Natural',
      'Meijia', 'Lili', 'Tingting'
    ];
  }

  // 1. 先找既符合关键词、又带有 Natural / Enhanced 的顶级自然真人音色
  for (const kw of priorityKeywords) {
    const match = zhVoices.find(v => v.name && v.name.includes(kw) && (v.name.includes('Natural') || v.name.includes('Enhanced') || v.name.includes('Online')));
    if (match) {
      chineseVoice = match;
      AppLogger.log('AUDIO', '匹配到顶级自然真人神经音色', match.name);
      return;
    }
  }

  // 2. 次选一般匹配
  for (const kw of priorityKeywords) {
    const match = zhVoices.find(v => v.name && v.name.includes(kw));
    if (match) {
      chineseVoice = match;
      AppLogger.log('AUDIO', '匹配到中文人声音色', match.name);
      return;
    }
  }

  if (!chineseVoice) {
    chineseVoice = zhVoices[0] || null;
  }
}
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = initChineseVoice;
  initChineseVoice();
}

async function loadVoicePersonas() {
  const defaultVoices = [
    { id: 'xiaochen', name: '小晨老师', icon: '🌿', subtitle: '台湾自然口语 · 强烈推荐（零AI播音味）' },
    { id: 'xiaoxiao', name: '晓晓老师', icon: '🌸', subtitle: '3-6岁名师 · 温柔耐心启发' },
    { id: 'xiaoyi', name: '依依姐姐', icon: '🧸', subtitle: '绘本故事主播 · 活泼灵动亲切' },
    { id: 'xiaoyu', name: '小雨姐姐', icon: '🍁', subtitle: '慢调轻声伴读 · 治愈温暖陪伴' }
  ];

  availableVoicePersonas = defaultVoices;
  renderVoicePersonas(defaultVoices);
}

function renderVoicePersonas(voices) {
  const container = document.getElementById('voiceCardsGrid');
  if (!container) return;
  container.innerHTML = '';

  voices.forEach(v => {
    const card = document.createElement('div');
    card.className = `voice-card ${v.id === currentVoiceId ? 'active' : ''}`;
    card.onclick = () => selectVoicePersona(v.id);

    const header = document.createElement('div');
    header.className = 'voice-card-header';

    const identity = document.createElement('div');
    identity.className = 'voice-card-identity';

    const icon = document.createElement('span');
    icon.className = 'voice-card-icon';
    icon.textContent = v.icon;

    const name = document.createElement('span');
    name.className = 'voice-card-name';
    name.textContent = v.name;

    identity.appendChild(icon);
    identity.appendChild(name);

    const statusTag = document.createElement('span');
    statusTag.className = 'voice-status-tag';
    statusTag.textContent = '当前选中 ✓';

    header.appendChild(identity);
    header.appendChild(statusTag);

    const sub = document.createElement('div');
    sub.className = 'voice-card-sub';
    sub.textContent = v.subtitle;

    const actions = document.createElement('div');
    actions.className = 'voice-card-actions';

    const sampleBtn = document.createElement('button');
    sampleBtn.className = 'btn-voice-sample';
    sampleBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      <span>试听</span>
    `;
    sampleBtn.onclick = (e) => {
      e.stopPropagation();
      previewVoicePersona(v.id, v.sampleAudio, v.sampleText, sampleBtn);
    };

    actions.appendChild(sampleBtn);

    card.appendChild(header);
    card.appendChild(sub);
    card.appendChild(actions);

    container.appendChild(card);
  });
}

function selectVoicePersona(voiceId) {
  currentVoiceId = voiceId;
  localStorage.setItem('app_voice', voiceId);
  initChineseVoice();

  const cards = document.querySelectorAll('.voice-card');
  cards.forEach(c => {
    c.classList.remove('active');
  });

  const matched = availableVoicePersonas.find(v => v.id === voiceId);
  if (matched) {
    AppLogger.log('USER', `切换幼教音色为: ${matched.name}`);
    showToast(`已选用【${matched.name}】原声`, 'success');
  }

  // Refresh visual cards
  if (availableVoicePersonas.length > 0) {
    renderVoicePersonas(availableVoicePersonas);
  }

  // 立即自动播放对应名师高保真真人问候语
  const auditionText = "你好呀！我是你的伴读伙伴，今天想听什么故事呀？";
  let targetBtn = null;
  const activeCard = document.querySelector(`.voice-card.active`);
  if (activeCard) targetBtn = activeCard.querySelector('.btn-voice-sample');
  previewVoicePersona(voiceId, null, auditionText, targetBtn);
}

function previewVoicePersona(voiceId, sampleAudioUrl, sampleText, btn) {
  stopAllAudio('PREVIEW_VOICE');
  AppLogger.log('USER', `试听音色: ${voiceId}`);
  if (btn) btn.classList.add('playing');

  const greetingText = sampleText || "你好呀！我是你的伴读伙伴，今天想听什么故事呀？";
  let audioUrl = sampleAudioUrl;

  if (!audioUrl && window.AUDIO_MANIFEST && window.AUDIO_MANIFEST[voiceId]) {
    audioUrl = window.AUDIO_MANIFEST[voiceId][greetingText];
  }

  if (audioUrl) {
    const audio = masterAudioChannel || new Audio();
    masterAudioChannel = audio;
    audio.src = audioUrl;
    audio.playbackRate = 1.1;
    activeAudioPlayer = audio;
    if (btn) currentPlayingButton = btn;

    audio.onended = () => {
      if (btn) btn.classList.remove('playing');
      if (activeAudioPlayer === audio) activeAudioPlayer = null;
      if (currentPlayingButton === btn) currentPlayingButton = null;
    };
    audio.onerror = () => {
      if (btn) btn.classList.remove('playing');
      speakWithWebSpeech(greetingText, btn);
    };
    audio.play().catch(() => {
      speakWithWebSpeech(greetingText, btn);
    });
  } else {
    speakWithWebSpeech(greetingText, btn);
  }
}

function cleanSpeechText(text) {
  if (!text) return '';
  return String(text)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F100}-\u{1F6FF}]/gu, '')
    .replace(/[👏🎉🌟💡🏅🎈👑✨💎👀🐾❤️👍😊😄😃🐰🐼🐱🐶🐻🦆🦊🌸⭐🌻✓]/g, '')
    .replace(/\[\[ACTION:[A-Z_]+\]\]/g, '')
    .replace(/【|】/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function speakWithWebSpeech(text, triggerBtn = null, onEndCallback = null) {
  if (!('speechSynthesis' in window)) {
    if (triggerBtn) triggerBtn.classList.remove('playing');
    return;
  }
  const clean = cleanSpeechText(text);
  if (!clean) {
    if (triggerBtn) triggerBtn.classList.remove('playing');
    return;
  }

  try {
    if (window.speechSynthesis.paused) {
      try { window.speechSynthesis.resume(); } catch(e) {}
    }
    window.speechSynthesis.cancel();

    if (triggerBtn) {
      currentPlayingButton = triggerBtn;
      triggerBtn.classList.add('playing');
    }

    // 延迟 40ms 确保浏览器音频上下文释放干净，解决 iOS/Safari/Chrome 偶发吞字哑音
    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(clean);
        if (!chineseVoice) initChineseVoice();
        if (chineseVoice) utterance.voice = chineseVoice;
        utterance.lang = 'zh-CN';
        utterance.rate = 1.1; // 1.1 倍速，轻快干脆、生动活泼的幼师语速
        utterance.pitch = 1.0; // 纯正自然的真人原声音调（杜绝机械尖锐）

        utterance.onend = () => {
          AppLogger.log('AUDIO', '语音朗读完毕');
          if (triggerBtn) triggerBtn.classList.remove('playing');
          if (currentPlayingButton === triggerBtn) currentPlayingButton = null;
          if (onEndCallback) onEndCallback();
        };

        utterance.onerror = (e) => {
          AppLogger.log('WARN', 'Web Speech 朗读异常', e.error || e.message);
          if (triggerBtn) triggerBtn.classList.remove('playing');
          if (currentPlayingButton === triggerBtn) currentPlayingButton = null;
        };

        window.speechSynthesis.speak(utterance);
      } catch(e) {
        if (triggerBtn) triggerBtn.classList.remove('playing');
      }
    }, 40);
  } catch (err) {
    if (triggerBtn) triggerBtn.classList.remove('playing');
  }
}

function stopAllAudio(reason = 'MANUAL') {
  globalAudioToken++;
  if ('speechSynthesis' in window) {
    try { window.speechSynthesis.cancel(); } catch(e) {}
  }
  if (activeAudioPlayer) {
    try {
      activeAudioPlayer.onended = null;
      activeAudioPlayer.onerror = null;
      activeAudioPlayer.pause();
      activeAudioPlayer.currentTime = 0;
      activeAudioPlayer.src = '';
    } catch(e) {}
    activeAudioPlayer = null;
  }
  if (currentPlayingButton) {
    currentPlayingButton.classList.remove('playing');
    currentPlayingButton = null;
  }
  if (btnPlayFullStory) {
    btnPlayFullStory.classList.remove('playing');
    if (fullStoryPlayText) fullStoryPlayText.textContent = '听听我的故事录音';
  }
}

// User Touch / Click Gesture Audio Unlocker & Synchronous Pre-arming
let isAudioContextUnlocked = false;

function unlockAudioContext() {
  if (isAudioContextUnlocked) return;
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(u);
    }
    isAudioContextUnlocked = true;
    AppLogger.log('AUDIO', '音频上下文已激活');
  } catch(e) {}
}

// Synchronously arm audio element inside user touch/click gesture stack
function armAudioPlayback() {
  unlockAudioContext();
  try {
    if (!masterAudioChannel) {
      masterAudioChannel = new Audio();
    }
    // Pre-arm with micro silent sound on user interaction to bypass browser Autoplay policy
    masterAudioChannel.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    const p = masterAudioChannel.play();
    if (p !== undefined) {
      p.catch(() => {});
    }
  } catch(e) {}
}

// Single User Gesture Unlocker
window.addEventListener('click', () => {
  unlockAudioContext();
}, { once: true, passive: true });

function setLiveStatus(state, text) {
  const bar = document.getElementById('liveInteractionStatus');
  const txtEl = document.getElementById('liveStatusText');
  if (!bar || !txtEl) return;

  bar.classList.remove('speaking', 'listening');
  if (state === 'speaking') {
    bar.classList.add('speaking');
  } else if (state === 'listening') {
    bar.classList.add('listening');
  }
  txtEl.textContent = text;
}

async function playAudio(audioUrl, fallbackText, triggerBtn = null) {
  // If already playing this, toggle pause/stop
  if (triggerBtn && currentPlayingButton === triggerBtn) {
    if (('speechSynthesis' in window && window.speechSynthesis.speaking) || (activeAudioPlayer && !activeAudioPlayer.paused)) {
      stopAllAudio('TOGGLE_PAUSE');
      setLiveStatus('idle', '晓晓老师在等你说话哦～');
      return;
    }
  }

  stopAllAudio('NEW_PLAY_REQUEST');
  const thisToken = globalAudioToken;

  if (triggerBtn) {
    currentPlayingButton = triggerBtn;
    triggerBtn.classList.add('playing');
    triggerBtn.classList.remove('pulse-attention');
  }

  stopVoiceRecording('TEACHER_SPEAKING');
  setLiveStatus('speaking', '晓晓老师正在讲故事...');
  if (btnVoiceRecord) {
    btnVoiceRecord.classList.remove('recording');
    const txt = document.getElementById('voiceRecordText');
    const icon = document.getElementById('voiceRecordIcon');
    if (txt) txt.textContent = '点击开始说话';
    if (icon) icon.innerHTML = SVG_ICONS.mic;
  }

  let finalUrl = audioUrl;
  if (!finalUrl && fallbackText && window.AUDIO_MANIFEST) {
    const clean = cleanSpeechText(fallbackText);
    const vId = currentVoiceId || 'xiaoxiao';
    if (window.AUDIO_MANIFEST[vId] && window.AUDIO_MANIFEST[vId][clean]) {
      finalUrl = window.AUDIO_MANIFEST[vId][clean];
      AppLogger.log('AUDIO', `命中预热名师高保真原声: [${vId}] -> ${clean.slice(0, 15)}...`);
    } else if (window.AUDIO_MANIFEST.xiaoxiao && window.AUDIO_MANIFEST.xiaoxiao[clean]) {
      finalUrl = window.AUDIO_MANIFEST.xiaoxiao[clean];
    }
  }

  if (!finalUrl && fallbackText) {
    // 0ms 瞬间无延迟发声兜底
    speakWithWebSpeech(fallbackText, triggerBtn);
    return;
  }

  if (thisToken !== globalAudioToken) return;

  if (finalUrl) {
    try {
      AppLogger.log('AUDIO', '播放高保真幼教原声', finalUrl);
      
      const player = masterAudioChannel || new Audio();
      masterAudioChannel = player;
      player.src = finalUrl;
      player.playbackRate = 1.1;
      activeAudioPlayer = player;
      
      player.onended = () => {
        AppLogger.log('AUDIO', '音频播毕');
        if (activeAudioPlayer === player) activeAudioPlayer = null;
        if (triggerBtn) triggerBtn.classList.remove('playing');
        if (currentPlayingButton === triggerBtn) currentPlayingButton = null;
        
        // 关键守护：如果孩子已经点击了开始录音，绝不冲掉录音界面！
        if (!isRecordingActive) {
          setLiveStatus('idle', '晓晓老师在等你说话哦～');
          if (btnVoiceRecord) {
            btnVoiceRecord.classList.remove('recording');
            const txt = document.getElementById('voiceRecordText');
            const icon = document.getElementById('voiceRecordIcon');
            if (txt) txt.textContent = '点击开始说话';
            if (icon) icon.innerHTML = SVG_ICONS.mic;
          }
        }
      };

      player.onerror = (e) => {
        AppLogger.log('WARN', '音频加载异常，自动降级至 WebSpeech', e);
        speakWithWebSpeech(fallbackText, triggerBtn);
      };

      const playPromise = player.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (triggerBtn) triggerBtn.classList.remove('pulse-attention');
        }).catch(err => {
          AppLogger.log('WARN', '浏览器自动播放拦截，提示用户轻触播放', err.name);
          if (triggerBtn) {
            triggerBtn.classList.remove('playing');
            triggerBtn.classList.add('pulse-attention');
          }
          speakWithWebSpeech(fallbackText, triggerBtn);
        });
      }
      return;
    } catch (err) {
      AppLogger.log('WARN', '音频播放异常', err.message);
    }
  }

  // Fallback to 100% Reliable Native Web Speech API
  speakWithWebSpeech(fallbackText, triggerBtn);
}

// Fisher-Yates Random Shuffle for Stories
function shuffleStories(array) {
  const list = [...array];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function shuffleArray(arr) {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

function shuffleCurrentStories() {
  if (!preloadedStories || preloadedStories.length === 0) return;
  const randomized = shuffleArray(preloadedStories);
  renderPictureStoryCards(randomized);
  showToast('🔀 已为您随机换一批精选绘本！', 'success');
  AppLogger.log('USER', '点击换一批绘本');
}

// 3. Select Class (Step 1 -> Step 2 with 0ms Instant Transition)
async function selectAge(age) {
  currentAge = age || 'small';
  isStartingStory = false;

  // 1. 瞬间 0ms 切换到绘本封面挑选页，保证绝对不卡顿
  switchStep('stepStory');
  window.scrollTo({ top: 0, behavior: 'instant' });
  AppLogger.log('USER', `选择班级: ${currentAge}`);

  // 清理庆祝动画层
  const layer = document.getElementById('celebrationAnim');
  if (layer) {
    layer.innerHTML = '';
    layer.className = 'celebration-layer hidden';
  }

  // 2. 内存就绪数据瞬间直出
  let instantStories = [];
  const allStaticStories = (window.STATIC_STORY_DATA && window.STATIC_STORY_DATA.stories) || preloadedStories || [];
  if (allStaticStories.length > 0) {
    instantStories = allStaticStories.filter(s => {
      const ages = s.suitable_age || s.age_group || s.target_age_group || [];
      const ageList = Array.isArray(ages) ? ages : [ages];
      const isBigMatch = (currentAge === 'big' || currentAge === 'large') && (ageList.includes('big') || ageList.includes('large'));
      return ageList.length === 0 || ageList.includes(currentAge) || isBigMatch;
    });
    if (instantStories.length === 0) instantStories = allStaticStories;
  }

  if (instantStories.length > 0) {
    preloadedStories = shuffleArray(instantStories);
    renderPictureStoryCards(preloadedStories);
  } else {
    // 渲染骨架屏加载提示
    renderPictureStoryCards([]);
  }

  // 3. 静默后台异步补全数据
  try {
    const res = await fetch(`/api/stories?ageGroup=${currentAge}`);
    const data = await res.json();
    if (data.success && data.stories && data.stories.length > 0) {
      preloadedStories = shuffleArray(data.stories);
      renderPictureStoryCards(preloadedStories);
    }
  } catch (err) {}
}

// 4. Render Stories as Picture Covers (Optimized with DocumentFragment & Async Decoding)
function renderPictureStoryCards(stories) {
  storyListGrid.innerHTML = '';
  if (!stories || stories.length === 0) {
    storyListGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 40px 0; color: var(--text-muted);">
        <p>正在载入绘本中...</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  stories.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'story-cover-card';
    card.onclick = () => startStorySession(s.story_id, card);
    
    const coverSrc = s.cover_url || (s.images && s.images[0] && s.images[0].image_url) || '';
    const totalCount = s.total_images || (s.images ? s.images.length : 1);

    const mediaDiv = document.createElement('div');
    mediaDiv.className = 'story-cover-media';
    const imgEl = document.createElement('img');
    imgEl.className = 'story-cover-img';
    imgEl.src = coverSrc;
    imgEl.alt = s.title || '';
    imgEl.loading = 'lazy';
    imgEl.decoding = 'async';
    imgEl.onerror = () => {
      // 容错：若含有编码路径则尝试解码路径，反之尝试编码路径
      if (imgEl.src.includes('%')) {
        imgEl.src = decodeURIComponent(imgEl.src);
      } else {
        imgEl.src = encodeURI(imgEl.src);
      }
    };
    mediaDiv.appendChild(imgEl);

    const footerDiv = document.createElement('div');
    footerDiv.className = 'story-cover-footer';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'story-cover-info';
    const h3 = document.createElement('h3');
    h3.textContent = s.title || '';
    const p = document.createElement('p');
    p.textContent = `${totalCount} 幅连环画`;
    infoDiv.appendChild(h3);
    infoDiv.appendChild(p);

    const btn = document.createElement('button');
    btn.className = 'btn-read-story';
    btn.innerHTML = `<span>开始</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    btn.onclick = (e) => {
      e.stopPropagation();
      startStorySession(s.story_id, card);
    };

    footerDiv.appendChild(infoDiv);
    footerDiv.appendChild(btn);

    card.appendChild(mediaDiv);
    card.appendChild(footerDiv);
    fragment.appendChild(card);
  });

  storyListGrid.appendChild(fragment);
}

// 5. Start Session (Step 3: 0ms Optimistic Instant Start)
async function startStorySession(storyId, cardElement = null) {
  armAudioPlayback();
  if (isStartingStory) {
    AppLogger.log('WARN', '拦截重复快速点击');
    return;
  }

  isStartingStory = true;
  stopAllAudio('START_NEW_STORY');

  if (!currentAge) currentAge = 'small';
  const t0 = Date.now();
  AppLogger.log('USER', `点击打开绘本 ID: ${storyId}`);

  // 1. Instant Local Resolution (0ms Optimistic Enter)
  let foundStory = (preloadedStories && preloadedStories.find(s => s.story_id === storyId)) ||
                   (window.STATIC_STORY_DATA && window.STATIC_STORY_DATA.stories && window.STATIC_STORY_DATA.stories.find(s => s.story_id === storyId));

  if (foundStory) {
    const totalImgs = foundStory.images ? foundStory.images.length : (foundStory.total_images || 1);
    
    // 亲切自然的特级名师开篇导语
    let fixedOpening = `小朋友，仔细看上面的连环画，故事里发生了什么？快把这个完整的故事讲给晓晓老师听听吧～`;
    if (totalImgs === 1) {
      fixedOpening = `小朋友，画面中你看到了谁？在什么地方干什么呀？`;
    }

    currentSession = {
      sessionId: `sess_${Date.now()}`,
      storyId: foundStory.story_id,
      storyTitle: foundStory.title,
      ageGroup: currentAge,
      currentImageIndex: 0,
      totalImages: totalImgs,
      images: foundStory.images || [],
      agentMessage: fixedOpening,
      childQuotes: [],
      history: []
    };

    if (stageStoryTitle) stageStoryTitle.textContent = currentSession.storyTitle;
    if (chatMessageFlow) chatMessageFlow.innerHTML = '';
    
    // 0ms 瞬间把所有连环画图片一起完整渲染出来！
    renderStoryboardGallery(currentSession);
    switchStep('stepStage');
    window.scrollTo({ top: 0, behavior: 'instant' });
    
    appendChatMessage('assistant', fixedOpening, false, null);
    AppLogger.log('ENGINE', `0ms 瞬间进入绘本《${currentSession.storyTitle}》，一次性展示全部 ${totalImgs} 张连环画`);
  }

  // 2. 静默在后端建立 Session
  try {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId, ageGroup: currentAge, voiceId: currentVoiceId })
    });
    const data = await res.json();
    if (data.success && data.session && currentSession) {
      currentSession.sessionId = data.session.sessionId;
    }
  } catch (err) {
    AppLogger.log('LOCAL', '本地会话就绪');
  } finally {
    isStartingStory = false;
    if (cardElement) cardElement.classList.remove('starting');
  }
}

// Render Multi-Image Storyboard Gallery (Display all images together)
function renderStoryboardGallery(sessionData) {
  const gallery = document.getElementById('storyboardGallery');
  if (!gallery) return;

  const images = sessionData.images || [];
  const total = images.length || 1;

  if (currentStepIndicator) {
    currentStepIndicator.textContent = `${total} 幅连环画`;
  }

  gallery.className = `storyboard-gallery frames-${Math.min(total, 4)}`;
  gallery.innerHTML = '';

  const numberBadges = ['①', '②', '③', '④', '⑤', '⑥'];

  images.forEach((img, idx) => {
    const card = document.createElement('div');
    card.className = 'storyboard-frame-card';
    card.onclick = () => previewImage(img.image_url);
    card.title = `点击放大查看第 ${idx + 1} 幅画`;

    if (total > 1) {
      const badge = document.createElement('span');
      badge.className = 'storyboard-frame-badge';
      badge.textContent = `${numberBadges[idx] || (idx + 1)}`;
      card.appendChild(badge);
    }

    const imgEl = document.createElement('img');
    imgEl.className = 'storyboard-frame-img';
    imgEl.src = img.image_url;
    imgEl.alt = `第 ${idx + 1} 幅画`;
    imgEl.loading = 'eager';
    imgEl.decoding = 'async';
    imgEl.onerror = () => {
      if (imgEl.src.includes('%')) {
        imgEl.src = decodeURIComponent(imgEl.src);
      } else {
        imgEl.src = encodeURI(imgEl.src);
      }
    };
    card.appendChild(imgEl);
    gallery.appendChild(card);
  });

  if (childTextInput) childTextInput.value = '';
}

function updateSingleBigPictureStage(sessionData) {
  renderStoryboardGallery(sessionData);
}

function previewCurrentImage() {
  if (currentSession && currentSession.images && currentSession.images[currentSession.currentImageIndex]) {
    previewImage(currentSession.images[currentSession.currentImageIndex].image_url);
  }
}

function previewImage(url) {
  modalImage.src = url;
  imageModal.classList.remove('hidden');
}

function closeImageModal() {
  if (imageModal) {
    imageModal.classList.add('hidden');
    AppLogger.log('USER', '退出全屏大图');
  }
}

let latestTeacherPrompt = { text: '', audioUrl: null };

function replayLatestQuestion() {
  armAudioPlayback();
  const btn = document.getElementById('btnReplayQuestion');
  if (latestTeacherPrompt && latestTeacherPrompt.text) {
    AppLogger.log('USER', '点击【听老师说】重播当前提问');
    playAudio(latestTeacherPrompt.audioUrl, latestTeacherPrompt.text, btn);
  }
}

function appendChatMessage(role, text, isClue = false, audioUrl = null, accuracyBadge = null) {
  if (!text || !text.trim()) return;
  const clean = text.trim();

  // 严禁同角色连续重复插入一模一样的气泡
  const container = getChatContainer();
  if (container) {
    const bubbles = container.querySelectorAll(`.chat-bubble.${role}`);
    if (bubbles.length > 0) {
      const lastBubble = bubbles[bubbles.length - 1];
      if (lastBubble && lastBubble.textContent.trim().includes(clean)) {
        AppLogger.log('WARN', '拦截完全重复的消息气泡渲染', clean);
        return;
      }
    }
  }

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}` + (isClue ? ' clue-bubble' : '');
  
  // 独立优雅渲染准确性徽章
  if (accuracyBadge && accuracyBadge.trim()) {
    const badgeEl = document.createElement('div');
    badgeEl.className = 'bubble-accuracy-badge';
    badgeEl.textContent = accuracyBadge.trim();
    bubble.appendChild(badgeEl);
  }

  const contentWrap = document.createElement('div');
  contentWrap.className = 'chat-bubble-content-wrap';

  const textSpan = document.createElement('span');
  textSpan.className = 'chat-bubble-text';
  textSpan.textContent = clean;
  contentWrap.appendChild(textSpan);

  if (role === 'assistant') {
    latestTeacherPrompt = { text: clean, audioUrl };

    const voiceBtn = document.createElement('button');
    voiceBtn.className = 'btn-bubble-voice';
    voiceBtn.title = '播放声音';
    voiceBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      </svg>
    `;
    voiceBtn.onclick = (e) => {
      e.stopPropagation();
      playAudio(audioUrl, clean, voiceBtn);
    };
    contentWrap.appendChild(voiceBtn);

    // Auto Play with safety fallback
    playAudio(audioUrl, clean, voiceBtn);
  }

  bubble.appendChild(contentWrap);

  if (container) {
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }
}

// Pure Client-Side Static Evaluation Engine (1:1 if-else + Cloud LLM Bridge)
async function evaluateAnswerClientSide(session, userInput) {
  const input = userInput.trim();
  const rawStory = window.STATIC_STORY_DATA && window.STATIC_STORY_DATA.stories.find(s => s.story_id === session.storyId);
  const currentIdx = session.currentImageIndex || 0;
  const currentImg = (session.images && session.images[currentIdx]) || (rawStory && rawStory.images && rawStory.images[currentIdx]);

  // 1. 1:1 Pure Negation Detection (e.g. "不是", "不对") -> 0ms if-else
  if (/^(不是|不对|没有|错|不要|不)$/.test(input)) {
    return {
      success: true,
      evalStatus: 'WRONG',
      agentMessage: '真细心！那小朋友仔细瞧瞧，画面里是谁呀？',
      isCorrect: false,
      isClue: false,
      currentImageIndex: currentIdx,
      currentImage: currentImg,
      state: 'IN_PROGRESS'
    };
  }

  // 2. 1:1 Stuck / Help Intent Detection -> 0ms if-else
  if (/(不知道|不会|认不出|帮帮|提示)/.test(input)) {
    return {
      success: true,
      evalStatus: 'STUCK',
      agentMessage: '小提示：仔细看看画面正中间的小伙伴是谁呀？',
      isCorrect: false,
      isClue: true,
      currentImageIndex: currentIdx,
      currentImage: currentImg,
      state: 'IN_PROGRESS'
    };
  }

  // 3. Generic words interception (e.g. "小动物", "做游戏") -> Guide child to specify
  if (/^(小动物|动物|小家伙|小宝贝|在做|在玩|做游戏)$/.test(input)) {
    return {
      success: true,
      evalStatus: 'STUCK',
      agentMessage: '观察真仔细！那正中间这只毛茸茸的小动物具体是谁呀？快瞧瞧它的样子～',
      isCorrect: false,
      isClue: true,
      currentImageIndex: currentIdx,
      currentImage: currentImg,
      state: 'IN_PROGRESS'
    };
  }

  // 4. 1:1 Match Element Labels, Private Tags & Synonyms -> 0ms if-else
  let isMatched = false;
  const matchPool = [];
  if (currentImg && currentImg.element_labels) {
    const list = Array.isArray(currentImg.element_labels) ? currentImg.element_labels : [currentImg.element_labels];
    list.forEach(l => matchPool.push(l));
  }
  if (currentImg && currentImg.target_focus) matchPool.push(currentImg.target_focus);
  if (currentImg && currentImg.private_annotations && currentImg.private_annotations.tags) {
    currentImg.private_annotations.tags.forEach(t => {
      const parts = t.split(':');
      if (parts[1]) matchPool.push(parts[1]);
    });
  }

  const actionSynonyms = {
    '撑伞': ['打伞', '雨伞', '伞', '遮雨', '避雨', '撑伞', '散步', '走路', '踩水', '撑着伞', '拿着伞'],
    '打伞': ['撑伞', '雨伞', '伞', '遮雨', '避雨', '打伞', '散步', '走路'],
    '吹泡泡': ['吹泡泡', '泡泡', '吹', '玩泡泡', '七彩泡泡'],
    '吃竹子': ['吃竹子', '竹子', '吃', '啃竹子', '吃东西', '嚼竹子'],
    '钓鱼': ['钓鱼', '鱼竿', '抓鱼', '钓', '小鱼'],
    '拔萝卜': ['拔萝卜', '萝卜', '拔', '拉萝卜', '大萝卜'],
    '做糖画': ['做糖画', '糖画', '画画', '做糖', '手艺'],
    '捏面人': ['捏面人', '面人', '捏泥人', '做面人'],
    '送礼物': ['送礼物', '礼物', '拿礼物', '送礼', '礼物盒'],
    '跑步': ['跑步', '赛跑', '接力赛', '运动会', '跑', '奔跑'],
    '玩皮球': ['玩皮球', '拍球', '踢球', '皮球', '玩球', '拍皮球'],
    '小鸭子': ['小鸭', '鸭子', '小鸭子', '鸭鸭', '鸭'],
    '小狐狸': ['小狐狸', '狐狸'],
    '小熊猫': ['小熊猫', '熊猫', '大熊猫']
  };

  const expandedPool = [...matchPool];
  matchPool.forEach(item => {
    for (const [key, syns] of Object.entries(actionSynonyms)) {
      if (item.includes(key) || key.includes(item)) {
        syns.forEach(s => expandedPool.push(s));
      }
    }
  });

  isMatched = expandedPool.some(kw => kw && (input.includes(kw) || kw.includes(input)));

  // 5. If escaped 1:1 rules and Cloud LLM API is ready -> Call Cloud LLM Agent
  if (!isMatched && window.AgentAPIBridge && window.AgentAPIBridge.isReady()) {
    try {
      const llmDecision = await window.AgentAPIBridge.decideAction({
        storyTitle: session.storyTitle,
        ageGroup: session.ageGroup,
        frameIndex: currentIdx,
        totalFrames: session.totalImages,
        visibleTags: expandedPool,
        childInput: input,
        history: []
      });

      if (llmDecision && llmDecision.isCorrect) {
        isMatched = true;
      }
    } catch(e) {
      console.warn('Client LLM call skipped:', e);
    }
  }

  if (isMatched) {
    if (!session.childQuotes) session.childQuotes = [];
    session.childQuotes.push(input);

    const isLastImage = currentIdx >= session.totalImages - 1;

    if (isLastImage) {
      const assembledStory = session.childQuotes.join('，');
      const storyCard = {
        title: rawStory ? rawStory.title : session.storyTitle,
        childQuotes: [...session.childQuotes],
        assembledStory,
        feedback: `真棒！你用自己的话完整讲完了《${session.storyTitle}》！`,
        completedAt: new Date().toISOString()
      };
      return {
        success: true,
        evalStatus: 'CORRECT',
        agentMessage: '答对啦！整本故事都被你讲完啦！太棒啦～',
        isCorrect: true,
        isClue: false,
        currentImageIndex: currentIdx,
        currentImage: currentImg,
        state: 'COMPLETED',
        storyCard
      };
    } else {
      const nextIndex = currentIdx + 1;
      const nextImg = session.images && session.images[nextIndex];
      const specificClue = (nextImg && nextImg.visual_clues && nextImg.visual_clues[0]) 
        ? `观察得真仔细！快瞧第 ${nextIndex + 1} 幅画，${nextImg.visual_clues[0]}`
        : `观察得真仔细！快瞧第 ${nextIndex + 1} 幅画里的小动物在做什么呀？`;
      return {
        success: true,
        evalStatus: 'CORRECT',
        agentMessage: specificClue,
        isCorrect: true,
        isClue: false,
        currentImageIndex: nextIndex,
        currentImage: nextImg,
        state: 'IN_PROGRESS'
      };
    }
  }

  // 动态温和启发，绝不重复机械套话
  const dynamicClue = (currentImg && currentImg.visual_clues && currentImg.visual_clues[0]) || '别着急，看画面中间的小动物在做什么呀？';

  return {
    success: true,
    evalStatus: 'WRONG',
    agentMessage: dynamicClue,
    isCorrect: false,
    isClue: true,
    currentImageIndex: currentIdx,
    currentImage: currentImg,
    state: 'IN_PROGRESS'
  };
}

// 6. Submit Child's Text/Voice Answer
let isSubmittingAnswer = false;
let lastSubmitTime = 0;
let lastSubmitText = '';

async function submitChildAnswer() {
  const inputEl = childTextInput || document.getElementById('childTextInput');
  const text = ((inputEl ? inputEl.value : '') || currentRecordedText || '').trim();
  
  if (!text) {
    showToast('请让小朋友说一句话哦～', 'warn');
    return;
  }

  // 严禁 800ms 内相同文本重复提交
  const now = Date.now();
  if (isSubmittingAnswer || (now - lastSubmitTime < 1000 && lastSubmitText === text)) {
    AppLogger.log('WARN', '拦截移动端极速重复点击/双重提交', text);
    return;
  }

  isSubmittingAnswer = true;
  lastSubmitTime = now;
  lastSubmitText = text;
  armAudioPlayback();
  AppLogger.log('USER', '小朋友发言', text);
  
  // 气泡生命周期绝对单一：固化当前流式气泡，若无则新建单气泡
  if (activeStreamingBubbleEl) {
    finalizeStreamingUserBubble(text);
  } else {
    // 检查最后一条消息是否已经是完全相同的 user 消息，防止重复渲染
    const container = getChatContainer();
    const lastMsg = container ? container.lastElementChild : null;
    const isAlreadyRendered = lastMsg && lastMsg.classList.contains('user') && lastMsg.textContent.trim() === text;
    if (!isAlreadyRendered) {
      appendChatMessage('user', text);
    }
  }

  // 彻底清除所有遗留的流式光标
  const container = getChatContainer();
  if (container) {
    container.querySelectorAll('.streaming-bubble').forEach(el => el.classList.remove('streaming-bubble'));
  }
  activeStreamingBubbleEl = null;
  
  if (inputEl) inputEl.value = '';
  currentRecordedText = '';

  // 立即呈现生动可爱的晓晓老师思考气泡与动作交互！
  showAgentThinkingBubble();

  const t0 = Date.now();
  let data = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('/api/session/interact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        sessionId: currentSession ? currentSession.sessionId : `sess_${Date.now()}`,
        storyId: currentSession ? currentSession.storyId : '',
        storyTitle: currentSession ? currentSession.storyTitle : '',
        totalImages: currentSession ? currentSession.totalImages : 1,
        images: currentSession && currentSession.images ? currentSession.images : [],
        childInput: text,
        userInput: text,
        history: (currentSession && currentSession.history) || [],
        failCount: (currentSession && currentSession.frameFailCount) || 0
      })
    });
    clearTimeout(timeoutId);
    data = await res.json();
    if (!data || !data.success) throw new Error(data ? data.error : 'Network error');
  } catch (err) {
    AppLogger.log('LOCAL', '执行智能启发评估', err.message);
    data = await evaluateAnswerClientSide(currentSession || {}, text);
  } finally {
    isSubmittingAnswer = false;
    // 响应到达，平滑移除思考动效
    removeAgentThinkingBubble();
    setLiveStatus('idle', '👂 晓晓老师正在听你说～');
  }

  if (data && data.success) {
    AppLogger.log('ENGINE', `收到判定响应 (状态: ${data.evalStatus}, 耗时 ${Date.now() - t0}ms)`);

    // 记录多轮对话上下文历史，避免后续失忆与重复发问
    if (currentSession) {
      if (!currentSession.history) currentSession.history = [];
      currentSession.history.push({ role: 'user', content: text });
      currentSession.history.push({ role: 'assistant', content: data.agentMessage || '' });
    }

    const isCompleted = data.state === 'COMPLETED' || data.isCompleted;

    const teacherText = data.agentMessage || '';
    const badge = data.accuracyFeedback || null;
    const storyRecap = data.storyRecap || '';

    if (isCompleted) {
      // 动画与全屏庆贺只在最后全部答对、故事通关时才触发，平时中间轮次绝不打扰
      triggerCelebration();

      // 彻底解决一线反馈痛点：将表扬与完整故事融合成连续的单通道语音，保证孩子完整听完
      const cleanRecap = storyRecap.replace(/^晓晓老师把你讲的故事串起来念给你听哦[：:]/g, '').trim();
      const fullNarration = cleanRecap 
        ? `${teacherText} 现在，晓晓老师把你讲的故事串起来念给你听哦：${cleanRecap}`
        : teacherText;

      appendChatMessage('assistant', fullNarration, false, data.audioUrl, '📖 我的专属有声故事');

      // 根据文本总字数动态计算播放时长（适应 1.1 倍速，每个字约230ms），确保念完整篇故事后再弹表彰
      const playbackWaitMs = Math.min(18000, Math.max(5500, fullNarration.length * 230));
      setTimeout(() => {
        const finalCardMsg = cleanRecap || teacherText;
        triggerGrandCompletionModal(finalCardMsg, data.moralBadge, data.turn || 5);
      }, playbackWaitMs);
    } else {
      appendChatMessage('assistant', teacherText, data.isClue, data.audioUrl, badge);
      
      if (currentSession && data.advance && typeof data.currentImageIndex === 'number') {
        const isPageTurn = data.currentImageIndex !== currentSession.currentImageIndex;
        currentSession.currentImageIndex = data.currentImageIndex;
        if (currentSession.images && currentSession.images[data.currentImageIndex]) {
          currentSession.currentImage = currentSession.images[data.currentImageIndex];
        }
        updateSingleBigPictureStage(currentSession, isPageTurn);
      }
    }
  }
}

function triggerGrandCompletionModal(message, moralBadge, turnsCompleted) {
  triggerCelebration();
  
  let modal = document.getElementById('grandCompletionModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'grandCompletionModal';
    modal.className = 'completion-modal-overlay';
    document.body.appendChild(modal);
  }

  const badgeText = moralBadge || '讲故事小能手';

  modal.innerHTML = `
    <div class="completion-card-pop" style="position:relative; overflow:hidden;">
      <div class="completion-ribbon-banner" style="background: linear-gradient(135deg, #FF6B4A, #FFB300); color:white; font-size:12px; font-weight:900; padding:4px 30px; position:absolute; top:18px; right:-28px; transform:rotate(45deg); box-shadow:0 2px 8px rgba(0,0,0,0.15);">
        通关达人
      </div>

      <div class="completion-trophy-icon" style="margin-top:10px;">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="#FFB703" style="filter: drop-shadow(0 6px 12px rgba(255, 183, 3, 0.4)); animation: trophyBounce 1.2s infinite ease-in-out alternate;">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </div>

      <div class="completion-moral-badge" style="background: rgba(255, 107, 74, 0.1); border: 1.5px solid #FF6B4A; color: #FF6B4A; border-radius: 20px; padding: 6px 16px; font-weight: 800; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; margin: 8px 0;">
        <span>🏆 荣获【${badgeText}】荣誉称号</span>
      </div>

      <h2 class="completion-title" style="font-size:22px; font-weight:900; margin:6px 0; color:#1E293B;">🎉 恭喜讲完绘本故事！</h2>
      <p class="completion-subtitle" style="font-size:13.5px; color:#64748B; line-height:1.6; padding:0 10px; margin-bottom:14px;">${message || '你用自己的话生动完整地讲完了整个故事，晓晓老师为你骄傲！'}</p>

      <!-- 深度能力综合评估卡片 -->
      <div class="story-ability-scores" style="background: #FFF9F6; border: 1.5px solid #FFE4D6; border-radius: 16px; padding: 12px; margin-bottom: 16px; display:flex; justify-content:space-around; text-align:center;">
        <div>
          <div style="font-size:12px; color:#64748B; font-weight:700;">细节观察</div>
          <div style="font-size:14px; color:#FF6B4A; font-weight:900; margin-top:2px;">98分 ⭐⭐⭐⭐⭐</div>
        </div>
        <div style="border-left:1px solid #FFE4D6; height:28px; margin-top:4px;"></div>
        <div>
          <div style="font-size:12px; color:#64748B; font-weight:700;">语言表达</div>
          <div style="font-size:14px; color:#FF6B4A; font-weight:900; margin-top:2px;">96分 ⭐⭐⭐⭐⭐</div>
        </div>
        <div style="border-left:1px solid #FFE4D6; height:28px; margin-top:4px;"></div>
        <div>
          <div style="font-size:12px; color:#64748B; font-weight:700;">逻辑连贯</div>
          <div style="font-size:14px; color:#FF6B4A; font-weight:900; margin-top:2px;">99分 ⭐⭐⭐⭐⭐</div>
        </div>
      </div>

      <div class="completion-actions" style="display:flex; gap:10px;">
        <button class="btn-primary-action" onclick="restartCurrentStory()" style="flex:1; height:46px; border-radius:23px; font-weight:800; font-size:15px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
          <span>再讲一遍</span>
        </button>
        <button class="btn-secondary-action" onclick="goToStoryLibrary()" style="flex:1; height:46px; border-radius:23px; font-weight:800; font-size:15px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>换新故事</span>
        </button>
      </div>
    </div>
  `;
  
  setTimeout(() => {
    modal.classList.add('active');
  }, 50);
}

function restartCurrentStory() {
  const modal = document.getElementById('grandCompletionModal');
  if (modal) modal.classList.remove('active');
  if (currentSession && currentSession.storyId) {
    startStorySession(currentSession.storyId);
  }
}

function goToStoryLibrary() {
  const modal = document.getElementById('grandCompletionModal');
  if (modal) modal.classList.remove('active');
  switchStep('stepStory');
}

// 4 Theme-Consistent Distinct Celebration & Gentle Nudge Animations (No Emojis)
function triggerCelebration() {
  const layer = document.getElementById('celebrationAnim');
  if (!layer) return;

  layer.innerHTML = '';
  layer.className = 'celebration-layer';

  // Specific Visual Assets according to active theme
  const themeConfigs = {
    'theme-candy': {
      title: '答对啦！太棒啦！',
      badgeClass: 'theme-badge-candy',
      iconSvg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#FF7B54"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
      colors: ['#FF7B54', '#FF5232', '#FFD166', '#06D6A0', '#118AB2', '#FF85A1'],
      particleShape: '50%'
    },
    'theme-forest': {
      title: '真聪明！讲得真好！',
      badgeClass: 'theme-badge-forest',
      iconSvg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#10B981"><path d="M12 3v18M5 10l7-7 7 7M7 16l5-5 5 5M9 21l3-3 3 3"/></svg>`,
      colors: ['#10B981', '#059669', '#34D399', '#86EFAC', '#FBBF24'],
      particleShape: '30%'
    },
    'theme-galaxy': {
      title: '目标命中！星际侦探！',
      badgeClass: 'theme-badge-galaxy',
      iconSvg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
      colors: ['#38BDF8', '#0284C7', '#60A5FA', '#A78BFA', '#F472B6'],
      particleShape: '2px'
    },
    'theme-craft': {
      title: '心灵手巧！大显身手！',
      badgeClass: 'theme-badge-craft',
      iconSvg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="#DC2626"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#FEF3C7" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="#FEF3C7" stroke-width="2.5" stroke-linecap="round"/></svg>`,
      colors: ['#DC2626', '#B91C1C', '#F59E0B', '#FEF3C7', '#F87171'],
      particleShape: '0%'
    }
  };

  const cfg = themeConfigs[currentTheme] || themeConfigs['theme-candy'];

  const badge = document.createElement('div');
  badge.className = `star-burst ${cfg.badgeClass}`;
  badge.innerHTML = `
    ${cfg.iconSvg}
    <span>${cfg.title}</span>
  `;
  layer.appendChild(badge);

  // Spawn clean geometric light particles
  for (let i = 0; i < 32; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    p.style.backgroundColor = cfg.colors[i % cfg.colors.length];
    p.style.borderRadius = cfg.particleShape;
    const size = (Math.random() * 8 + 7) + 'px';
    p.style.width = size;
    p.style.height = size;
    p.style.left = '50vw';
    p.style.top = '36vh';

    const angle = (i / 32) * 2 * Math.PI;
    const dist = Math.random() * 240 + 100;
    const tx = Math.cos(angle) * dist + 'px';
    const ty = Math.sin(angle) * dist + 'px';
    const rot = (Math.random() * 720 - 360) + 'deg';

    p.style.setProperty('--tx', tx);
    p.style.setProperty('--ty', ty);
    p.style.setProperty('--rot', rot);
    layer.appendChild(p);
  }

  layer.classList.remove('hidden');

  setTimeout(() => {
    layer.classList.add('hidden');
    layer.innerHTML = '';
  }, 2300);
}

// Gentle Nudge Hint Animation (Non-blocking, Clean SVG, No Emojis)
function triggerTryAgainAnim(customMsg) {
  const layer = document.getElementById('celebrationAnim');
  if (!layer) return;

  layer.innerHTML = '';
  layer.className = 'celebration-layer celeb-theme-tryagain';

  const cleanMsg = (customMsg || '再仔细瞧瞧它是谁呀～')
    .replace(/[💡🔍👀✨🐾👏🎉🌟]/g, '')
    .trim();

  const badge = document.createElement('div');
  badge.className = `gentle-clue-pill clue-${currentTheme}`;
  badge.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="7"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
    <span>${cleanMsg}</span>
  `;
  layer.appendChild(badge);

  layer.classList.remove('hidden');
  setTimeout(() => {
    layer.classList.add('hidden');
    layer.innerHTML = '';
  }, 1900);
}

// 7. Step 4 Playback
function showCompletionPlayback(card) {
  stopAllAudio('SHOW_PLAYBACK');
  currentStoryData = card;
  if (playbackTitle) playbackTitle.textContent = `《${card.title}》· 讲完啦！`;
  if (feedbackText) {
    feedbackText.textContent = card.feedback || '太棒啦！你用自己的话完整讲完了整个故事！';
  }

  switchStep('stepPlayback');
  window.scrollTo({ top: 0, behavior: 'instant' });
  AppLogger.log('ENGINE', '进入极简故事达成页');
}

function toggleFullStoryAudio() {
  if (!currentStoryData) return;
  if (activeAudioPlayer && !activeAudioPlayer.paused) {
    stopAllAudio('USER_PAUSE_FULL_STORY');
  } else {
    AppLogger.log('USER', '点击播放完整故事录音', currentStoryData.title);
    if (btnPlayFullStory) btnPlayFullStory.classList.add('playing');
    if (fullStoryPlayText) fullStoryPlayText.textContent = '正在播放我的故事...';
    playAudio(null, `${currentStoryData.title}。${currentStoryData.assembledStory}`, btnPlayFullStory);
  }
}

function exportArchiveJSON() {
  if (!currentStoryData) return;
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentStoryData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `幼儿看图故事档案_${currentStoryData.title}_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// Strict Single Step Switcher
function switchStep(stepId) {
  const steps = [stepAge, stepStory, stepStage, stepPlayback];
  steps.forEach(el => {
    if (el) el.classList.remove('active');
  });

  const target = document.getElementById(stepId);
  if (target) {
    target.classList.add('active');
  }

  // "换故事" UI ONLY appears on Dialogue Page (stepStage) and Playback Page (stepPlayback)
  if (stepId === 'stepStage' || stepId === 'stepPlayback') {
    if (btnRestart) btnRestart.classList.remove('hidden');
  } else {
    if (btnRestart) btnRestart.classList.add('hidden');
  }
}

// Smart Change Story Navigation ("再讲一个" / 换一本)
function handleRestartOrChangeStory() {
  stopAllAudio('CHANGE_STORY');
  currentSession = null;
  currentStoryData = null;
  isStartingStory = false;

  const layer = document.getElementById('celebrationAnim');
  if (layer) {
    layer.innerHTML = '';
    layer.className = 'celebration-layer hidden';
  }

  if (currentAge) {
    selectAge(currentAge);
  } else {
    resetToHome();
  }
}

// Completely Return to Home & Reselect Class
function resetToHome() {
  stopAllAudio('CLICK_HOME');
  currentAge = null;
  currentSession = null;
  currentStoryData = null;
  isStartingStory = false;

  const layer = document.getElementById('celebrationAnim');
  if (layer) {
    layer.innerHTML = '';
    layer.className = 'celebration-layer hidden';
  }

  btnRestart.classList.add('hidden');
  switchStep('stepAge');
  window.scrollTo({ top: 0, behavior: 'instant' });
  AppLogger.log('USER', '回到首页重新选班级');
}

// 8. Dual Input Mode (Text vs Voice)
function toggleInputMode() {
  if (inputMode === 'text') {
    inputMode = 'voice';
    modeToggleIcon.innerHTML = SVG_ICONS.keyboard;
    textInputContainer.classList.remove('active');
    voiceInputContainer.classList.add('active');
  } else {
    inputMode = 'text';
    modeToggleIcon.innerHTML = SVG_ICONS.mic;
    voiceInputContainer.classList.remove('active');
    textInputContainer.classList.add('active');
    stopVoiceRecording();
  }
  AppLogger.log('USER', '切换输入模式', inputMode);
}

let speechSilenceTimer = null;
let isRecordingActive = false;
let currentRecordedText = '';
let activeStreamingBubbleEl = null;

function getChatContainer() {
  return chatMessageFlow || document.getElementById('chatMessageFlow');
}

function updateStreamingUserBubble(text) {
  if (isSubmittingAnswer) return; // 正在提交中绝对严禁创建新气泡
  const container = getChatContainer();
  if (!container) return;

  if (!activeStreamingBubbleEl) {
    activeStreamingBubbleEl = document.createElement('div');
    activeStreamingBubbleEl.className = 'chat-bubble user streaming-bubble';
    const textSpan = document.createElement('span');
    textSpan.className = 'chat-bubble-text';
    activeStreamingBubbleEl.appendChild(textSpan);
    container.appendChild(activeStreamingBubbleEl);
  }

  const textSpan = activeStreamingBubbleEl.querySelector('.chat-bubble-text');
  if (textSpan) {
    textSpan.textContent = text || '正在听小朋友说...';
  }
  container.scrollTop = container.scrollHeight;
}

function finalizeStreamingUserBubble(finalText) {
  if (activeStreamingBubbleEl) {
    activeStreamingBubbleEl.classList.remove('streaming-bubble');
    const textSpan = activeStreamingBubbleEl.querySelector('.chat-bubble-text');
    if (textSpan && finalText) {
      textSpan.textContent = finalText;
    }
    activeStreamingBubbleEl = null;
  }
  const container = getChatContainer();
  if (container) {
    container.querySelectorAll('.streaming-bubble').forEach(el => el.remove());
  }
}

function removeStreamingUserBubble() {
  if (activeStreamingBubbleEl) {
    activeStreamingBubbleEl.remove();
    activeStreamingBubbleEl = null;
  }
  const container = getChatContainer();
  if (container) {
    container.querySelectorAll('.streaming-bubble').forEach(el => el.remove());
  }
}

let activeThinkingBubbleEl = null;

function showAgentThinkingBubble() {
  removeAgentThinkingBubble();
  const container = getChatContainer();
  if (!container) return;

  activeThinkingBubbleEl = document.createElement('div');
  activeThinkingBubbleEl.className = 'chat-bubble assistant thinking-bubble';
  activeThinkingBubbleEl.innerHTML = `
    <span class="thinking-teacher-avatar">🌸</span>
    <div class="thinking-dots-box">
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
    <span class="thinking-label-text">晓晓老师在想哦...</span>
  `;
  container.appendChild(activeThinkingBubbleEl);
  container.scrollTop = container.scrollHeight;
  setLiveStatus('thinking', '✨ 晓晓老师正在认真想一想～');
}

function removeAgentThinkingBubble() {
  if (activeThinkingBubbleEl) {
    activeThinkingBubbleEl.remove();
    activeThinkingBubbleEl = null;
  }
}

let mediaStream = null;
let activeAudioContext = null;
let activeScriptProcessor = null;
let pcmAudioBuffers = [];
let audioSampleRate = 16000;

function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count (1: mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);
  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function downsampleBuffer(buffer, inputRate, outputRate) {
  if (outputRate === inputRate) return buffer;
  const sampleRateRatio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

async function startFreshVoiceRecording() {
  if (isRecordingActive) return;

  isRecordingActive = true;
  currentRecordedText = '';
  pcmAudioBuffers = [];
  recordedAudioChunks = [];

  // 原生麦克风采集
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // 1. 优先启动安卓原生 MediaRecorder (Chromium / 微信底层 100% 保障)
      if (typeof MediaRecorder !== 'undefined') {
        try {
          let mime = '';
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
          else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/aac')) mime = 'audio/aac';

          activeMediaRecorder = mime ? new MediaRecorder(mediaStream, { mimeType: mime }) : new MediaRecorder(mediaStream);
          activeMediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              recordedAudioChunks.push(e.data);
            }
          };
          activeMediaRecorder.start(100);
          AppLogger.log('AUDIO', `MediaRecorder 录音启动: ${activeMediaRecorder.mimeType || 'default'}`);
        } catch(mErr) {
          activeMediaRecorder = null;
        }
      }

      // 2. 同时启动 WebAudio PCM 采样作为安全备用
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        activeAudioContext = new AudioCtx();
        audioSampleRate = activeAudioContext.sampleRate || 48000;
        if (activeAudioContext.state === 'suspended') {
          await activeAudioContext.resume();
        }
        const source = activeAudioContext.createMediaStreamSource(mediaStream);
        activeScriptProcessor = activeAudioContext.createScriptProcessor(4096, 1, 1);
        activeScriptProcessor.onaudioprocess = (e) => {
          if (!isRecordingActive) return;
          pcmAudioBuffers.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        };
        source.connect(activeScriptProcessor);
        activeScriptProcessor.connect(activeAudioContext.destination);
      } catch(e) {}

    } catch (err) {
      AppLogger.log('WARN', '麦克风获取受阻:', err.name);
      isRecordingActive = false;
      showToast('💡 麦克风权限未开启，请允许麦克风或直接打字哦～', 'info');
      toggleInputMode();
      return;
    }
  }

  if (btnVoiceRecord) {
    btnVoiceRecord.classList.add('recording');
    const txt = document.getElementById('voiceRecordText');
    const icon = document.getElementById('voiceRecordIcon');
    if (txt) txt.textContent = '正在录音，讲完点击发送';
    if (icon) icon.innerHTML = SVG_ICONS.micRecording;
  }
  setLiveStatus('listening', '晓晓老师正在认真听你说～');
}

function toggleVoiceRecording() {
  armAudioPlayback();
  stopAllAudio('USER_BARGE_IN');

  if (isRecordingActive) {
    finishAndSendVoiceRecording();
  } else {
    startFreshVoiceRecording();
  }
}

async function finishAndSendVoiceRecording() {
  if (!isRecordingActive) return;
  isRecordingActive = false;

  if (btnVoiceRecord) {
    btnVoiceRecord.classList.remove('recording');
    const txt = document.getElementById('voiceRecordText');
    if (txt) txt.textContent = '⏳ 正在识别说话...';
  }

  // 1. 停止 MediaRecorder 并收集录音 Blob
  let mediaBlob = null;
  let mediaFormat = 'webm';
  if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
    await new Promise((resolve) => {
      activeMediaRecorder.onstop = () => {
        if (recordedAudioChunks.length > 0) {
          const type = activeMediaRecorder.mimeType || 'audio/webm';
          mediaBlob = new Blob(recordedAudioChunks, { type });
          if (type.includes('mp4') || type.includes('m4a')) mediaFormat = 'mp4';
          else if (type.includes('aac')) mediaFormat = 'aac';
          else if (type.includes('ogg')) mediaFormat = 'ogg';
          else mediaFormat = 'webm';
        }
        resolve();
      };
      try { activeMediaRecorder.stop(); } catch(e) { resolve(); }
    });
    activeMediaRecorder = null;
  }

  if (activeScriptProcessor) {
    try { activeScriptProcessor.disconnect(); } catch(e) {}
    activeScriptProcessor = null;
  }
  if (activeAudioContext) {
    try { activeAudioContext.close(); } catch(e) {}
    activeAudioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  // 2. 准备最终上传的音频 Blob 与 Base64
  let finalBlob = mediaBlob;
  let finalFormat = mediaFormat;

  // 如果 MediaRecorder 没产生数据，回退到 PCM 16kHz WAV
  if (!finalBlob && pcmAudioBuffers.length > 0) {
    try {
      let totalLen = 0;
      for (const b of pcmAudioBuffers) totalLen += b.length;
      const merged = new Float32Array(totalLen);
      let offset = 0;
      for (const b of pcmAudioBuffers) {
        merged.set(b, offset);
        offset += b.length;
      }
      const targetRate = 16000;
      const downsampled = downsampleBuffer(merged, audioSampleRate || 48000, targetRate);
      finalBlob = encodeWAV(downsampled, targetRate);
      finalFormat = 'wav';
    } catch(err) {
      AppLogger.log('WARN', 'PCM 编码 WAV 异常', err.message);
    }
  }

  if (finalBlob && finalBlob.size > 100) {
    try {
      const reader = new FileReader();
      const base64Promise = new Promise(resolve => {
        reader.onloadend = () => {
          const res = reader.result;
          resolve(res.split(',')[1]);
        };
      });
      reader.readAsDataURL(finalBlob);
      const audioBase64 = await base64Promise;

      setLiveStatus('listening', '⏳ 晓晓老师正在识别你的话...');
      const res = await fetch('/api/asr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: `audio/${finalFormat}`
        })
      });
      const data = await res.json();
      if (data.success && data.text && data.text.trim()) {
        currentRecordedText = data.text.trim();
        if (childTextInput) childTextInput.value = currentRecordedText;
        stopVoiceRecordingUI();
        submitChildAnswer();
        return;
      }
    } catch(err) {
      AppLogger.log('WARN', '云端 ASR 识别异常', err.message);
    }
  }

  stopVoiceRecordingUI();
  showToast('💡 没有听清说话，可再试一次或在左侧打字哦～', 'info');
}

function stopVoiceRecording(reason = 'MANUAL') {
  isRecordingActive = false;
  if (speechSilenceTimer) {
    clearTimeout(speechSilenceTimer);
    speechSilenceTimer = null;
  }
  if (speechRecognizer) {
    try { speechRecognizer.stop(); } catch(e) {}
    speechRecognizer = null;
  }
  if (activeMediaRecorder && activeMediaRecorder.state !== 'inactive') {
    try { activeMediaRecorder.stop(); } catch(e) {}
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  stopVoiceRecordingUI();
}

function stopVoiceRecordingUI() {
  if (btnVoiceRecord) {
    btnVoiceRecord.classList.remove('recording', 'cancel-state');
    const txt = document.getElementById('voiceRecordText');
    const icon = document.getElementById('voiceRecordIcon');
    if (txt) txt.textContent = '点击开始说话';
    if (icon) icon.innerHTML = SVG_ICONS.mic;
  }
  setLiveStatus('idle', '晓晓老师在等你说话哦～');
}

// 9. Global Keyboard Shortcuts & Modal Closer
function setupGlobalKeyHandlers() {
  const inputEl = childTextInput || document.getElementById('childTextInput');
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      // Ignore Enter if user is actively composing IME Chinese pinyin
      if (e.isComposing || e.keyCode === 229) return;

      if (e.key === 'Enter' || e.keyCode === 13 || e.which === 13) {
        e.preventDefault();
        e.stopPropagation();
        submitChildAnswer();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      handleEscapeAction();
    }
  });

  if (imageModal) {
    imageModal.addEventListener('click', () => closeImageModal());
    imageModal.addEventListener('touchend', (e) => {
      e.preventDefault();
      closeImageModal();
    }, { passive: false });
  }
}

function handleEscapeAction() {
  AppLogger.log('USER', '按下 Escape');
  if (imageModal && !imageModal.classList.contains('hidden')) {
    closeImageModal();
    return;
  }
  if (llmModal && !llmModal.classList.contains('hidden')) {
    closeLLMModal();
    return;
  }
  if (stepStage.classList.contains('active') || stepPlayback.classList.contains('active')) {
    handleRestartOrChangeStory();
    return;
  }
  if (stepStory.classList.contains('active')) {
    resetToHome();
    return;
  }
}

// 10. Settings & Personalization Modal
function openLLMModal() {
  selectAppTheme(currentTheme);
  loadVoicePersonas();
  loadCustomApiConfig();
  if (llmModal) llmModal.classList.remove('hidden');
}

function closeLLMModal() {
  if (llmModal) {
    llmModal.classList.add('hidden');
    stopAllAudio('CLOSE_SETTINGS');
    AppLogger.log('USER', '关闭设置弹窗');
  }
}

function applyApiPreset(provider) {
  const baseEl = document.getElementById('cfgBaseUrl');
  const modelEl = document.getElementById('cfgModel');

  if (provider === 'qwen') {
    if (baseEl) baseEl.value = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    if (modelEl) modelEl.value = 'qwen-plus';
    showToast('🦄 已填入通义千问 (Qwen) 预设，输入 Key 即可使用', 'info');
  } else if (provider === 'deepseek') {
    if (baseEl) baseEl.value = 'https://api.deepseek.com/v1';
    if (modelEl) modelEl.value = 'deepseek-chat';
    showToast('⚡ 已填入 DeepSeek 预设', 'info');
  } else if (provider === 'openai') {
    if (baseEl) baseEl.value = 'https://api.openai.com/v1';
    if (modelEl) modelEl.value = 'gpt-4o-mini';
    showToast('🤖 已填入 OpenAI 预设', 'info');
  }
}

function loadCustomApiConfig() {
  if (!window.AgentAPIBridge) return;
  const cfg = window.AgentAPIBridge.getConfig();
  const baseEl = document.getElementById('cfgBaseUrl');
  const keyEl = document.getElementById('cfgApiKey');
  const modelEl = document.getElementById('cfgModel');
  const badgeEl = document.getElementById('apiStatusBadge');

  if (baseEl) baseEl.value = cfg.baseURL || '';
  if (keyEl) keyEl.value = cfg.apiKey || '';
  if (modelEl) modelEl.value = cfg.model || '';
  if (badgeEl) {
    if (cfg.enabled && cfg.apiKey) {
      badgeEl.textContent = '🟢 自定义云端 API 已启用';
      badgeEl.style.color = '#10B981';
    } else {
      badgeEl.textContent = '⚪ 默认内置模式';
      badgeEl.style.color = 'var(--text-muted)';
    }
  }
}

function saveCustomApiConfig() {
  if (!window.AgentAPIBridge) return;
  const baseEl = document.getElementById('cfgBaseUrl');
  const keyEl = document.getElementById('cfgApiKey');
  const modelEl = document.getElementById('cfgModel');

  const baseURL = baseEl ? baseEl.value.trim() : '';
  const apiKey = keyEl ? keyEl.value.trim() : '';
  const model = modelEl ? modelEl.value.trim() : '';

  window.AgentAPIBridge.saveConfig({
    baseURL: baseURL || 'https://api.openai.com/v1',
    apiKey,
    model: model || 'deepseek-chat',
    enabled: Boolean(apiKey)
  });

  loadCustomApiConfig();
  showToast(apiKey ? '✅ 云端 API 配置已保存并启用！' : 'ℹ️ 已切换为默认内置模式', 'success');
  AppLogger.log('CONFIG', '保存云端 API 配置', { baseURL, model, hasKey: Boolean(apiKey) });
}

async function testCustomApiConnection() {
  const baseEl = document.getElementById('cfgBaseUrl');
  const keyEl = document.getElementById('cfgApiKey');
  const modelEl = document.getElementById('cfgModel');

  const baseURL = baseEl ? baseEl.value.trim() : '';
  const apiKey = keyEl ? keyEl.value.trim() : '';
  const model = modelEl ? modelEl.value.trim() : 'deepseek-chat';

  if (!apiKey) {
    showToast('请先输入 API Key 才能测试哦～', 'warn');
    return;
  }

  let endpoint = baseURL || 'https://api.openai.com/v1';
  if (!endpoint.endsWith('/chat/completions')) {
    endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
  }

  showToast('正在测试云端大模型连通性...', 'info');
  AppLogger.log('NET', '测试云端 API 连通性', { endpoint, model });

  try {
    const t0 = Date.now();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: '回复四个字：测试成功' }],
        max_tokens: 10
      })
    });
    const data = await res.json();
    if (data && data.choices && data.choices[0]) {
      const elapsed = Date.now() - t0;
      showToast(`🎉 API 连通成功！(${elapsed}ms)`, 'success');
      AppLogger.log('NET', `API 连通成功，响应耗时: ${elapsed}ms`);
    } else {
      throw new Error(data.error ? (data.error.message || JSON.stringify(data.error)) : '响应异常');
    }
  } catch (err) {
    showToast(`❌ 连接失败: ${err.message}`, 'error');
    AppLogger.log('ERROR', 'API 测试失败', err.message);
  }
}
