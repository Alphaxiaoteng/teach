export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.BAILIAN_API_KEY || "sk-sp-H.DRMYDR.f5Oa.MEUCIHL4I2jetSkjh-1VGHGKFvzSYdwo_MFh2CW0KWBvy5OtAiEAsLKQ3JjTkQFBZNtrHdU7xYximtVjRClzh-aea4kl3fg";

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

    // 调用百炼 CosyVoice / 通义语音合成
    const res = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/text-to-speech/generation", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-DataInspection': 'enable'
      },
      body: JSON.stringify({
        model: 'cosyvoice-v1',
        input: {
          text: cleanText
        },
        parameters: {
          voice: voiceId === 'yunxi' ? 'longshu' : 'longxiaochun',
          format: 'mp3',
          sample_rate: 22050,
          volume: 50,
          speech_rate: 1.05
        }
      })
    });

    const data = await res.json();
    if (data.output && data.output.audio_url) {
      return new Response(JSON.stringify({
        success: true,
        audioUrl: data.output.audio_url
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'TTS generation fallback'
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
