export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.BAILIAN_API_KEY || "";
  if (!apiKey) {
    return new Response(JSON.stringify({ success: false, error: '系统未配置 BAILIAN_API_KEY 环境变量' }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const body = await request.json();
    const { text, voiceId } = body;

    const cleanText = String(text || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F100}-\u{1F6FF}]/gu, '')
      .replace(/[👏🎉🌟💡🏅🎈👑✨💎👀🐾❤️👍😊😄😃🐰🐼🐱🐶🐻🦆🦊🌸⭐🌻✓🎙️💬🔄▶⚙️📋]/g, '')
      .replace(/\[\[ACTION:[A-Z_]+\]\]/g, '')
      .replace(/【|】/g, '')
      .trim();

    if (!cleanText) {
      return new Response(JSON.stringify({ success: false, error: 'Empty text' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 统一调用百炼 Token-Plan 网关 qwen-audio-3.0-tts-plus 模型合成
    const baseURL = env.BAILIAN_BASE_URL || "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
    
    // 映射角色音色
    let voiceName = 'Cherry';
    if (voiceId === 'xiaoyi') voiceName = 'Serena';
    else if (voiceId === 'yunjian') voiceName = 'Ethan';
    else if (voiceId === 'xiaoxia') voiceName = 'Chelsie';

    let audioResultUrl = null;

    try {
      const res = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'qwen-audio-3.0-tts-plus',
          messages: [
            { role: 'user', content: cleanText }
          ],
          audio: {
            voice: voiceName,
            format: 'mp3'
          },
          modalities: ['text', 'audio']
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.audio) {
          const audioObj = data.choices[0].message.audio;
          if (audioObj.data) {
            audioResultUrl = `data:audio/mp3;base64,${audioObj.data}`;
          } else if (audioObj.url) {
            audioResultUrl = audioObj.url;
          }
        }
      }
    } catch (e) {}

    if (audioResultUrl) {
      return new Response(JSON.stringify({
        success: true,
        audioUrl: audioResultUrl
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'TTS using WebSpeech / audio_manifest fallback'
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
