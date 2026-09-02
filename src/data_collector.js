const fs = require('fs');
const path = require('path');

/**
 * DataCollector - 幼儿看图讲故事教学交互数据沉淀引擎
 * 负责收集真实幼儿互动语料、LLM判卷决策、高频卡壳点与成长徽章数据。
 */
class DataCollector {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.logFile = path.join(this.dataDir, 'session_interactions.jsonl');
    this.summaryFile = path.join(this.dataDir, 'interaction_summary.json');
    this._ensureStorage();
  }

  _ensureStorage() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (e) {
      console.error('[DataCollector] 目录初始化异常:', e.message);
    }
  }

  /**
   * 记录单轮师生交互数据
   */
  async recordInteraction({
    sessionId,
    storyId,
    storyTitle,
    ageGroup,
    frameIndex,
    totalFrames,
    childInput,
    agentDecision,
    teacherReply,
    evalStatus,
    moralBadge,
    latencyMs
  }) {
    const record = {
      timestamp: new Date().toISOString(),
      sessionId,
      storyId,
      storyTitle,
      ageGroup,
      frameIndex: frameIndex + 1,
      totalFrames,
      childInput,
      evalStatus,
      action: (agentDecision && agentDecision.action) || 'unknown',
      teacherReply,
      moralBadge: moralBadge || null,
      latencyMs: latencyMs || 0
    };

    const line = JSON.stringify(record) + '\n';

    // 异步非阻塞写入文件
    fs.appendFile(this.logFile, line, 'utf8', (err) => {
      if (err) console.error('[DataCollector] 写入日志失败:', err.message);
    });
  }

  /**
   * 获取最近的 N 条交互数据（供教研看板或调试查看）
   */
  getRecentInteractions(limit = 20) {
    try {
      if (!fs.existsSync(this.logFile)) return [];
      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.slice(-limit).map(l => {
        try { return JSON.parse(l); } catch(e) { return null; }
      }).filter(Boolean).reverse();
    } catch (e) {
      return [];
    }
  }
}

module.exports = new DataCollector();
