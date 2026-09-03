export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.BAILIAN_API_KEY || "";
  if (!apiKey) {
    return new Response(JSON.stringify({ success: false, error: '系统未配置 BAILIAN_API_KEY 环境变量' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
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
1. 【单问号聚焦铁律（最核心）】：
   - 3-6 岁幼儿思维简单，每次回复【有且仅能提出 1 个具体的焦点小问号】！绝对严禁一次抛出两个或多个问题（如“有没有泥点？是谁帮它洗澡？泡泡出来了吗？”这样会让孩子大脑死机）！
   - 严禁提泛泛的宽泛大问题（严禁问“发生了什么呀？”、“这幅画怎么了？”）！必须聚焦在画面某个具体人物、动作或道具上提问（例如：“快看，是谁正拿着毛巾帮小鸭子洗澡呀？”）。
2. 【顺应孩子，严禁重复复读】：
   - 结合多轮对话历史，如果孩子刚才已经回答了某个细节，老师必须顺接夸奖，接着顺承推入下一个环节，【绝对严禁重复提问同一个问题】！
   - 如果孩子一口气讲得很完整（起因、经过、结果都齐了），不要再无意义纠缠细节，直接判定通关结业（is_completed: true, status: "PASS"）！
3. 【自适应引导推进（2-3轮自然通关）】：
   - 轮次 1：肯定孩子开口讲的部分，聚焦一个关键未提及的画面细节问 1 个小问题（is_completed: false, status: "PROBE"）；
   - 轮次 2：孩子回答了细节后，若整个故事脉络已齐，直接通关结业！若还差核心结局，再问最后一个收尾小问题；
   - 轮次 3 或以上：无论如何必须温馨通关结业，高度赞美，颁发勋章（is_completed: true, status: "PASS"）。
4. 【通关时故事汇总（story_recap）】：
   - 当 is_completed: true 时，老师必须在 story_recap 字段中，把孩子刚才讲到的所有零碎细节串联成一段连贯、生动、温暖的小故事（80-120字），开头如“晓晓老师把你讲的故事串起来念给你听哦：有一天……”，让孩子获得极大的成就感！
5. 【语言风格】：超级温柔亲切、充满童真、多用儿童口语（哇、呀、呢、哦～），每句 teacher_reply 控制在 30-50 字左右。

【输出格式】请严格返回纯 JSON，严禁任何额外解释：
{
  "accuracy_feedback": "🎯 准确捕捉到的具体画面事实",
  "accuracy_score": 96,
  "teacher_reply": "晓晓老师自然温柔的夸奖与顺畅互动（有且仅有1个具体聚焦小问号，30-50字）",
  "moral_badge": "爱心小天使 / 观察小达人 / 故事大王",
  "story_recap": "当 is_completed 为 true 时，汇总孩子讲出的完整故事（80-120字），平时为 string 空字符串",
  "is_completed": true 或 false,
  "status": "PASS 或 PROBE"
}`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (Array.isArray(history) && history.length > 0) {
      history.slice(-8).forEach(h => {
        if (h && h.role && h.content) {
          messages.push({ role: h.role, content: h.content });
        }
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
        max_tokens: 280
      })
    });

    const llmData = await llmRes.json();
    let agentMessage = "";
    let isCompleted = false;
    let evalStatus = "PROBE";
    let moralBadge = "故事大王";
    let accuracyFeedback = "🎯 观察非常准确！";
    let accuracyScore = 95;
    let storyRecap = "";

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
        storyRecap = parsed.story_recap || "";
      } catch(e) {
        agentMessage = content;
      }
    }

    // 强行规整：如果不是结业，保证只保留 1 个问号，避免多问
    if (!isCompleted && agentMessage) {
      const questionMarks = (agentMessage.match(/[？?]/g) || []).length;
      if (questionMarks > 1) {
        // 若大模型依然返回了多个问号，截取至第一个问号并保留亲和力
        const firstQIdx = agentMessage.indexOf('？') !== -1 ? agentMessage.indexOf('？') : agentMessage.indexOf('?');
        if (firstQIdx > 0) {
          agentMessage = agentMessage.slice(0, firstQIdx + 1);
        }
      }
    }

    if (!agentMessage) {
      if (turns === 1) {
        agentMessage = "哇，你说得真好！那后来又发生了什么神奇的事呀？";
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
      isCompleted,
      storyRecap
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch(err) {
    return new Response(JSON.stringify({
      success: true,
      turn: 1,
      agentMessage: "哇！你说得真好，那后来小动物们做了什么呀？",
      accuracyFeedback: "🎯 表达非常生动！",
      accuracyScore: 92,
      advance: true,
      evalStatus: "PROBE",
      isCompleted: false,
      storyRecap: ""
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
