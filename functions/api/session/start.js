export async function onRequestPost(context) {
  const { request } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const { storyId, ageGroup, voiceId } = body;
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Response(JSON.stringify({
      success: true,
      session: {
        sessionId,
        storyId: storyId || '',
        ageGroup: ageGroup || 'small',
        voiceId: voiceId || 'xiaoxiao',
        createdAt: Date.now()
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
