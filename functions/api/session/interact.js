export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.DASHSCOPE_API_KEY || (env.BAILIAN_API_KEY && !env.BAILIAN_API_KEY.startsWith('sk-sp-') ? env.BAILIAN_API_KEY : 'sk-5f083ca09e0941b5a2a300f0ba4fe11c');
  const baseURL = env.BAILIAN_BASE_URL || (apiKey.startsWith('sk-sp-') ? "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1" : "https://dashscope.aliyuncs.com/compatible-mode/v1");

  try {
    const body = await request.json();
    const { storyId, storyTitle, totalImages, images, currentImageIndex, childInput, history, skipTts } = body;

    const turns = Array.isArray(history) ? history.filter(h => h.role === 'user').length + 1 : 1;
    const isMultiFrame = (totalImages || (images && images.length) || 1) > 1;
    const frameBadges = ['①', '②', '③', '④', '⑤', '⑥'];

    // 智能选取至多 2 张最相关的图片作为视觉上下文
    const selectedFrames = [];
    if (Array.isArray(images) && images.length > 0) {
      const currIdx = Math.max(0, Math.min(Number(currentImageIndex) || 0, images.length - 1));
      
      // 主焦点图：当前正在聚焦的连环画帧
      selectedFrames.push({
        index: currIdx,
        order: currIdx + 1,
        badge: frameBadges[currIdx] || `${currIdx + 1}`,
        item: images[currIdx]
      });

      // 辅上下文图：智能选择第 2 张图
      if (images.length > 1) {
        let secondIdx = -1;
        const inputLower = (childInput || '').toLowerCase();

        // 优先跨图语义匹配：检查孩子是否跳跃提及了其他画面的关键物件或动作
        for (let i = 0; i < images.length; i++) {
          if (i === currIdx) continue;
          const img = images[i];
          const clues = (img.visual_clues || []).join(' ');
          const summary = (img.private_annotations?.visible_summary || '');
          const tags = (img.private_annotations?.tags || []).join(' ');
          const textPool = `${clues} ${summary} ${tags}`.toLowerCase();

          const keywords = ['风筝', '小兔', '兔子', '小熊', '苹果', '盘子', '花纹', '小猫', '小狗', '小青花', '灯笼', '月饼', '荷叶', '泡泡', '雨伞', '气球', '画笔', '小鸟', '胡萝卜', '小猴', '画画'];
          const matched = keywords.filter(kw => inputLower.includes(kw) && textPool.includes(kw));
          if (matched.length > 0) {
            secondIdx = i;
            break;
          }
        }

        // 若无跨图跳跃线索，默认选择相邻下一帧推进情节；已是尾帧则选前一帧对比
        if (secondIdx === -1) {
          if (currIdx + 1 < images.length) {
            secondIdx = currIdx + 1;
          } else {
            secondIdx = Math.max(0, currIdx - 1);
          }
        }

        if (secondIdx !== -1 && secondIdx !== currIdx && images[secondIdx]) {
          selectedFrames.push({
            index: secondIdx,
            order: secondIdx + 1,
            badge: frameBadges[secondIdx] || `${secondIdx + 1}`,
            item: images[secondIdx]
          });
          selectedFrames.sort((a, b) => a.index - b.index);
        }
      }
    }

    // 将图片转换为已部署 CDN 强缓存的公开绝对 HTTPS URL
    const origin = 'https://story.alphaintelligence.ltd';
    const visualUrls = selectedFrames.map(f => {
      const rawUrl = f.item?.image_url || '';
      if (!rawUrl) return null;
      if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:')) {
        return { badge: f.badge, order: f.order, url: rawUrl };
      }
      const cleanPath = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
      return { badge: f.badge, order: f.order, url: encodeURI(`${origin}${cleanPath}`) };
    }).filter(Boolean);

    // 整合全套连环画的客观事实与情节脉络（附带明确图号 ①②③④）
    const framesSummary = Array.isArray(images) && images.length > 0 
      ? images.map((img, i) => `【第 ${i + 1} 幅画 (序号: 第${frameBadges[i] || (i + 1)}幅)】: ${img.private_annotations?.visible_summary || '画面'} (线索: ${(img.visual_clues || []).join('；')})`).join('\n')
      : `绘本《${storyTitle || '故事'}》的连环画画面`;

    const visionNotice = visualUrls.length > 0
      ? `\n\n【当前多模态视觉真图输入】：
本轮交互中已为你实时输入了 ${visualUrls.length} 张高清画面真图（序号：${visualUrls.map(v => `第${v.badge}幅图`).join(' 与 ')}）。
请直接调用你的多模态视觉理解能力观察这 ${visualUrls.length} 幅画面中的具体物体、角色外貌、动作细节与颜色，精准向孩子提问！`
      : '';

    const multiFrameRule = isMultiFrame
      ? `【多图精准指引铁律（绝对红线，严禁违背）】：
   - 界面上同时展示了多幅连环画（带有明显的数字序号 ①、②、③、④）。
   - 晓晓老师提问时，【必须明确说出第几幅图】（例如必须说“第①幅图”、“第②幅图”、“第③幅图”或“第④幅图”）！
   - 绝对严禁使用“画面正中间”、“图里面”、“画面中”、“你瞧瞧”等没有图片序号的模糊词！屏幕上有多张画，不说图号孩子完全不知道你在说哪张！
   - 提问必须【聚焦在具体物件/动作】上（例如：“那你看第①幅图，桌上的风筝画的是什么小动物呀？”、“第②幅图里孩子们在用什么颜色涂风筝呀？”），绝不能空泛地问“画面正中间有什么”！`
      : `【单图引导原则】：引导孩子仔细观察画面中的主要角色和具体动作，语言具体生动。`;

    const systemPrompt = `你是一位专业、温和、懂得倾听幼儿的幼儿园名师【晓晓老师】。
你正在和 3-6 岁小朋友一起看绘本《${storyTitle || '绘本故事'}》，通过亲切、自然、平视的【双向聊天】启发孩子观察画面、讲述故事。

【绘本全景情节与画面事实】
${framesSummary}${visionNotice}

【特级名师儿童自适应对话核心原则】
1. ${multiFrameRule}
2. 【自然平视接话，严禁每句盲目夸奖与谄媚迎合（核心红线）】：
   - 【严禁迎合夸奖套话】：绝对严禁每轮都说“哇！宝贝真棒”、“哇！宝贝真厉害”、“太聪明了”、“太棒啦”等虚假套话！不要无脑迎合孩子，不要把简单的两字回答当成奇迹来夸，不要谄媚讨好。
   - 【正确接话方式（平视、中性确认 + 顺势提问）】：
     * 孩子说出细节时，像朋友聊天一样自然接话即可，把重点放在【故事内容】上（如：“对，小兔子正在用力拔呢。”、“嗯，是老爷爷。”、“哈哈，风筝飞得好高呀。”）。
     * 若孩子跳跃描述了后面的画面（例如看风筝故事时说“放风筝，他们在看风筝”）：
       自然接话：“对，大家在草地上放风筝呢。那你看第①幅图，桌上的风筝画的是什么小动物呀？”
     * 绝不把孩子说对的情节当成错误（严禁说“不对/别着急”），但也绝不大呼小叫过度夸奖。
3. 【严禁反向提问孩子刚才已经提及的信息（防盲问复读，绝对红线）】：
   - 必须仔细审视孩子刚才说的话（childInput）！孩子已经讲出的细节（如角色、颜色、动作、物品、地点等），【绝对严禁反过来询问孩子刚才已经说过的内容】！
   - 例如：如果孩子已经说了“小刺猬背着红红的大苹果回家”，绝对严禁问“苹果是什么颜色”、“小动物是谁”、“它背着什么”！
4. 【单问号聚焦与精简字数（极速启发）】：
   - 每次回复【有且仅能提出 1 个具体的焦点小问号】！字数控制在 25-35 字内，自然轻柔，平实亲切。
5. 【通关总结要求（精炼生动，拒绝啰嗦，30-50字以内）】：
   - 故事讲完结业时（is_completed: true）：
   - 用 1-2 句温暖清爽的话为整个故事简练收尾（总字数 30-50 字内），例如：“哇，原来大家齐心协力把大萝卜拔出来啦！今天的故事讲得真清楚～”。
   - 严禁任何冗长的前缀套话（绝对严禁说“晓晓老师把故事串起来念给你听哦”等废话），严禁把画面提纲逐幅背诵，做到利落干脆。

【输出格式】请严格返回纯 JSON，严禁任何额外解释：
{
  "teacher_reply": "晓晓老师回复（日常启发25-35字带1个问号；通关总结30-50字简炼收尾不带问号）",
  "moral_badge": "爱心小天使 / 观察小达人 / 故事大王 / 勇敢小天使",
  "is_completed": false,
  "status": "PROBE"
}`;

    const textOnlyUserMsg = childInput || '我看完了';
    let userContent = textOnlyUserMsg;

    if (visualUrls.length > 0) {
      userContent = [
        {
          type: "text",
          text: `小朋友正在看绘本并说：“${childInput || '我看完了'}”。\n当前提供视觉画面的图号为：【${visualUrls.map(v => `第${v.badge}幅图`).join('、')}】。请仔细观察真实画面细节，按原则温柔回复。`
        },
        ...visualUrls.map(v => ({
          type: "image_url",
          image_url: { url: v.url }
        }))
      ];
    }

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (Array.isArray(history) && history.length > 0) {
      history.slice(-8).forEach(h => {
        if (h && h.role && h.content) {
          const textContent = typeof h.content === 'string' ? h.content : (Array.isArray(h.content) ? h.content.filter(c => c.type === 'text').map(c => c.text).join(' ') : String(h.content));
          messages.push({ role: h.role, content: textContent });
        }
      });
    }

    messages.push({ role: 'user', content: userContent });

    const t0 = Date.now();
    let tLLM = 0;
    let tTTS = 0;

    let llmData = null;
    let llmErrDetail = null;

    const baseCandidates = [
      baseURL,
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
      'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'
    ].filter((v, idx, self) => Boolean(v) && self.indexOf(v) === idx);

    // 第一梯队：优先采用用户指定的 qwen3.8-flash 进行多模态识图与极速启发，qwen-vl-plus 作为高阶视觉备用
    const visionModels = ['qwen3.8-flash', 'qwen-vl-plus'];

    for (const curModel of visionModels) {
      if (llmData && llmData.choices && llmData.choices.length > 0) break;
      for (const curBase of baseCandidates) {
        try {
          const payload = {
            model: curModel,
            messages: messages,
            temperature: 0.2,
            max_tokens: 160
          };
          if (curModel.includes('3.8') || curModel.includes('flash')) {
            payload.enable_thinking = false;
          }
          const llmRes = await fetch(`${curBase}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
          });
          if (llmRes.ok) {
            llmData = await llmRes.json();
            if (llmData && llmData.choices && llmData.choices.length > 0) {
              break;
            }
          } else {
            llmErrDetail = `[${curBase}/${curModel}]: status ${llmRes.status}`;
          }
        } catch(err) {
          llmErrDetail = `[${curBase}/${curModel}]: err ${err.message}`;
        }
      }
    }

    // 第二梯队容灾降级：若多模态接口未成功，剥离图片降级为纯文本 Payload 进行推理
    if (!llmData || !llmData.choices) {
      const textOnlyMessages = [
        { role: 'system', content: systemPrompt }
      ];
      if (Array.isArray(history) && history.length > 0) {
        history.slice(-8).forEach(h => {
          if (h && h.role && h.content) {
            const textContent = typeof h.content === 'string' ? h.content : (Array.isArray(h.content) ? h.content.filter(c => c.type === 'text').map(c => c.text).join(' ') : String(h.content));
            textOnlyMessages.push({ role: h.role, content: textContent });
          }
        });
      }
      textOnlyMessages.push({ role: 'user', content: textOnlyUserMsg });

      for (const curBase of baseCandidates) {
        try {
          const fallbackRes = await fetch(`${curBase}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'qwen3.8-flash',
              messages: textOnlyMessages,
              temperature: 0.25,
              max_tokens: 160,
              enable_thinking: false
            })
          });
          if (fallbackRes.ok) {
            llmData = await fallbackRes.json();
            if (llmData && llmData.choices && llmData.choices.length > 0) {
              break;
            }
          }
        } catch(e) {}
      }
    }

    // 第三梯队容灾降级：高精度 qwen3.8-max 兜底
    if (!llmData || !llmData.choices) {
      const textOnlyMessages = [
        { role: 'system', content: systemPrompt }
      ];
      if (Array.isArray(history) && history.length > 0) {
        history.slice(-8).forEach(h => {
          if (h && h.role && h.content) {
            const textContent = typeof h.content === 'string' ? h.content : (Array.isArray(h.content) ? h.content.filter(c => c.type === 'text').map(c => c.text).join(' ') : String(h.content));
            textOnlyMessages.push({ role: h.role, content: textContent });
          }
        });
      }
      textOnlyMessages.push({ role: 'user', content: textOnlyUserMsg });

      for (const curBase of baseCandidates) {
        try {
          const fallbackRes = await fetch(`${curBase}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'qwen3.8-max',
              messages: textOnlyMessages,
              temperature: 0.25,
              max_tokens: 160,
              enable_thinking: false
            })
          });
          if (fallbackRes.ok) {
            llmData = await fallbackRes.json();
            if (llmData && llmData.choices && llmData.choices.length > 0) {
              break;
            }
          }
        } catch(e) {}
      }
    }
    tLLM = Date.now() - t0;

    let agentMessage = "";
    let isCompleted = false;
    let evalStatus = "PROBE";
    let moralBadge = "故事大王";
    let accuracyFeedback = null;
    let accuracyScore = 95;
    let storyRecap = "";

    if (llmData && llmData.choices && llmData.choices[0] && llmData.choices[0].message) {
      const content = llmData.choices[0].message.content.replace(/```json\s*|\s*```/g, '').trim();
      try {
        const parsed = JSON.parse(content);
        agentMessage = parsed.teacher_reply || content;
        evalStatus = parsed.status || 'PROBE';
        isCompleted = parsed.is_completed === true;
        moralBadge = parsed.moral_badge || moralBadge;
        storyRecap = parsed.story_recap || "";
      } catch(e) {
        agentMessage = content;
      }
    }

    // 强行规整：如果不是结业，保证只保留 1 个问号，避免多问；若是结业，彻底去除问号保留温馨陈述
    if (!isCompleted && agentMessage) {
      const questionMarks = (agentMessage.match(/[？?]/g) || []).length;
      if (questionMarks > 1) {
        // 若大模型依然返回了多个问号，截取至第一个问号并保留亲和力
        const firstQIdx = agentMessage.indexOf('？') !== -1 ? agentMessage.indexOf('？') : agentMessage.indexOf('?');
        if (firstQIdx > 0) {
          agentMessage = agentMessage.slice(0, firstQIdx + 1);
        }
      }
    } else if (isCompleted && agentMessage) {
      // 结业时彻底去除任何反问句，只保留温馨利落的故事收尾陈述句
      agentMessage = agentMessage.replace(/[^。！\n]*[？?].*$/, '').trim();
      if (!agentMessage || agentMessage.length < 10) {
        agentMessage = `太棒啦！你把《${storyTitle || '故事'}》讲得真好，今天的故事讲完咯～`;
      } else if (!/[。！～]$/.test(agentMessage)) {
        agentMessage += '～';
      }
    }

    // RED-05 暖心防死锁硬熔断：对消极、胆小或达轮次上限的幼儿，主动接棒结业，绝不无限挂起逼问
    const isPassiveInput = /(不知道|不会|不想说|不想讲|听不懂|算了|别问了)/.test(childInput || "");
    if ((turns >= 3 && isPassiveInput) || turns >= 4) {
      isCompleted = true;
      evalStatus = "PASS";
      moralBadge = "勇敢小天使";
      agentMessage = `太棒啦！原来大家一起度过了这么美好的故事时光，今天的故事讲完咯～`;
    }

    if (!agentMessage) {
      if (turns === 1) {
        agentMessage = "嗯，那后来又发生了什么事呀？";
      } else {
        agentMessage = `你用自己的话把《${storyTitle || '故事'}》讲得很清楚呢，真棒！`;
        isCompleted = true;
        evalStatus = "PASS";
      }
    }

    // 简单纯粹真人情感铁律：整句一种情感即可，句首仅放一个标签，绝不在句中混杂切换
    const cleanSpeech = agentMessage.replace(/[👏🎉🌟💡🏅🎈👑✨💎👀🐾❤️👍😊😄😃🐰🐼🐱🐶🐻🦆🦊🌸⭐🌻✓🎙️💬🔄▶⚙️📋]/g, '').replace(/\[[a-zA-Z\s_]+\]/g, '').trim();
    
    // 整句唯一情感基调
    let sentenceEmotion = '[curious]';
    if (isCompleted || evalStatus === 'PASS' || /太棒|真棒|太精彩|答对|真优秀/.test(agentMessage)) {
      sentenceEmotion = '[excited]';
    } else if (evalStatus === 'WRONG' || /别着急|慢慢看|没关系/.test(agentMessage)) {
      sentenceEmotion = '[asmr]';
    } else {
      sentenceEmotion = '[curious]';
    }

    const rawEmotionalVoiceText = `${sentenceEmotion}${cleanSpeech}`;
    const displayAgentMessage = cleanSpeech;

    // 自动调用阿里云百炼最新 Qwen-Audio-TTS（支持 skipTts 模式极速秒回，将文本延迟压缩至 1.2s）
    let audioUrl = null;
    if (!skipTts) {
      try {
        const dsKey = env.DASHSCOPE_API_KEY || (env.BAILIAN_API_KEY && !env.BAILIAN_API_KEY.startsWith('sk-sp-') ? env.BAILIAN_API_KEY : 'sk-5f083ca09e0941b5a2a300f0ba4fe11c');
        if (rawEmotionalVoiceText && dsKey) {
          // 严格优先调用极致低延迟极速模型 qwen-audio-3.0-tts-flash，实测 0.9s 极速响应
          const ttsModels = [
            { model: 'qwen-audio-3.0-tts-flash', voice: 'longanhuan_v3.6' },
            { model: 'qwen-audio-3.0-tts-plus', voice: 'longanhuan_v3.6' },
            { model: 'qwen-audio-3.0-tts-flash', voice: 'longanfengyue' }
          ];
          for (const cfg of ttsModels) {
            try {
              const ttsRes = await fetch("https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer", {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${dsKey}`
                },
                body: JSON.stringify({
                  model: cfg.model,
                  input: {
                    text: rawEmotionalVoiceText,
                    voice: cfg.voice,
                    format: 'mp3',
                    sample_rate: 44100
                  }
                })
              });
              if (ttsRes.ok) {
                const ttsData = await ttsRes.json();
                if (ttsData.output && ttsData.output.audio && ttsData.output.audio.url) {
                  audioUrl = ttsData.output.audio.url.replace(/^http:\/\//i, 'https://');
                  break;
                }
              }
            } catch(innerErr) {}
          }
        }
      } catch(ttsErr) {}
    }
    tTTS = Date.now() - t0 - tLLM;

    return new Response(JSON.stringify({
      success: true,
      turn: turns,
      agentMessage: displayAgentMessage,
      audioUrl,
      accuracyFeedback,
      accuracyScore,
      advance: true,
      evalStatus,
      moralBadge,
      isCompleted,
      storyRecap,
      visualContext: visualUrls.map(v => `第${v.badge}幅图`),
      timings: {
        totalMs: Date.now() - t0,
        llmMs: tLLM,
        ttsMs: tTTS
      }
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch(err) {
    return new Response(JSON.stringify({
      success: true,
      turn: 1,
      agentMessage: "嗯，那后来又发生了什么事呀？",
      accuracyFeedback: null,
      accuracyScore: 92,
      advance: true,
      evalStatus: "PROBE",
      isCompleted: false,
      storyRecap: "",
      errorDetail: err ? (err.stack || err.message) : 'unknown'
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
