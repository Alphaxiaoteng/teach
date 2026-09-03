export async function onRequestGet() {
  const voices = [
    {
      id: 'xiaochen',
      name: '小晨老师',
      avatar: '🌿',
      voiceName: 'zh-TW-HsiaoChenNeural',
      tag: '生活化口语 · 强烈推荐',
      desc: '零AI播音腔，柔和甜美像在耳边讲故事',
      rate: '+0%'
    },
    {
      id: 'xiaoxiao',
      name: '晓晓老师',
      avatar: '🌸',
      voiceName: 'zh-CN-XiaoxiaoNeural',
      tag: '温柔名师 · 耐心启发',
      desc: '3-6岁名师，语调温润亲切',
      rate: '+0%'
    },
    {
      id: 'xiaoyi',
      name: '依依姐姐',
      avatar: '🧸',
      voiceName: 'zh-CN-XiaoyiNeural',
      tag: '童趣绘本 · 活泼灵动',
      desc: '元气少女声，情绪饱满生动',
      rate: '+0%'
    },
    {
      id: 'xiaoyu',
      name: '小雨姐姐',
      avatar: '🍁',
      voiceName: 'zh-TW-HsiaoYuNeural',
      tag: '慢调轻声 · 治愈陪伴',
      desc: '舒缓温暖大姐姐，伴读入眠',
      rate: '-5%'
    }
  ];

  return new Response(JSON.stringify({ success: true, voices }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
