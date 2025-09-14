// Vercel serverless function (Node 18+)
const fs = require('fs');
const path = require('path');

function cosine(a, b){
  let dot=0,na=0,nb=0;
  const n = Math.min(a.length, b.length);
  for (let i=0;i<n;i++){ const x=a[i], y=b[i]; dot+=x*y; na+=x*x; nb+=y*y; }
  return dot / (Math.sqrt(na)*Math.sqrt(nb) || 1);
}

async function embed(text){
  const apiKey = process.env.OPENAI_API_KEY;
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
  });
  if (!res.ok) throw new Error('embedding failed');
  const json = await res.json();
  return json.data[0].embedding;
}

module.exports = async (req, res) => {
  try {
    if (process.env.ENABLE_SEMANTIC_404 !== 'true') {
      return res.status(404).json({ error: 'disabled' });
    }
    const q = (req.query.path || req.query.q || '').toString();
    if (!q) return res.status(400).json({ error: 'missing path' });

    const indexPath = path.join(process.cwd(), 'dist', 'js', 'semantic-index.json');
    if (!fs.existsSync(indexPath)) return res.status(404).json({ error: 'index not found' });
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

    const qv = await embed(q);
    // dequantize naive (assume int8 with symmetric max 127)
    function deq(v){ return v.map(x => x/127); }
    const ranked = index.items
      .map(it => ({ it, s: cosine(qv, deq(it.v)) }))
      .sort((a,b) => b.s - a.s)
      .slice(0, 5)
      .map(r => r.it);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    return res.status(200).json({ items: ranked });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};


