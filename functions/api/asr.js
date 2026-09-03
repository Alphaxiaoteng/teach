export async function onRequestPost(context) {
  const { request, env } = context;

  // 智能识别 DashScope 官方 Key 或 Token-Plan Key
  const dsApiKey = env.DASHSCOPE_API_KEY || (env.BAILIAN_API_KEY && !env.BAILIAN_API_KEY.startsWith('sk-sp-') ? env.BAILIAN_API_KEY : '');
  const tokenPlanKey = env.BAILIAN_API_KEY || "";

  try {
    const body = await request.json();
    const { audioBase64, mimeType } = body;

    if (!audioBase64 || audioBase64.length < 50) {
      return new Response(JSON.stringify({
        success: false,
        error: '未检测到有效录音',
        fallbackToKeyboard: true
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let format = 'wav';
    if (mimeType) {
      if (mimeType.includes('webm')) format = 'webm';
      else if (mimeType.includes('mp4') || mimeType.includes('m4a')) format = 'mp4';
      else if (mimeType.includes('aac')) format = 'aac';
      else if (mimeType.includes('ogg')) format = 'ogg';
    }

    let recognizedText = "";

    // 1. 如果有 DashScope 官方可用 Key，调用极速 ASR 接口
    if (dsApiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4500);

        const res = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${dsApiKey}`,
            "X-DashScope-DataInspection": "enable"
          },
          body: JSON.stringify({
            model: "qwen-audio-3.0-asr-flash",
            input: {
              messages: [
                {
                  role: "user",
                  content: [
                    { audio: `data:audio/${format};base64,${audioBase64}` }
                  ]
                }
              ]
            },
            parameters: {
              format: format
            }
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.output) {
            if (data.output.text) recognizedText = data.output.text;
            else if (data.output.output && data.output.output.text) recognizedText = data.output.output.text;
          }
        }
      } catch (e) {}
    }

    const cleanText = (recognizedText || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9，。！？]/g, '').trim();

    if (!cleanText) {
      return new Response(JSON.stringify({
        success: false,
        error: '未识别到清晰说话内容',
        fallbackToKeyboard: true
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      text: cleanText
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      fallbackToKeyboard: true
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
