# 故事小精灵 (Story Elf) · 幼儿看图讲故事特级带教 AI Agent

> **专为 3-6 岁儿童心理学与语言发展设计的 AI 看图讲故事启蒙系统**。融合阿里百炼通义 Qwen 大模型 Agent、DashScope Qwen-Audio ASR 语音识别与 4 款精选生活化自然名师音色，带给孩子亲切温暖、生动启发、层层递进的绘本互动表达体验。

🌐 **在线体验体验地址**：[https://story.alphaintelligence.ltd](https://story.alphaintelligence.ltd)

---

## 📱 系统全流程页面完整预览 (全场景实机截图)

### 阶段一：分龄适性入口 & 绘本画廊挑选

| 01. 班级与年龄段选择 | 02. 小班绘本挑选 (2幅简易图) |
| :---: | :---: |
| ![班级年龄段选择](docs/images/01_step_age.png) | ![小班绘本挑选](docs/images/02_step_story_small.png) |
| **小班(3-4岁) / 中班(4-5岁) / 大班(5-6岁)**<br>自适应不同阶梯的词汇深度与逻辑要求 | **满格高保真原创绘本**<br>精选《小青蛙荷叶船》《小猫钓鱼》等启蒙画册 |

| 03. 中班绘本挑选 (丰富情节) | 04. 大班绘本挑选 (复杂连环画) |
| :---: | :---: |
| ![中班绘本挑选](docs/images/02_step_story_middle.png) | ![大班绘本挑选](docs/images/02_step_story_big.png) |
| **生动场景与多角色互动**<br>支持一键【换一批】随机翻阅 58 本精选画册 | **4幅完整故事脉络**<br>培养因果推理、时间先后与高阶叙事复述能力 |

---

### 阶段二：多模态启发式带教工作台 (讲故事核心交互)

| 05. 2幅连环画双图大屏示范 | 06. 4幅连环画时间脉络大屏示范 |
| :---: | :---: |
| ![2幅连环画互动](docs/images/03_step_interact_2frames.png) | ![4幅连环画互动](docs/images/03_step_interact_4frames.png) |
| **分幅大图并列展示**<br>晓晓老师温和伴读，引导孩子观察画面细节 | **经典教学绘本《小茶壶会唱歌》**<br>严格遵循起承转合物理事实锁，引导连贯表达 |

| 07. 纯净 SVG 矢量麦克风录音中 | 08. 拼音打字辅助输入模式 |
| :---: | :---: |
| ![SVG麦克风录音](docs/images/03_step_interact_recording.png) | ![打字输入模式](docs/images/03_step_interact_typing.png) |
| **专业精细 SVG 图标 (无 Emoji 干扰)**<br>极速 ASR 自动转写并标点断句，带教状态清晰 | **双模自由切换**<br>键盘输入支持拼音 IME，兼顾家长协助与幼儿自主发音 |

| 09. 绘本细节轻触放大检视器 |
| :---: |
| ![大图放大检视](docs/images/06_image_zoom_modal.png) |
| **全屏高清无损大图**<br>轻触连环画任意画面即可瞬间全屏检视，仔细看清微小物体与角色神情 |

---

### 阶段三：个性化名师声线 & 结业荣誉学情评估

| 10. 4款超自然生活化名师音色设置 | 11. 结业荣誉奖状与表达能力评估报告 |
| :---: | :---: |
| ![名师音色设置](docs/images/05_settings_modal.png) | ![结业荣誉报告](docs/images/04_step_report.png) |
| **生活化自然口语 · 拒绝机械播音腔**<br>🌿 小晨老师(自然口语·推荐) / 🌸 晓晓老师<br>🧸 依依姐姐(元气活泼) / 🍁 小雨姐姐(治愈轻声) | **量化三维学情报告**<br>🏆 专属荣誉称号 + 金色跳动奖杯<br>【细节观察 98分】【语言表达 96分】【逻辑连贯 99分】 |

---

## 🌟 核心技术与产品架构

1. **消除“AI 机械味”的生活化真人名师音色库**：
   - 彻底摒弃传统 TTS 生硬播音腔与系统机械音，优先匹配超自然生活化口语人声；
   - 语速精准配平为 `0.98x`，真实还原面对面慢速幼教呼吸感；
2. **纯净现代无 Emoji 的专业级 UI 设计**：
   - 全系统交互按钮全量升级为高保真 SVG 矢量图标（录音麦克风、键盘、播放、切换等）；
   - 内置 4 套护眼儿童视觉主题皮肤（糖果乐园、森林秘境、星空探索、传统剪纸）；
3. **自适应儿童表达的多模态 Agent**：
   - 基于视觉大模型与结构化知识库事实锁（Fact-Lock），拒绝逐图死板逼问；
   - 根据孩子口播事实自适应肯定与延伸引导，实时反馈准确度点赞徽章；
4. **全端 100% 极速响应（微信 / Android / iOS / PC）**：
   - 原生 AudioContext 预激活策略，秒级绕过移动端 Autoplay 限制；
   - 极速 ASR 整句高保真语音转写与断句排版。

---

## 📁 目录结构

```text
TeachAgent/
├── docs/images/                           # 系统全流程实机截图 (11 张)
│   ├── 01_step_age.png                    # 班级年龄段选择
│   ├── 02_step_story_small.png            # 小班绘本画廊挑选
│   ├── 02_step_story_middle.png           # 中班绘本挑选
│   ├── 02_step_story_big.png              # 大班连环画挑选
│   ├── 03_step_interact_2frames.png       # 2幅连环画交互示范
│   ├── 03_step_interact_4frames.png       # 4幅连环画交互示范
│   ├── 03_step_interact_recording.png     # SVG 麦克风录音状态
│   ├── 03_step_interact_typing.png        # 打字辅助输入模式
│   ├── 06_image_zoom_modal.png            # 全屏大图检视器
│   ├── 05_settings_modal.png              # 4款自然音色设置
│   └── 04_step_report.png                 # 结业荣誉与表达报告
├── public/                                # 前端单页应用静态资产
│   ├── index.html                         # 主入口 HTML
│   ├── style.css                          # 完整样式与主题
│   ├── app.js                             # 状态机与交互逻辑
│   ├── story_data.js                      # 58 本绘本结构化知识库
│   ├── audio_manifest.js                  # 4 款音色高保真原声清单
│   └── story-assets/                      # 连环画高清素材 (1.jpg, 2.jpg...)
├── functions/api/                         # Cloudflare Pages Functions 无服务接口
│   ├── asr.js                             # 语音识别 API (Qwen-Audio-3.0-ASR-Flash)
│   ├── tts.js                             # 语音合成 API
│   ├── tts/voices.js                      # 4 款自然名师音色配置服务
│   ├── stories.js                         # 绘本故事清单与过滤
│   └── session/
│       └── interact.js                    # 启发式教学对话 Agent (Qwen3.8-Flash)
├── package.json
└── README.md
```

---

## 🚀 部署与运行

### 1. 本地开发与预览
```bash
npm install
npm run start
# 浏览器访问: http://localhost:3000
```

### 2. Cloudflare Pages 生产环境部署
```bash
npx wrangler pages deploy public --project-name teach-story-agent --branch=main
```\n