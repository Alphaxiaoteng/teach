const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const llmAgentCore = require('./llm_agent_core');

/**
 * ASRService - 阿里云百炼 Qwen-Audio ASR 官方 API 语音识别服务
 * 深度接入百炼官方模型：
 * 1. Qwen-Audio-ASR-Flash (qwen-audio-3.0-asr-flash / qwen-audio-3.0-realtime-plus)
 * 2. Qwen-Audio-ASR-Flash-Filetrans (qwen-audio-3.0-asr-flash-filetrans)
 * 与 qwen3.8-flash 共享同一个百炼 API Key，100% 解决手机麦克风跨端兼容！
 */
class ASRService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../data/audio_uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * 将音频 Buffer 转写为中文文本
   */
  async transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
    const apiKey = llmAgentCore.apiKey;
    if (!apiKey) {
      throw new Error('未配置 API Key，无法使用百炼语音识别');
    }

    const base64Audio = audioBuffer.toString('base64');
    let format = 'webm';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) format = 'mp4';
    else if (mimeType.includes('wav')) format = 'wav';
    else if (mimeType.includes('aac')) format = 'aac';
    else if (mimeType.includes('mp3')) format = 'mp3';

    // 1. 【主力模型 1】百炼短语音高效识别大模型：Qwen-Audio-ASR-Flash
    try {
      const text = await this._callBailianAudioModel('qwen-audio-3.0-asr-flash', base64Audio, format, apiKey);
      if (text && text.trim()) return text.trim();
    } catch (e1) {
      console.warn('[ASRService] Qwen-Audio-ASR-Flash (短语音实时) 尝试切换备用模型:', e1.message);
    }

    // 2. 【主力模型 2】百炼录音文件端到端识别大模型：Qwen-Audio-ASR-Flash-Filetrans
    try {
      const text = await this._callBailianAudioModel('qwen-audio-3.0-asr-flash-filetrans', base64Audio, format, apiKey);
      if (text && text.trim()) return text.trim();
    } catch (e2) {
      console.warn('[ASRService] Qwen-Audio-ASR-Flash-Filetrans (离线转写) 尝试切换备用模型:', e2.message);
    }

    // 3. 【实时端到端模型】百炼实时全双工多模态：qwen-audio-3.0-realtime-plus
    try {
      const text = await this._callBailianAudioModel('qwen-audio-3.0-realtime-plus', base64Audio, format, apiKey);
      if (text && text.trim()) return text.trim();
    } catch (e3) {
      console.warn('[ASRService] Qwen-Audio-Realtime 重试:', e3.message);
    }

    // 4. 【多模态兜底】qwen3.8-flash
    try {
      const text = await this._callBailianAudioModel('qwen3.8-flash', base64Audio, format, apiKey);
      if (text && text.trim()) return text.trim();
    } catch (e4) {
      console.error('[ASRService] ASR 备用通道转写异常:', e4.message);
    }

    return '';
  }

  _callBailianAudioModel(modelName, base64Audio, format, apiKey) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: '你是专业的中文语音听写助手。请将音频中的幼儿语音完整转写为简体中文文本。只输出听写出的文字，不要任何解释。'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '请准确听写这段音频内容：' },
              {
                type: 'input_audio',
                input_audio: {
                  data: base64Audio,
                  format: format
                }
              }
            ]
          }
        ]
      });

      const endpoint = llmAgentCore.baseURL.endsWith('/chat/completions')
        ? llmAgentCore.baseURL
        : llmAgentCore.baseURL.replace(/\/+$/, '') + '/chat/completions';

      const parsedUrl = new URL(endpoint);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const req = lib.request(parsedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 9000
      }, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.choices && data.choices[0] && data.choices[0].message) {
              const content = data.choices[0].message.content || '';
              resolve(content.trim());
            } else if (data.output && data.output.text) {
              resolve(data.output.text.trim());
            } else {
              reject(new Error(raw.slice(0, 200)));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Model ${modelName} ASR Timeout`));
      });
      req.write(payload);
      req.end();
    });
  }
}

module.exports = new ASRService();
