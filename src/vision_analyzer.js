const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const llmAgentCore = require('./llm_agent_core');

/**
 * VisionAnalyzer - 阿里云百炼视觉多模态大模型 (Qwen-VL) 自动绘本画面分析器
 * 自动提取幼教要素：主角角色、场景地点、核心动作、客观摘要、名师启发线索
 */
class VisionAnalyzer {
  /**
   * 分析单张绘本图片
   * @param {string} imagePath 本地图片路径
   * @param {object} context 上下文 (storyTitle, order, total)
   */
  async analyzeImage(imagePath, context = {}) {
    const apiKey = llmAgentCore.apiKey;
    if (!apiKey) {
      throw new Error('未配置 API Key，无法调用视觉大模型');
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error(`图片文件不存在: ${imagePath}`);
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase().replace('.', '') || 'jpeg';
    const mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const prompt = `你是一位资深幼儿园看图讲故事专家与视觉分析师。
请仔细观察这幅儿童绘本插画（绘本：《${context.storyTitle || '童话绘本'}》，第 ${context.order || 1} 幅画），进行权威的【客观物理事实提取 (Fact-Lock)】。

请严格输出 JSON 格式（不要包含任何 markdown 外的内容）：
{
  "visible_summary": "客观详细描述这幅画中发生的核心情节（20-40字，如：小兔子在菜地里双手用力拔一个大红萝卜）",
  "character": "画面正中央的核心主角名字（如：小兔子 / 小猫 / 小女孩）",
  "action": "主角正在做的具体动作（如：拔萝卜 / 追蝴蝶 / 坐被子飞）",
  "location": "画面发生的场景或地点（如：菜地里 / 草坪上 / 天空中）",
  "tags": ["角色:小兔子", "动作:拔萝卜", "场景:菜地", "物体:大萝卜"],
  "visual_clues": [
    "名师弱引导问题1（引导观察位置或局部，如：你先找找，画面里是谁？）",
    "名师弱引导问题2（引导观察动作或物体，如：看看它的两只手正抓着什么？）"
  ]
}`;

    const payload = JSON.stringify({
      model: 'qwen3.8-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } }
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

    return new Promise((resolve, reject) => {
      const req = lib.request(parsedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 20000
      }, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (data.choices && data.choices[0] && data.choices[0].message) {
              const content = data.choices[0].message.content || '';
              const cleanJson = content.replace(/```json\s*|\s*```/g, '').trim();
              const parsed = JSON.parse(cleanJson);
              resolve(parsed);
            } else {
              reject(new Error(`视觉大模型返回异常: ${raw.slice(0, 200)}`));
            }
          } catch(e) {
            reject(new Error(`JSON 解析失败: ${e.message} (Raw: ${raw.slice(0, 150)})`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('视觉模型分析超时'));
      });
      req.write(payload);
      req.end();
    });
  }
}

module.exports = new VisionAnalyzer();
