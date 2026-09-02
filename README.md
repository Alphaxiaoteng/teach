# 故事小精灵 (Story Elf) · 幼儿看图讲故事特级带教 AI Agent

> 精通 3-6 岁儿童心理学与语言发展的 AI 看图讲故事启蒙系统。融合通义千问 Qwen 大模型 Agent、DashScope Qwen-Audio ASR 语音识别与 CosyVoice 4 款定制幼教名师音色，带给孩子自然生动、层层递进的绘本互动体验。

---

## 🌟 核心特性

1. **4 大精美视觉主题 & 4 款名师音色**：
   - 视觉皮肤：糖果乐园（活力珊瑚橙）、森林秘境（清新薄荷绿）、星空探索（深邃星空蓝）、传统剪纸（梦幻丁香紫）；
   - 定制音色：晓晓老师（温柔推荐）、依依姐姐（活泼热烈）、云健哥哥（阳光勇敢）、小霞妹妹（软萌可爱）。
2. **移动端 100% 深度适配（Android / iOS / 微信）**：
   - 采用原生 MediaRecorder + WebAudio 双引擎，彻底解决安卓/微信音频采样休眠；
   - 极速云端 ASR `qwen-audio-3.0-asr-flash`：整句录制秒级高保真转写并自动断句排版标点；
3. **顺应孩子表达的自然启发式儿童情商对话引擎**：
   - 告别机械逐图死板逼问，根据孩子实际开口情况自适应引导；
   - 每轮实时呈现【🎯 准确度点赞徽章】；
4. **结业荣誉奖状与全屏五彩礼花动画**：
   - 故事完成时触发全屏 Confetti 礼花粒子与金币跳动奖杯；
   - 呈现三维能力评分卡（细节观察、语言表达、逻辑连贯）与专属学情荣誉勋章。

---

## 📁 目录结构

```text
TeachAgent/
├── public/                     # 前端单页应用静态资产
│   ├── index.html              # 主应用入口 HTML
│   ├── style.css               # 4 套视觉主题完整 CSS
│   ├── app.js                  # 前端核心交互、音频录制与状态机
│   ├── story_data.js           # 58 本精选连环画结构化知识库（轻量版）
│   ├── audio_manifest.js       # 4 款音色开场提示语音频清单
│   └── story-assets/           # 连环画高清画册素材 (1.jpg, 2.jpg...)
├── functions/api/              # Cloudflare Pages Functions 无服务全栈接口
│   ├── asr.js                  # 语音识别 API (Qwen-Audio-3.0-ASR-Flash)
│   ├── tts.js                  # 语音合成 API (DashScope CosyVoice)
│   ├── stories.js              # 绘本故事清单过滤与元数据服务
│   └── session/
│       └── interact.js         # 启发式教学对话 Agent (Qwen3.8-Flash)
├── scripts/                    # 知识库构建与视觉标注脚本
├── server.js                   # Node.js 本地开发轻量服务器
├── package.json
└── README.md
```

---

## 🚀 快速启动与部署

### 1. 本地开发与预览
```bash
npm install
npm run start
# 浏览器访问: http://localhost:3000
```

### 2. Cloudflare Pages 一键全球部署
```bash
npx wrangler pages deploy public --project-name teach-story-agent
```

---

## 🔑 环境变量与配置
在 Cloudflare Pages 设置中或 `.env` 中配置：
- `BAILIAN_API_KEY`: 阿里云百炼 API Key
- `BAILIAN_BASE_URL`: 百炼兼容模式服务 Base URL
