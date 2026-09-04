export async function onRequestPost(context) {
  const { request, env } = context;

  // 优先读取环境变量，默认内置用户的 DashScope 官方可用 Key
  const dsApiKey = env.DASHSCOPE_API_KEY || (env.BAILIAN_API_KEY && !env.BAILIAN_API_KEY.startsWith('sk-sp-') ? env.BAILIAN_API_KEY : 'sk-5f083ca09e0941b5a2a300f0ba4fe11c');

  try {
    const body = await request.json();
    const { audioBase64, mimeType } = body;

    if (!audioBase64 || audioBase64.length < 50) {
      return new Response(JSON.stringify({
        success: false,
        error: '未检测到有效录音'
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
      else if (mimeType.includes('mp3')) format = 'mp3';
    }

    let recognizedText = "";

    // 1. 调用阿里云百炼官方极速实时 ASR (paraformer-realtime-v2 via WebSocket)
    if (dsApiKey) {
      try {
        const wsUrl = `https://dashscope.aliyuncs.com/api-ws/v1/inference?api_key=${dsApiKey}`;
        const wsRes = await fetch(wsUrl, {
          headers: { 'Upgrade': 'websocket' }
        });
        const ws = wsRes.webSocket;

        if (ws) {
          ws.accept();
          const taskId = `asr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

          // Decode base64 to binary
          const binaryStr = atob(audioBase64);
          const rawBytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            rawBytes[i] = binaryStr.charCodeAt(i);
          }

          // Check audio magic bytes and parse sample rate
          let detectedFormat = 'wav';
          let sampleRate = 16000;
          if (rawBytes.length >= 44 && rawBytes[0] === 0x52 && rawBytes[1] === 0x49 && rawBytes[2] === 0x46 && rawBytes[3] === 0x46) {
            detectedFormat = 'wav';
            const sr = rawBytes[24] | (rawBytes[25] << 8) | (rawBytes[26] << 16) | (rawBytes[27] << 24);
            if (sr >= 8000 && sr <= 96000) {
              sampleRate = sr;
            }
          } else if (rawBytes.length >= 3 && rawBytes[0] === 0x49 && rawBytes[1] === 0x44 && rawBytes[2] === 0x33) {
            detectedFormat = 'mp3';
          } else if (format === 'mp3') {
            detectedFormat = 'mp3';
          } else if (format === 'pcm') {
            detectedFormat = 'pcm';
          }

          recognizedText = await new Promise((resolve) => {
            let resultStr = '';
            const sentenceMap = {};
            const getFinalText = () => {
              const keys = Object.keys(sentenceMap).sort((a, b) => Number(a) - Number(b));
              if (keys.length > 0) {
                return keys.map(k => sentenceMap[k]).join('');
              }
              return resultStr;
            };

            const timer = setTimeout(() => {
              try { ws.close(); } catch(e) {}
              resolve(getFinalText());
            }, 9000);

            ws.addEventListener('message', (evt) => {
              try {
                if (typeof evt.data === 'string') {
                  const msg = JSON.parse(evt.data);
                  const event = msg.header ? msg.header.event : '';
                  if (event === 'task-started') {
                    // Send exact audio binary buffer slice
                    const audioBuffer = rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength);
                    ws.send(audioBuffer);
                    // Duplex streaming: send finish-task immediately
                    ws.send(JSON.stringify({
                      header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
                      payload: { input: {} }
                    }));
                  } else if (event === 'result-generated') {
                    if (msg.payload && msg.payload.output && msg.payload.output.sentence) {
                      const s = msg.payload.output.sentence;
                      if (s.sentence_id !== undefined && s.text !== undefined) {
                        sentenceMap[s.sentence_id] = s.text;
                      }
                      if (s.text) resultStr = s.text;
                    }
                  } else if (event === 'task-finished') {
                    clearTimeout(timer);
                    try { ws.close(); } catch(e) {}
                    resolve(getFinalText());
                  } else if (event === 'task-failed') {
                    clearTimeout(timer);
                    try { ws.close(); } catch(e) {}
                    resolve(getFinalText());
                  }
                }
              } catch(e) {}
            });

            ws.addEventListener('error', () => {
              clearTimeout(timer);
              resolve(getFinalText());
            });

            ws.addEventListener('close', () => {
              clearTimeout(timer);
              resolve(getFinalText());
            });

            // Initiate run-task with paraformer-realtime-v2
            ws.send(JSON.stringify({
              header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
              payload: {
                task_group: 'audio',
                task: 'asr',
                function: 'recognition',
                model: 'paraformer-realtime-v2',
                parameters: {
                  format: detectedFormat,
                  sample_rate: sampleRate
                },
                input: {}
              }
            }));
          });
        }
      } catch (wsErr) {}
    }

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
      error: err.message,
      fallbackToKeyboard: true
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
