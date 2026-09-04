export async function onRequestGet() {
  return new Response(JSON.stringify({
    available: true,
    model: "qwen3.8-flash (极速启发版)",
    provider: "Cloudflare Edge + 阿里百炼通义千问"
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
