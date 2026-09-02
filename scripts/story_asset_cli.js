#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const visionAnalyzer = require('../src/vision_analyzer');

const ROOT_DIR = path.join(__dirname, '..');
const KNOWLEDGE_DIR = path.join(ROOT_DIR, 'knowledge_base/generated_stories');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets/stories');
const PUBLIC_ASSETS_DIR = path.join(ROOT_DIR, 'public/story-assets');
const CATALOG_PATH = path.join(ROOT_DIR, 'knowledge_base/catalog.json');
const STORY_DATA_JS_PATH = path.join(ROOT_DIR, 'public/story_data.js');

function createPromptReader() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function askQuestion(rl, question, defaultValue = '') {
  return new Promise((resolve) => {
    const promptText = defaultValue ? `${question} [默认: ${defaultValue}]: ` : `${question}: `;
    rl.question(promptText, (answer) => {
      resolve((answer || defaultValue).trim());
    });
  });
}

/**
 * 全量重新编译 catalog.json 与 public/story_data.js
 */
function compileAllStories() {
  console.log('🔄 正在全量编译绘本资产知识库...');
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.json'));
  const stories = [];

  files.forEach(file => {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8'));
      if (raw && raw.story_id) {
        const cat = raw.category || `${raw.images.length}张图的故事`;
        const title = raw.title;

        const embeddedImages = raw.images.map((img, i) => {
          const frameNum = i + 1;
          const localPath = path.join(ASSETS_DIR, cat, title, `${frameNum}.jpg`);
          let finalDataUrl = img.image_url;
          if (fs.existsSync(localPath)) {
            const buf = fs.readFileSync(localPath);
            finalDataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
          }
          return { ...img, image_url: finalDataUrl };
        });

        const coverUrl = embeddedImages[0] ? embeddedImages[0].image_url : '';
        stories.push({
          ...raw,
          cover_url: coverUrl,
          images: embeddedImages
        });
      }
    } catch(e) {
      console.warn(`跳过无效文件: ${file}`);
    }
  });

  // 1. 写入 knowledge_base/catalog.json
  const catalogData = {
    generated_at: new Date().toISOString(),
    total_stories: stories.length,
    stories: stories
  };
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalogData, null, 2), 'utf8');

  // 2. 写入 public/story_data.js (全量 Base64 内嵌)
  const jsContent = `window.STATIC_STORY_DATA = ${JSON.stringify(catalogData)};\n`;
  fs.writeFileSync(STORY_DATA_JS_PATH, jsContent, 'utf8');

  console.log(`✅ 编译完成！当前知识库共包含 ${stories.length} 套完整绘本（全量图片 Base64 内嵌）。`);
}

/**
 * 列出所有已录入的绘本资产
 */
function listStories() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.log('知识库目录为空。');
    return;
  }
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.json'));
  console.log(`\n📚 故事小精灵 · 绘本知识库总览 (共 ${files.length} 套):\n`);
  console.log('-----------------------------------------------------------------------------------------');
  console.log('| 序号 | 绘本名称               | 分类/张数    | 适龄班级 | 教育主题             | 故事 ID       |');
  console.log('-----------------------------------------------------------------------------------------');

  files.forEach((file, index) => {
    try {
      const story = JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8'));
      const padTitle = (story.title || '').padEnd(16, ' ');
      const padCat = (story.category || `${story.images.length}张图`).padEnd(10, ' ');
      const padAge = (story.suitable_age ? story.suitable_age.join(',') : 'small').padEnd(8, ' ');
      const padTheme = ((story.themes && story.themes.join('/')) || story.scene_theme || '成长启蒙').padEnd(16, ' ');
      console.log(`| ${(index + 1 + '').padStart(4, ' ')} | ${padTitle} | ${padCat} | ${padAge} | ${padTheme} | ${story.story_id} |`);
    } catch(e) {}
  });
  console.log('-----------------------------------------------------------------------------------------\n');
}

/**
 * 交互式添加新绘本并调用百炼视觉大模型
 */
