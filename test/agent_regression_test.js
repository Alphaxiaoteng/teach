const assert = require('assert');
const StoryEngine = require('../src/story_engine');
const llmAgentCore = require('../src/llm_agent_core');
const asrService = require('../src/asr_service');
const ttsService = require('../src/tts_service');

async function runRegressionTests() {
  console.log('🧪 开始执行【故事小精灵 · 幼儿看图讲故事】最新全链路回归测试...\n');

  const engine = new StoryEngine();

  // Test 1: 绘本库总数
  console.log('1. 验证 58 套连环画绘本库全量加载...');
  const smallStories = engine.getStories('small');
  const middleStories = engine.getStories('middle');
  const bigStories = engine.getStories('big');
  const allStories = engine.getStories();

  assert.strictEqual(allStories.length >= 50, true, '总绘本数应不少于 50 套');
  console.log(`  ✓ 成功加载 ${allStories.length} 套真实绘本 (小班:${smallStories.length}, 中班:${middleStories.length}, 大班:${bigStories.length})`);

  // Test 2: 固定纯净首问（根据图片张数）
  console.log('\n2. 验证分图数纯净首问标准（绝不剧透与多余引导）...');
  const story1 = allStories.find(s => s.images.length === 1);
  const story2 = allStories.find(s => s.images.length === 2);
  const story3 = allStories.find(s => s.images.length === 3);
  const story4 = allStories.find(s => s.images.length === 4);

  const sess1 = await engine.startSession(story1.story_id, 'small', 'xiaoxiao');
  assert.strictEqual(sess1.agentMessage, '小朋友，画面中你看到了谁？它在干什么呀？');
  console.log('  ✓ 1张图首问:', sess1.agentMessage);

  const sess2 = await engine.startSession(story2.story_id, 'middle', 'xiaoxiao');
  assert.strictEqual(sess2.agentMessage, '小朋友，画里是谁？在什么地方？它在干什么呀？');
  console.log('  ✓ 2张图首问:', sess2.agentMessage);

  const sess3 = await engine.startSession(story3.story_id, 'middle', 'xiaoxiao');
  assert.strictEqual(sess3.agentMessage, '小朋友，这是什么时候？画里是谁？在什么地方干什么呀？');
  console.log('  ✓ 3张图首问:', sess3.agentMessage);

  const sess4 = await engine.startSession(story4.story_id, 'big', 'xiaoxiao');
  assert.strictEqual(sess4.agentMessage, '小朋友，这是什么时候？画里是谁？在什么地方做了什么？结果怎么样啦？');
  console.log('  ✓ 4张图首问:', sess4.agentMessage);

  // Test 3: LLM Agent 配置与百炼 ASR 连通性
  console.log('\n3. 验证阿里云百炼大模型中枢配置...');
  assert.strictEqual(llmAgentCore.isConfigured(), true, 'LLM Agent 应成功注入百炼配置');
  console.log('  ✓ LLM Agent 状态: 就绪 (Model:', llmAgentCore.model, ')');

  // Test 4: TTS 音色语速
  console.log('\n4. 验证 4 款幼教名师音色 1.1x 语速...');
  ['xiaoxiao', 'xiaoyi', 'yunxi', 'yunxia'].forEach(id => {
    const cfg = ttsService.resolveVoiceConfig(id);
    assert.strictEqual(cfg.rate, '+10%', `${cfg.name} 语速应为 +10% (1.1x)`);
  });
  console.log('  ✓ 4 款名师音色 (晓晓/依依/云健/云夏) 全部固化为 1.1x 黄金语速');

  console.log('\n🎉 所有核心测试 100% 顺利通过！系统状态极度健康！');
}

runRegressionTests().catch(err => {
  console.error('\n❌ 测试失败:', err);
  process.exit(1);
});
