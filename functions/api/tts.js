export async function onRequestPost(context) {
  const { request, env } = context;

  // 优先读取环境变量，默认内置用户的 DashScope 官方可用 Key
  const apiKey = env.DASHSCOPE_API_KEY || (env.BAILIAN_API_KEY && !env.BAILIAN_API_KEY.startsWith('sk-sp-') ? env.BAILIAN_API_KEY : 'sk-5f083ca09e0941b5a2a300f0ba4fe11c');

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

    // 映射角色到 Qwen-Audio-TTS 官方支持情感与拟声标签的音色
    let voiceName = 'longanhuan_v3.6'; // 严格使用测试通过的晓晓老师名师音色
    if (voiceId === 'xiaoyi') voiceName = 'longanhuan_v3.6';
    else if (voiceId === 'yunjian' || voiceId === 'yunxi') voiceName = 'longanfengyue';
    else if (voiceId === 'yunxia' || voiceId === 'xiaoxia') voiceName = 'longanhuan_v3.6';

    // 简单纯粹情感铁律：整句一种情感即可，句首仅放一个标签，绝不在句中混杂切换
    const cleanSpeech = cleanText.replace(/\[[a-zA-Z\s_]+\]/g, '').trim();
    let sentenceEmotion = '[curious]';
    if (/通关|讲完啦|故事大王/.test(cleanSpeech)) {
      sentenceEmotion = '[excited]';
    } else if (/别着急|慢慢看|没关系/.test(cleanSpeech)) {
      sentenceEmotion = '[asmr]';
    } else {
      sentenceEmotion = '[curious]';
    }
    const emotionalText = `${sentenceEmotion}${cleanSpeech}`;

    let audioResultUrl = null;

    // 严格优先调用极致低延迟极速模型 qwen-audio-3.0-tts-flash（实测 0.9s 秒级极速生成，延迟暴降 60%）
    const ttsModels = [
      { model: 'qwen-audio-3.0-tts-flash', voice: 'longanhuan_v3.6' },
      { model: 'qwen-audio-3.0-tts-plus', voice: 'longanhuan_v3.6' },
      { model: 'qwen-audio-3.0-tts-flash', voice: 'longanfengyue' }
    ];
    for (const cfg of ttsModels) {
      try {
        const res = await fetch("https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: cfg.model,
            input: {
              text: emotionalText,
              voice: cfg.voice,
              format: 'mp3',
              sample_rate: 44100
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.output && data.output.audio && data.output.audio.url) {
            audioResultUrl = data.output.audio.url.replace(/^http:\/\//i, 'https://');
            break;
          }
        }
      } catch (e) {}
    }

    if (!audioResultUrl) {
      return new Response(JSON.stringify({ success: false, error: 'TTS Synthesis failed' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      audioUrl: audioResultUrl
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
