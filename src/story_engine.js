const fs = require('fs');
const path = require('path');
const ttsService = require('./tts_service');
const llmAgentCore = require('./llm_agent_core');
const dataCollector = require('./data_collector');

class StoryEngine {
  constructor(customStoriesDir = null) {
    this.storiesDir = customStoriesDir || path.join(__dirname, '../knowledge_base/generated_stories');
    this.stories = {};
    this.sessions = new Map();
    this.loadStories();
  }

  loadStories() {
    if (!fs.existsSync(this.storiesDir)) {
      console.warn(`[StoryEngine] 绘本目录不存在: ${this.storiesDir}`);
      return;
    }

    const files = fs.readdirSync(this.storiesDir).filter(f => f.endsWith('.json'));
    files.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(this.storiesDir, file), 'utf8');
        const parsed = JSON.parse(content);
        if (parsed && parsed.story_id) {
          this.stories[parsed.story_id] = parsed;
        }
      } catch (err) {
        console.error(`[StoryEngine] 加载绘本失败: ${file}`, err.message);
      }
    });

    console.log(`[StoryEngine] 成功加载 ${Object.keys(this.stories).length} 套真实绘本知识库`);
  }

  getStories(ageGroup = null) {
    const list = Object.values(this.stories).filter(s => {
      // Exclude low-quality stories with duplicate images
      if (s.quality && s.quality.flags && s.quality.flags.includes('duplicate_images')) {
        return false;
      }
      return true;
    });

    const filtered = (!ageGroup || ageGroup === 'all') 
      ? list 
      : list.filter(s => s.suitable_age && Array.isArray(s.suitable_age) && s.suitable_age.includes(ageGroup));
    
    // Fisher-Yates True Random Shuffle on each query
    const shuffled = [...filtered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Return clean DTO without private_annotations
    return shuffled.map(story => ({
      story_id: story.story_id,
      title: story.title,
      cover_url: story.cover_url || (story.images && story.images[0] && story.images[0].image_url) || '',
      category: story.category,
      suitable_age: story.suitable_age,
      total_images: story.images ? story.images.length : 1,
      images: (story.images || []).map(img => ({
        order: img.order,
        file: img.file,
        image_url: img.image_url,
        visual_clues: img.visual_clues || []
      }))
    }));
  }

  getStoriesByAge(ageGroup = 'small') {
    return this.getStories(ageGroup);
  }

  getStoryById(storyId) {
    if (!storyId) return null;
    return this.stories[storyId] || Object.values(this.stories).find(s => s.title === storyId) || null;
  }

  sanitizeImage(image) {
    if (!image) return null;
    const clone = JSON.parse(JSON.stringify(image));
    delete clone.private_annotations;
    return clone;
  }

  generateOpeningPrompt(story, ageGroup = 'small') {
    const title = (story && story.title) || '绘本故事';
    return `今天我们来看《${title}》！快看这幅画，你能把这个故事讲给晓晓老师听听吗？`;
  }

  generateNextFramePrompt(nextIndex) {
    const prompts = [
      `真棒！快看第 ${nextIndex + 1} 幅画，它在做什么呀？`,
      `哇，小眼睛真亮！翻到第 ${nextIndex + 1} 页看看，接下来发生了什么？`,
      `太厉害啦！快瞧第 ${nextIndex + 1} 幅画，小家伙现在在干嘛呢？`,
      `回答得真好！快看第 ${nextIndex + 1} 幅画，又出现了什么有趣的事情呀？`,
      `真聪明！接下来会怎样呢？快看第 ${nextIndex + 1} 幅画～`
    ];
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  generateActionProbePrompt(ageGroup = 'small') {
    const prompts = [
      '真棒！那它在做什么呢？',
      '小眼睛真亮！那他们在忙活着什么呀？',
      '对啦！那他们在画里做什么动作呢？',
      '真聪明！那他们手里在做什么好玩的事情呀？'
    ];
    return prompts[Math.floor(Math.random() * prompts.length)];
  }

  async startSession(storyId, ageGroup = 'small', voiceId = 'xiaoxiao') {
    const story = this.getStoryById(storyId);
    if (!story) throw new Error(`未找到故事: ${storyId}`);

    const sanitizedImages = story.images.map(img => this.sanitizeImage(img));
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const session = {
      sessionId,
      storyId: story.story_id,
      storyTitle: story.title,
      ageGroup,
      voiceId,
      currentImageIndex: 0,
      totalImages: story.images.length,
      images: sanitizedImages,
      history: [],
      childQuotes: [],
      state: 'IN_PROGRESS',
      frameStep: 0,
      startTime: Date.now()
    };

    const totalImgs = story.images.length;
    let initialQuestion = "小朋友，画面中你看到了谁？它在干什么呀？";
    try {
      const configPath = path.join(__dirname, 'config/pedagogy_config.json');
      if (fs.existsSync(configPath)) {
        const pedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (pedConfig.fixed_openings && pedConfig.fixed_openings[String(totalImgs)]) {
          initialQuestion = pedConfig.fixed_openings[String(totalImgs)];
        }
      }
    } catch (e) {}

    session.history.push({
      role: 'assistant',
      content: initialQuestion,
      type: 'INIT_QUESTION'
    });

    this.sessions.set(sessionId, session);

    return {
      sessionId,
      storyTitle: story.title,
      currentImageIndex: 0,
      totalImages: story.images.length,
      currentImage: sanitizedImages[0],
      images: sanitizedImages,
      agentMessage: initialQuestion,
      audioUrl: null,
      state: 'IN_PROGRESS'
    };
  }

  async getClue(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('会话不存在');
    const story = this.getStoryById(session.storyId);
    const rawImage = story.images[session.currentImageIndex] || story.images[0];
    const clueText = (rawImage.visual_clues && rawImage.visual_clues[0]) || '没关系，看正中间那个小家伙～';

    return {
      success: true,
      isClue: true,
      agentMessage: clueText
    };
  }

  async interact(sessionId, userInput, storyId = null) {
    let session = this.sessions.get(sessionId);
    if (!session) {
      // 自动自愈重建 Session，防止因后台重启导致报错
      const targetStoryId = storyId || Object.keys(this.stories)[0];
      const story = this.getStoryById(targetStoryId);
      if (story) {
        session = {
          sessionId,
          storyId: story.story_id,
          storyTitle: story.title,
          ageGroup: 'small',
          voiceId: 'xiaoxiao',
          currentImageIndex: 0,
          totalImages: story.images.length,
          images: story.images.map(img => this.sanitizeImage(img)),
          history: [],
          childQuotes: [],
          state: 'IN_PROGRESS',
          frameStep: 0,
          startTime: Date.now()
        };
        this.sessions.set(sessionId, session);
      } else {
        throw new Error('会话不存在或已过期');
      }
    }

    const rawStory = this.getStoryById(session.storyId);
    const rawImage = rawStory.images[session.currentImageIndex];
    const cleanText = (userInput || '').trim();

    session.history.push({ role: 'user', content: cleanText });

    // 1. Extract ground-truth tags from database (Fact-Lock)
    const charKeywords = [];
    const actionKeywords = [];
    const locationKeywords = [];
    const objectKeywords = [];
    const timeKeywords = [];

    if (rawImage.private_annotations && rawImage.private_annotations.tags) {
      rawImage.private_annotations.tags.forEach(tag => {
        const parts = tag.split(':');
        if (parts.length > 1) {
          const type = parts[0].trim();
          const val = parts[1].trim();
          if (type.includes('角色')) charKeywords.push(val);
          else if (type.includes('动作')) actionKeywords.push(val);
          else if (type.includes('场景') || type.includes('地点')) locationKeywords.push(val);
          else if (type.includes('时间') || type.includes('天气')) timeKeywords.push(val);
          else if (type.includes('物体')) objectKeywords.push(val);
        }
      });
    }

    const visualSummary = (rawImage.private_annotations && rawImage.private_annotations.visible_summary) || '';
    const visualClues = rawImage.visual_clues || [];
    const allValidVisuals = [...charKeywords, ...actionKeywords, ...locationKeywords, ...timeKeywords, ...objectKeywords];

    session.frameFailCount = session.frameFailCount || 0;
    const isStrongGuidance = session.frameFailCount >= 1; // 已经有1次答不上，本次进入第2次及以上 ➔ 强引导

    // Pure LLM Agent Reasoning with Pedagogical SOP (100% Dynamic!)
    let agentDecision = null;
    if (llmAgentCore && llmAgentCore.isConfigured()) {
      try {
        agentDecision = await llmAgentCore.decideNextAction({
          storyTitle: rawStory.title,
          storyThemes: rawStory.themes || [rawStory.scene_theme || '成长启蒙'],
          ageGroup: session.ageGroup,
          frameIndex: session.currentImageIndex,
          totalFrames: session.totalImages,
          visibleTags: allValidVisuals,
          expectedElements: {
            character: charKeywords[0] || '',
            action: actionKeywords[0] || '',
            location: locationKeywords[0] || '',
            time: timeKeywords[0] || ''
          },
          visualSummary,
          visualClues,
          failCount: session.frameFailCount,
          guidanceLevel: isStrongGuidance ? 'STRONG' : 'SOFT',
          childInput: cleanText,
          history: session.history
        });
      } catch (e) {
        console.error('[StoryEngine] LLM Error:', e.message);
      }
    }

    if (!agentDecision) {
      agentDecision = {
        action: 'probe_element',
        teacher_reply: '真棒！那它正在做什么呀？',
        is_correct: true
      };
    }

    const teacherReply = agentDecision.teacher_reply || agentDecision.teacherReply || '讲得真好！';
    session.history.push({ role: 'assistant', content: teacherReply });

    let audioUrl = null;
    try { 
      audioUrl = await ttsService.synthesize(teacherReply, session.voiceId || 'xiaoxiao'); 
    } catch(e) {}

    const isCorrect = !!(agentDecision.is_correct || agentDecision.isCorrect);

    if (isCorrect) {
      session.childQuotes.push(cleanText);
      session.frameFailCount = 0; // 答对即清零
    } else {
      session.frameFailCount = (session.frameFailCount || 0) + 1; // 答错或卡壳累加
    }

    // 异步沉淀幼儿教学交互数据 (用于教研分析、大模型优化与评测)
    dataCollector.recordInteraction({
      sessionId,
      storyId: rawStory.story_id,
      storyTitle: rawStory.title,
      ageGroup: session.ageGroup,
      frameIndex: session.currentImageIndex,
      totalFrames: session.totalImages,
      childInput: cleanText,
      agentDecision,
      teacherReply,
      evalStatus: isCorrect ? 'CORRECT' : (agentDecision.action === 'give_clue' ? 'STUCK' : 'WRONG'),
      moralBadge: agentDecision.moralBadge || null,
      latencyMs: Date.now() - (session.lastInteractTime || Date.now())
    });
    session.lastInteractTime = Date.now();

    // Advance or Complete
    const isAdvancing = agentDecision.action === 'advance_page';
    const isCompleting = agentDecision.action === 'complete_story' || (isAdvancing && session.currentImageIndex >= session.totalImages - 1);

    if (isAdvancing) {
      session.frameFailCount = 0; // 翻页清零
    }

    if (isCompleting) {
      session.state = 'COMPLETED';

      return {
        success: true,
        sessionId,
        evalStatus: 'CORRECT',
        engineSource: 'LLM_AGENT_CORE',
        isCorrect: true,
        isClue: false,
        currentImageIndex: session.currentImageIndex,
        currentImage: session.images[session.currentImageIndex],
        agentMessage: teacherReply,
        moralBadge: agentDecision.moralBadge || '讲故事小能手',
        audioUrl,
        state: 'COMPLETED'
      };
    }

    if (isAdvancing) {
      session.currentImageIndex += 1;
      const nextPrompt = "快看新的一幅画，画里是谁？在干什么呀？";
      let nextAudioUrl = null;
      try {
        nextAudioUrl = await ttsService.synthesize(nextPrompt, session.voiceId || 'xiaoxiao');
      } catch(e) {}

      return {
        success: true,
        sessionId,
        evalStatus: 'CORRECT',
        engineSource: 'LLM_AGENT_CORE',
        isCorrect: true,
        isClue: false,
        currentImageIndex: session.currentImageIndex,
        currentImage: session.images[session.currentImageIndex],
        agentMessage: teacherReply,
        audioUrl,
        nextPrompt,
        nextAudioUrl,
        state: 'IN_PROGRESS'
      };
    }

    // Normal probing / gentle correct
    return {
      success: true,
      sessionId,
      evalStatus: isCorrect ? 'CORRECT' : 'WRONG',
      engineSource: 'LLM_AGENT_CORE',
      isCorrect,
      isClue: agentDecision.action === 'give_clue',
      currentImageIndex: session.currentImageIndex,
      currentImage: session.images[session.currentImageIndex],
      agentMessage: teacherReply,
      audioUrl,
      state: 'IN_PROGRESS'
    };
  }
}

module.exports = StoryEngine;

module.exports = StoryEngine;
