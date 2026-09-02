export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.BAILIAN_API_KEY || "";
  if (!apiKey) {
    return new Response(JSON.stringify({ success: false, error: '缺少 BAILIAN_API_KEY 环境变量配置' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const body = await request.json();
    const { audioBase64, mimeType } = body;

    if (!audioBase64 || audioBase64.length < 50) {
      return new Response(JSON.stringify({ success: false, error: '未检测到有效录音' }), {
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

    // 1. 优先调用阿里云百炼官方极速模型 qwen-audio-3.0-asr-flash
    let recognizedText = "";

    try {
      const res = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
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
        })
      });

      const data = await res.json();
      if (data.output) {
        if (data.output.text) {
          recognizedText = data.output.text;
        } else if (data.output.output && data.output.output.text) {
          recognizedText = data.output.output.text;
        }
      }
    } catch (apiErr) {}

    const cleanText = (recognizedText || '').replace(/[^\u4e00-\u9fa5a-zA-Z0-9，。！？]/g, '').trim();

    if (!cleanText) {
      return new Response(JSON.stringify({
        success: false,
        error: '未识别到清晰说话内容'
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
      error: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
