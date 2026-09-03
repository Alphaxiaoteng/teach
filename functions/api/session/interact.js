export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.BAILIAN_API_KEY || "sk-sp-H.DRMYDR.f5Oa.MEUCIHL4I2jetSkjh-1VGHGKFvzSYdwo_MFh2CW0KWBvy5OtAiEAsLKQ3JjTkQFBZNtrHdU7xYximtVjRClzh-aea4kl3fg";
  const baseURL = env.BAILIAN_BASE_URL || "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

  try {
    const body = await request.json();
    const { storyId, storyTitle, totalImages, images, childInput, history } = body;

    const turns = Array.isArray(history) ? history.filter(h => h.role === 'user').length + 1 : 1;

    // 整合全套连环画的客观事实与情节脉络
    const framesSummary = Array.isArray(images) && images.length > 0 
      ? images.map((img, i) => `【第 ${i + 1} 幅画】: ${img.private_annotations?.visible_summary || '画面'} (线索: ${(img.visual_clues || []).join('；')})`).join('\n')
      : `绘本《${storyTitle || '故事'}》的连环画画面`;

    const systemPrompt = `你是一位精通 3-6 岁幼儿语言心理学、极其温柔可爱、富有童心的幼儿园特级名师【晓晓老师】。
你正在和 3-6 岁小朋友一起看连环画绘本《${storyTitle || '绘本故事'}》，通过亲切自然的【双向聊天】带小朋友理解故事、激发表达。

【绘本全景情节与画面事实】
${framesSummary}

【特级名师儿童自适应对话核心原则】
1. 【顺应孩子，绝不机械死板】：
   - 严禁机械死板地逼孩子“必须按第1幅、第2幅一幅一幅汇报”！
   - 孩子可能一口气讲了多个画面的内容，也可能只说了一句感兴趣的细节。老师必须【基于孩子刚才说的具体内容】进行自然的顺接与互动！
2. 【智能自适应交互策略】：
   - 【情况 A：孩子讲得比较完整（提到了主要角色、起因和结局）】：
     * 先用超级热情的语气大力夸奖孩子的表达能力（“哇！你一口气把小兔子被救、变成小鹿感谢的故事讲得好生动呀！”）；
     * 然后抛出一个启发想象或深层理解的趣味互动提问（如“那你觉得小鹿为什么会来送给他们礼物呀？”）；
     * 判定为接近完成或通关。
   - 【情况 B：孩子只讲了开头或局部（如只说了救小兔子）】：
     * 肯定孩子讲的部分（“对呀，小男孩看到小兔子受伤好心疼！”）；
     * 然后顺着情节自然好奇地追问后面的发展（“那小兔子被带回家之后怎么样啦？后面发生了什么神奇的事呀？”）。
   - 【情况 C：孩子在回答老师的追问 / 对话已达 2~4 轮且情节已完整】：
     * 给出充满爱意的大结业总结（30-45字），高度赞美孩子的爱心、观察力与表达力，为孩子颁发通关勋章！ -> is_completed: true, status: "PASS"
3. 【语言风格】：超级温柔亲切、充满童真、多用儿童口语（哇、呀、呢、哦～），每句 30-50 字左右，朗读起来像真人在和孩子聊天一样动听。

【输出格式】请严格返回纯 JSON：
{
  "accuracy_feedback": "🎯 准确捕捉到小男孩善良救助的关键情节！",
  "accuracy_score": 96,
  "teacher_reply": "晓晓老师自然温柔的夸奖与顺畅互动（30-50字）",
  "moral_badge": "爱心小天使 / 观察小达人 / 故事大王",
  "is_completed": true 或 false,
  "status": "PASS 或 PROBE"
}`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (Array.isArray(history)) {
      history.slice(-8).forEach(h => {
        messages.push({ role: h.role, content: h.content });
      });
    }

    messages.push({ role: 'user', content: childInput || '我看完了' });

    const llmRes = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen3.8-flash',
        messages: messages,
        temperature: 0.35,
        max_tokens: 180
      })
    });

    const llmData = await llmRes.json();
    let agentMessage = "";
    let isCompleted = false;
    let evalStatus = "PROBE";
    let moralBadge = "故事大王";
    let accuracyFeedback = "🎯 观察非常准确！";
    let accuracyScore = 95;

    if (llmData.choices && llmData.choices[0] && llmData.choices[0].message) {
      const content = llmData.choices[0].message.content.replace(/```json\s*|\s*```/g, '').trim();
      try {
        const parsed = JSON.parse(content);
        agentMessage = parsed.teacher_reply || content;
        evalStatus = parsed.status || 'PROBE';
        isCompleted = parsed.is_completed === true;
        moralBadge = parsed.moral_badge || moralBadge;
        accuracyFeedback = parsed.accuracy_feedback || accuracyFeedback;
        accuracyScore = parsed.accuracy_score || accuracyScore;
      } catch(e) {
        agentMessage = content;
      }
    }

    if (!agentMessage) {
      if (turns === 1) {
        agentMessage = "哇！你讲得真生动，小男孩真有爱心！那小兔子带回家后又发生了什么神奇的事情呢？快告诉晓晓老师吧～";
        accuracyFeedback = "🎯 准确捕捉到故事起点！";
      } else {
        agentMessage = `太精彩啦！你用自己的话把《${storyTitle || '故事'}》讲得既完整又动听，真是一个优秀的小小故事家！`;
        accuracyFeedback = "🏆 故事通关达成！";
        isCompleted = true;
        evalStatus = "PASS";
      }
    }

    return new Response(JSON.stringify({
      success: true,
      turn: turns,
      agentMessage,
      accuracyFeedback,
      accuracyScore,
      advance: true,
      evalStatus,
      moralBadge,
      isCompleted
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch(err) {
    return new Response(JSON.stringify({
      success: true,
      turn: 1,
      agentMessage: "哇！你说得真好，那后来又发生了什么神奇的事呀？快跟老师说说看～",
      accuracyFeedback: "🎯 表达非常生动！",
      accuracyScore: 92,
      advance: true,
      evalStatus: "PROBE",
      isCompleted: false
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
