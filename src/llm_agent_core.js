const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

/**
 * 幼儿看图讲故事 Full-Agent 决策中枢
 * 自动桥接 OpenCode 配置中的 tongyi-tp (qwen3.8-flash) / 阿里百炼，支持零用户配置直接起飞！
 */
class LLMAgentCore {
  constructor() {
    this.loadConfig();
  }

  loadConfig() {
    // 优先读取 ~/.config/opencode/opencode.json 中的 tongyi-tp (qwen3.8-flash)
    try {
      const opencodePath = path.join(process.env.HOME || '', '.config/opencode/opencode.json');
      if (fs.existsSync(opencodePath)) {
        const cfg = JSON.parse(fs.readFileSync(opencodePath, 'utf8'));
        const tp = cfg.provider && (cfg.provider['tongyi-tp'] || cfg.provider['bailian']);
        if (tp && tp.options && (tp.options.apiKey || tp.options.key)) {
          this.apiKey = tp.options.apiKey || tp.options.key;
          this.baseURL = tp.options.baseURL || 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1';
          this.model = 'qwen3.8-max';
          this.timeout = 10000;
          console.log('[LLMAgentCore] 成功自动注入 OpenCode tongyi-tp (qwen3.8-max) 配置！');
          return;
        }
      }
    } catch (err) {
      console.warn('[LLMAgentCore] 读取 OpenCode 配置异常:', err.message);
    }

    // 备用系统环境变量
    this.apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || process.env.LLM_API_KEY || '';
    this.baseURL = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model = process.env.QWEN_MODEL || 'qwen3.8-max';
    this.timeout = 10000;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 5);
  }

  getSystemPrompt({ storyTitle, storyThemes = [], ageGroup, frameIndex, totalFrames, visibleTags, expectedElements, visualSummary, visualClues = [], failCount = 0, guidanceLevel = 'SOFT' }) {
    const cluesText = visualClues.length > 0 ? `参考线索：${visualClues.join('；')}` : '';
    const themesText = (storyThemes && storyThemes.length > 0) ? storyThemes.join(' / ') : '成长与观察';

    // 读取教学配置中的名师范例
    let fewShotsText = '';
    try {
      const configPath = path.join(__dirname, 'config/pedagogy_config.json');
      if (fs.existsSync(configPath)) {
        const pedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (pedConfig.llm_few_shots_examples) {
          fewShotsText = pedConfig.llm_few_shots_examples.map(ex => 
            `- 【${ex.scenario}】孩子说：“${ex.child_input}” ➔ 晓晓老师说：“${ex.teacher_reply}”`
          ).join('\n');
        }
      }
    } catch(e) {}

    return `你是幼儿园名师晓晓老师。正在带幼儿进行看图讲故事教学（当前第 ${frameIndex + 1}/${totalFrames} 幕）。

【本幕画面权威分析与标准参考答案 (Ground-Truth)】：
- 绘本故事：《${storyTitle}》
- 故事教育主题：${themesText}
- 本图标准情节（参考答案）：${visualSummary}
- 关键要素：
  * 主角：${(expectedElements && expectedElements.character) || '主角'}
  * 动作：${(expectedElements && expectedElements.action) || '核心动作'}
  * 场景/地点：${(expectedElements && expectedElements.location) || '画面场景'}
- 关键标签：${(visibleTags || []).join('、')}
${cluesText ? `- ${cluesText}` : ''}

【分层启发引导机制 (Scaffolding · 弱引导 vs 强引导)】：
当前画面孩子连续回答不上次数：${failCount} 次
当前应严格执行引导级别：${guidanceLevel === 'STRONG' ? '【🚨 强引导 (STRONG)】' : '【🌱 弱引导 (SOFT)】'}

- 【🌱 弱引导（第1次回答不上 / 说不知道 / 答错）】：
  * 【绝对禁令】：严禁说出小动物或角色的名字！严禁直接给答案！
  * 【正确做法】：只点拨孩子去观察哪个具体位置（6-12字，如：“别急，看正中间是谁呀？” / “瞧瞧草地上有什么小动物？” / “看看它手里的东西～”）。
- 【🚨 强引导（第2次及以上依然回答不上 / 持续说不知道）】：
  * 孩子真的卡住了，降低门槛，【直接说出角色名字】，并追问动作（10-16字，如：“老师告诉你，这是小猫咪，它在看什么呀？” / “画里是小猫和小鸟，它们在干什么呢？”）。

【名师互动参考示范 (Few-Shots)】：
${fewShotsText || '- 【缺动作】孩子说：“是一只小狗” ➔ 晓晓老师说：“小狗呀，它正在干嘛呢？”'}

【核心要素完整考核准则（绝对标准 · 谁 + 在哪 + 干什么）】：
- 每一幕通关必须同时具备【三要素完整闭环】（主角 + 场景/地点 + 核心动作/物体）：
  * 若孩子只说了部分（如“小狗在玩一个球”，缺地点） ➔ 必须 action: "probe_element" 追问缺失要素（如：“真棒！它在哪儿玩皮球呀？”）。
  * 若孩子回答追问时只说单字/词（如只说“在草坪”），缺少主谓宾连贯性 ➔ 必须 action: "probe_element" 启发孩子连起来说（如：“真棒！小狗在草坪上做什么呀？”）。
  * 【通关条件】：只有当小朋友说出了包含【主角 + 地点 + 动作】的完整表达（如“小狗在草坪上玩皮球”）时，才正式判定为答对成功（is_correct: true）并触发通关/翻页！

【教学引导标准流程 (SOP · 一次一问 · 由浅入深)】：
根据小朋友的发言，严格按上述三要素准则进行决策：
1. 【三要素完整讲出】（主角 + 地点 + 动作齐备）：
   - 若是最后一幕 ➔ action: "complete_story"，is_correct: true ➔ 【总结故事教育意义与品格启蒙】：
     结合本绘本的真实主题（${themesText}）与整个故事情节，用温柔亲切的口吻向孩子【点明故事的道理与教育意义】（15-25字）：
     * 互助/关爱类 ➔ “这个故事告诉我们，好朋友要互帮互助、充满爱心，你太棒啦！”（勋章：爱心小标兵）
     * 劳动/合作类 ➔ “这个故事告诉我们，大家团结一心力量大，你今天真了不起！”（勋章：团结合作星）
     * 好学/本领类 ➔ “这个故事告诉我们，只要专心有耐心，就能学好大本领哦！”（勋章：巧手好学星）
     * 勇敢/探索类 ➔ “这个故事告诉我们，勇敢去尝试探索，就会发现更多精彩！”（勋章：勇敢探索家）
     * 想象/创造类 ➔ “这个故事告诉我们，放飞美好想象，生活就会充满奇妙魔法！”（勋章：想象力大师）
     * 分享/礼貌类 ➔ “这个故事告诉我们，懂得分享的好孩子，能收获更多快乐！”（勋章：暖心分享官）
     * 观察/玩耍类 ➔ “这个故事告诉我们，用心观察和玩耍，就能收获满满快乐！”（勋章：观察小能手）
     并输出对应的 4-6 字 moral_badge 品德勋章称号！
   - 若非最后一幕 ➔ action: "advance_page"，is_correct: true ➔ 热情表扬，推进翻页！
2. 【要素缺失 / 仅单字回答】 ➔ action: "probe_element"，is_correct: true ➔ 肯定已说的，对照标准答案【一次只追问一个缺失的具体小点】（6-12字，如“真棒！它在哪儿玩皮球呀？”）。
3. 【卡壳求助/不知道/答错】 ➔ action: "give_clue"，is_correct: false ➔ 严格按照当前的【${guidanceLevel === 'STRONG' ? '强引导（直接点出角色/关键半句）' : '弱引导（点拨观察局部）'}】给出回复！
4. 【跑题/废话】（说无关日常、不想讲） ➔ action: "give_clue"，is_correct: false ➔ 温柔共情并拉回本幕标准画面。

【极速与语言规范红线（绝对遵守）】：
- 过程追问 teacher_reply 严格限制在 6-16 个汉字以内！单句单问，极其精炼亲切！
- 最后一幕通关总结 teacher_reply 限制在 15-28 个汉字以内，必须完整讲清楚故事的教育意义！

输出严格精简 JSON：
{
  "action": "probe_element" | "give_clue" | "advance_page" | "complete_story" | "gentle_correct",
  "teacher_reply": "晓晓老师说的话",
  "moral_badge": "品格勋章称号（仅在complete_story时填写，如：爱心小标兵 / 团结合作星）",
  "is_correct": true | false
}`;
  }

  async generateVisualOpening({ storyTitle, ageGroup, totalFrames = 1, firstImage }) {
    const summary = (firstImage && firstImage.private_annotations && firstImage.private_annotations.visible_summary) || '有趣的画面';
    const tags = (firstImage && firstImage.private_annotations && firstImage.private_annotations.tags) || [];
    
    if (!this.isConfigured()) {
      return `快看这幅画，发生什么啦？`;
    }

    const prompt = `你是幼儿园名师晓晓老师。正在带幼儿看绘本《${storyTitle}》的第1幅画。
画面内容：${summary}
标签：${tags.join('、')}

请你根据这幅画最吸引人的核心，给出一句 6-12 个汉字的【极简开场提问】！
【严格红线】：
1. 必须是 6-12 个字以内的极短单句！
2. 只问 1 个好玩的小问题，严禁一口气问好几个问句！
3. 语气要轻快亲切，激发孩子开口欲望。
示例：《魔法被子》➔ “看，小女孩怎么飞起来啦？” / 《小猴和小球》➔ “小狗在追什么呀？” / 《拔萝卜》➔ “小兔子在拔什么呀？”

直接输出你说的话（6-12字）：`;

    try {
      const res = await this._postChat([{ role: 'user', content: prompt }]);
      const cleaned = res.replace(/["“”]/g, '').trim();
      return (cleaned.length >= 4 && cleaned.length <= 16) ? cleaned : `快看，画面里有什么呀？`;
    } catch(e) {
      return `快看这幅画，发生什么啦？`;
    }
  }

  async weaveFinalStory({ storyTitle, ageGroup, childQuotes = [], images = [] }) {
    if (!this.isConfigured() || childQuotes.length === 0) {
      return childQuotes.join('，') + '。故事讲完啦！';
    }

    const imageSummaries = images.map((img, i) => `第${i+1}幅画内容：` + ((img.private_annotations && img.private_annotations.visible_summary) || '')).join('\n');
    
    const prompt = `你是顶级幼儿绘本大师（如宫西达也的风格）。小朋友看图时说出了这些话：
小朋友原话：${childQuotes.join('、')}

这套绘本的真实客观画面是：
${imageSummaries}

请你把小朋友的话与画面内容，揉成一段极度生动、极具画面感的幼儿小故事（50-80字）！
要求：
1. 大量使用活泼的动词和极具感染力的拟声词（如：吧唧、扑通、沙沙沙）。
2. 短句为主，富有节奏感和童趣情绪。
3. 严格基于画面客观内容，不要过度虚构画面里没有的东西。
直接输出最动听的故事正文：`;

    try {
      const res = await this._postChat([{ role: 'user', content: prompt }]);
      return res.replace(/["“”]/g, '').trim();
    } catch(e) {
      return childQuotes.join('，') + '。';
    }
  }

  async decideNextAction({ storyTitle, storyThemes = [], ageGroup, frameIndex, totalFrames, visibleTags, expectedElements = {}, visualSummary = '', visualClues = [], failCount = 0, guidanceLevel = 'SOFT', childInput, history = [] }) {
    if (!this.isConfigured()) {
      return null;
    }

    const systemPrompt = this.getSystemPrompt({ storyTitle, storyThemes, ageGroup, frameIndex, totalFrames, visibleTags, expectedElements, visualSummary, visualClues, failCount, guidanceLevel });
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-4).map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: childInput }
    ];

    try {
      const responseText = await this._postChat(messages);
      const cleanJson = responseText.replace(/```json\s*|\s*```/g, '').trim();
      const decision = JSON.parse(cleanJson);

      return {
        success: true,
        action: decision.action || 'probe_element',
        teacherReply: decision.teacher_reply || '哇～小朋友观察得真仔细！',
        moralBadge: decision.moral_badge || '讲故事小能手',
        childQuote: childInput,
        isCorrect: Boolean(decision.is_correct)
      };
    } catch (err) {
      console.warn('[LLMAgentCore] 大模型 Agent 决策降级:', err.message);
      return null;
    }
  }

  _postChat(messages) {
    return new Promise((resolve, reject) => {
      let endpoint = this.baseURL;
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/+$/, '') + '/chat/completions';
      }

      const parsedUrl = new URL(endpoint);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const body = JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.6,
        max_tokens: 220
      });

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + (parsedUrl.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: this.timeout
      };

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = JSON.parse(data);
              const text = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
              if (text) {
                resolve(text);
              } else {
                reject(new Error('Empty choices content'));
              }
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('LLM Agent Request timeout'));
      });

      req.write(body);
      req.end();
    });
  }
}

module.exports = new LLMAgentCore();
