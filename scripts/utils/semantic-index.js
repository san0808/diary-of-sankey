const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');
const config = require('../../config/site.config');

async function embedTexts(texts, provider){
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY missing');
    const url = 'https://api.openai.com/v1/embeddings';
    const body = { model: 'text-embedding-3-small', input: texts };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('OpenAI embeddings failed');
    const json = await res.json();
    return json.data.map(d => d.embedding);
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

function quantizeFloat32ToInt8(v){
  // simple symmetric quantization per vector
  const max = Math.max(1e-8, ...v.map(x => Math.abs(x)));
  return v.map(x => Math.round(127 * x / max));
}

async function buildSemanticIndex(posts, outputDir){
  const provider = process.env.EMBEDDINGS_PROVIDER || 'openai';
  const texts = posts.map(p => `${p.title}\n${p.excerpt || ''}\n${(p.tags||[]).join(' ')}`);
  logger.info('Generating embeddings for semantic 404...');
  const vectors = await embedTexts(texts, provider);
  const items = posts.map((p, i) => ({
    slug: p.slug,
    categorySlug: p.category ? p.category.toLowerCase().replace(/\s+/g,'-') : 'blog',
    title: p.title,
    tags: p.tags || [],
    excerpt: (p.excerpt || '').slice(0, 140),
    v: quantizeFloat32ToInt8(vectors[i])
  }));
  await fs.ensureDir(path.join(outputDir));
  await fs.writeJson(path.join(outputDir, 'semantic-index.json'), { items, q: 'int8' }, { spaces: 0 });
  logger.success('Semantic index generated');
}

module.exports = { buildSemanticIndex };