async function interactiveAddStory() {
  const rl = createPromptReader();
  console.log('\n🎨 === 故事小精灵 · 绘本资产导入与 AI 视觉自动分析向导 (Grill-Me) ===\n');

  try {
    const title = await askQuestion(rl, '1. 请输入绘本故事名称（如：小猴过生日）');
    if (!title) throw new Error('故事名称不能为空！');

    const ageChoice = await askQuestion(rl, '2. 适龄班级 (1: 小班/托班, 2: 中班, 3: 大班)', '1');
    const ageMap = { '1': 'small', '2': 'middle', '3': 'big' };
    const ageGroup = ageMap[ageChoice] || 'small';

    const themeInput = await askQuestion(rl, '3. 教育启蒙主题（多个用空格分隔，如：分享 友爱 互助）', '生活成长');
    const themes = themeInput.split(/\s+/).filter(Boolean);

    const imagesInput = await askQuestion(rl, '4. 请输入绘本图片本地路径（1~4张，用空格或逗号分隔）');
    const rawPaths = imagesInput.split(/[\s,]+/).filter(Boolean);
    if (rawPaths.length === 0) throw new Error('请至少提供一张图片路径！');

    // 校验图片存在性
    const validImagePaths = [];
    for (const p of rawPaths) {
      const resolved = path.resolve(process.cwd(), p);
      if (!fs.existsSync(resolved)) {
        throw new Error(`找不到图片文件: ${resolved}`);
      }
      validImagePaths.push(resolved);
    }

    const totalImages = validImagePaths.length;
    const category = `${totalImages}张图的故事`;

    console.log(`\n🔍 需求确认完成: 《${title}》 | ${category} | 班级: ${ageGroup} | 主题: ${themes.join('/')}`);
    console.log(`📷 共收到 ${totalImages} 张图片，准备进行资产归档并调用【百炼视觉大模型】深度提取要素...\n`);

    const storyId = 'story_' + crypto.createHash('md5').update(title + Date.now()).digest('hex').slice(0, 10);
    const storyTargetDir = path.join(ASSETS_DIR, category, title);
    const publicTargetDir = path.join(PUBLIC_ASSETS_DIR, category, title);

    fs.mkdirSync(storyTargetDir, { recursive: true });
    fs.mkdirSync(publicTargetDir, { recursive: true });

    const processedImages = [];

    for (let i = 0; i < validImagePaths.length; i++) {
      const srcPath = validImagePaths[i];
      const frameNum = i + 1;
      const targetFileName = `${frameNum}.jpg`;
      const destAssetPath = path.join(storyTargetDir, targetFileName);
      const destPublicPath = path.join(publicTargetDir, targetFileName);

      fs.copyFileSync(srcPath, destAssetPath);
      fs.copyFileSync(srcPath, destPublicPath);

      console.log(`👁️ 正在使用阿里云百炼视觉大模型分析第 ${frameNum}/${totalImages} 幅画...`);
      let analysis = null;
      try {
        analysis = await visionAnalyzer.analyzeImage(destAssetPath, {
          storyTitle: title,
          order: frameNum,
          total: totalImages
        });
        console.log(`   ✨ 主角: ${analysis.character || '未标'} | 场景: ${analysis.location || '未标'} | 动作: ${analysis.action || '未标'}`);
        console.log(`   📝 客观事实: ${analysis.visible_summary || '已提取'}`);
      } catch (err) {
        console.warn(`   ⚠️ 视觉模型分析降级: ${err.message}`);
        analysis = {
          visible_summary: `${title} 第 ${frameNum} 幕`,
          character: '主角',
          action: '做动作',
          location: '画面场景',
          tags: ['角色:主角'],
          visual_clues: ['快看看画面里是谁呀？']
        };
      }

      processedImages.push({
        image_id: `${storyId}_frame_${frameNum}`,
        order: frameNum,
        file: targetFileName,
        image_url: `/story-assets/${category}/${title}/${targetFileName}`,
        private_annotations: {
          visible_summary: analysis.visible_summary,
          tags: analysis.tags || [],
          uncertainties: [],
          sensitivity: []
        },
        visual_clues: analysis.visual_clues || ['快看看画里是谁呀？']
      });
    }

    // 构建标准 Story Schema
    const storyObject = {
      schema_version: "2.0",
      story_id: storyId,
      title: title,
      category: category,
      suitable_age: [ageGroup],
      scene_theme: themes.join(' / '),
      themes: themes,
      quality: {
        status: "ready",
        flags: [],
        notes: ["通过 story-asset-craft CLI 自动构建与百炼视觉大模型分析导入"]
      },
      sequence_policy: {
        use_image_order: true,
        allow_inference: true,
        must_mark_uncertain: true,
        do_not_override_visible_facts_with_title: true
      },
      images: processedImages
    };

    // 保存到知识库与资产目录
    fs.writeFileSync(path.join(storyTargetDir, 'story.json'), JSON.stringify(storyObject, null, 2), 'utf8');
    fs.writeFileSync(path.join(KNOWLEDGE_DIR, `${storyId}.json`), JSON.stringify(storyObject, null, 2), 'utf8');

    console.log(`\n🎉 绘本《${title}》资产归档与视觉分析成功完成！`);
    compileAllStories();

    console.log(`\n🚀 新绘本已即刻生效，无需重启，前端和晓晓老师已支持《${title}》！`);
  } catch (err) {
    console.error(`\n❌ 导入失败: ${err.message}`);
  } finally {
    rl.close();
  }
}

/**
 * 删除指定绘本
 */
function deleteStory(storyId) {
  if (!storyId) {
    console.error('请提供要删除的故事 ID，如: node scripts/story_asset_cli.js delete story_xxxx');
    return;
  }
  const targetJson = path.join(KNOWLEDGE_DIR, `${storyId}.json`);
  if (fs.existsSync(targetJson)) {
    fs.unlinkSync(targetJson);
    console.log(`🗑️ 已从知识库移除: ${storyId}`);
    compileAllStories();
  } else {
    console.warn(`未找到故事 ID: ${storyId}`);
  }
}

// 主入口分发
const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
  case 'add':
    interactiveAddStory();
    break;
  case 'list':
  case 'ls':
    listStories();
    break;
  case 'compile':
    compileAllStories();
    break;
  case 'delete':
  case 'rm':
    deleteStory(args[1]);
    break;
  case 'help':
  default:
    console.log(`
📖 故事小精灵 · 绘本资产管理与视觉大模型分析 CLI 工具

使用方法:
  node scripts/story_asset_cli.js add                # 交互式向导导入新绘本 (自动调用百炼视觉模型)
  node scripts/story_asset_cli.js list               # 查看当前所有绘本资产清单
  node scripts/story_asset_cli.js compile            # 全量重新编译知识库与前端静态数据
  node scripts/story_asset_cli.js delete <storyId>   # 下架/删除指定绘本

快捷指令 (npm):
  npm run story-cli add
  npm run story-cli list
  npm run story-cli compile
    `);
    break;
}
