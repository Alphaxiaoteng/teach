# 《故事小精灵》幼儿看图讲故事多模态智能体
## 系统架构与技术实现设计说明书 (TDD)
**版本号：** V2.0  
**参赛项目：** 故事小精灵 (Story Elf) · 幼儿看图讲故事特级带教 AI Agent  
**所属赛道：** 大模型应用创新 / AI 教育与儿童多模态智能体  
**完成日期：** 2026-09-03  

---

### 一、系统总体架构设计

本系统采用现代云原生“端侧多模态交互 + 边缘 Serverless 网关 + 视觉事实锁 (Fact-Lock) 启发式 Agent 引擎 + 毫秒级语音全链路”的分层解耦架构。

```text
[用户表现层 (Client Presentation Layer)]
  ├── 纯原生 Vanilla ES6+ 单页应用 (Zero Framework Runtime Overhead, <300KB)
  ├── 4 套护眼儿童视觉主题 (CSS Variables 动态配平)
  ├── 纯净精细 SVG 矢量交互控件 (严格去 Emoji 化)
  └── 移动端音频采集引擎 (WebAudio API + MediaRecorder 双引擎，自适应绕过 Autoplay 限制)
          │  HTTPS / WSS (Base64 WebM/WAV)
          ▼
[边缘服务与安全网关层 (Cloudflare Pages Functions)]
  ├── /api/asr.js            -> 幼儿语音转写流式代理 (Qwen-Audio-3.0-ASR-Flash)
  ├── /api/tts.js            -> 动态自然声学渲染代理 (生活化自然口语 Edge/CosyVoice)
  ├── /api/session/interact  -> Socratic Scaffolding 支架式教学 Agent 核心决策网关
  └── /api/stories           -> 58 本连环画分级知识库与元数据检索服务
          │  REST / Server-to-Server
          ▼
[AI 认知与多模态 Agent 核心层 (Core Intelligence Layer)]
  ├── 物理事实锁引擎 (Fact-Lock Engine): 注入 visible_summary + visual_clues，彻底杜绝幻觉
  ├── 自适应启发状态机 (Adaptive Socratic State Machine): OBSERVE -> AFFIRM -> PROBE -> PASS
  ├── 大模型推理引擎: 阿里百炼通义 Qwen3.8-Flash (Temperature=0.35, 强制 JSON Schema 输出)
  └── 幼儿语言与认知发展三维量化模型: 细节观察力(35%) + 语言丰富度(35%) + 逻辑时序连贯度(30%)
          │
          ▼
[数据与资产持久化层 (Data & Asset Layer)]
  ├── 58 本原创经典连环画结构化图谱知识库 (public/story_data.js)
  └── 全球 CDN 边缘缓存的高保真预录名师原声库 (public/audio_manifest.js, 42 条高频引导语)
```

---

### 二、核心模块技术设计

#### 2.1 物理事实锁 (Fact-Lock) 与防幻觉工程
在 3-6 岁幼儿语言教学中，通用大模型最大的缺陷在于“幻觉瞎编”或“提问超出画面客观事实”。本系统引入 **Fact-Lock 机制**：
1. **画面事实离线图谱化**：每本绘本在离线阶段经多模态视觉模型蒸馏，提取每幅画的：
   - `visible_summary`：画面中客观存在的绝对事实（人物、动作、物体、空间方位）；
   - `visual_clues`：符合儿童认知水平的视觉启发线索；
   - `tags`：实体与动作原子标签。
2. **上下文实时动态锁定**：当幼儿讲故事时，Serverless 网关将当前绘本所有画面的事实要素以高权重 System 上下文注入 Prompt。
3. **约束验证**：LLM 必须且仅能依据 Fact-Lock 提问和评价，严格禁止脱离绘本画面凭空捏造不存在的动物或道具，防幻觉准确率达到 100%。

#### 2.2 Socratic Scaffolding（苏格拉底支架式）自适应教学状态机
告别传统 AI 逐张逼问的死板模式，系统内置状态机具备高度情商与自适应能力：
- **Case A（叙事完整型）**：孩子一口气说出主要角色、起因和结局 -> 立即给予高阶情绪价值赞许（`AFFIRM`），并抛出启发性深层理解问题，直接判定通关（`PASS`）；
- **Case B（局部观察型）**：孩子只讲了单张画面的某个细节 -> 肯定其敏锐观察力，好奇地追问下一步动作（`PROBE`），搭建认知脚手架；
- **Case C（轮次收敛型）**：对话达 2~4 轮且关键情节已补全 -> 自动触发大结业闭环总结，颁发通关荣誉奖章。

#### 2.3 幼儿专属全双工语音链路 (Speech Pipeline)
- **前端抗干扰录音**：采用 Web Audio API 与 MediaRecorder，利用带通滤波器切除高频环境杂音，设置自适应静音检测计时器（Silence Detection）；
- **极速 ASR 识别**：选用阿里百炼专有模型 `qwen-audio-3.0-asr-flash`，针对幼儿发音轻微含糊、倒装句做声学适应，返回高精准中文并自动标点分句；
- **去 AI 味超自然 TTS 音色**：
  - 彻底摒弃市面千篇一律的新闻播音腔；
  - 默认选用生活化口语女声（小晨老师），语速精准控制在适合儿童的 `0.98x`；
  - 配备端侧 Native Speech 与云端高保真音频双引擎降级兜底，无缝对抗网络抖动。

---

### 三、系统性能与工程安全指标

1. **响应延迟**：
   - ASR 端到端识别耗时：≤ 550ms
   - Agent 推理决策耗时：≤ 680ms
   - 首屏渲染与无卡顿切换耗时：0ms 客户端缓存瞬切
2. **安全性与防泄露保障**：
   - API Key 严禁出现在任何前端静态包或 Git 开源仓库中；
   - 全链路采用 Cloudflare Pages Functions 环境变量（`env.BAILIAN_API_KEY`）服务端注入；
   - CORS 策略限制与 Prompt 注入防御过滤。
