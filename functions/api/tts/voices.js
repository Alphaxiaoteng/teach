export async function onRequestGet() {
  const voices = [
    {
      id: 'xiaoxiao',
      name: '晓晓老师',
      avatar: '🌸',
      voiceName: 'zh-CN-XiaoxiaoNeural',
      tag: '温柔名师 · 默认推荐',
      desc: '3-6岁幼教名师，语调轻柔温暖',
      rate: '+10%'
    },
    {
      id: 'xiaoyi',
      name: '依依姐姐',
      avatar: '🧸',
      voiceName: 'zh-CN-XiaoyiNeural',
      tag: '活泼邻家 · 热情伴读',
      desc: '元气少女声，富有亲和力',
      rate: '+10%'
    },
    {
      id: 'yunxi',
      name: '云健哥哥',
      avatar: '🚀',
      voiceName: 'zh-CN-YunjianNeural',
      tag: '阳光哥哥 · 活力启发',
      desc: '清朗少年音，充满探索好奇心',
      rate: '+10%'
    },
    {
      id: 'yunxia',
      name: '云夏萌宝',
      avatar: '👶',
      voiceName: 'zh-CN-YunxiaNeural',
      tag: '童趣同伴 · 互动同龄',
      desc: '可爱幼童原声，同龄人视角',
      rate: '+10%'
    }
  ];

  return new Response(JSON.stringify({ success: true, voices }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
