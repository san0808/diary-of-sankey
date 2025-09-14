(function(){
  function tokenize(text){
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function jaccard(a, b){
    const A = new Set(a);
    const B = new Set(b);
    if (A.size === 0 && B.size === 0) return 0;
    let inter = 0;
    A.forEach(t => { if (B.has(t)) inter++; });
    return inter / (A.size + B.size - inter);
  }

  function levenshteinRatio(a, b){
    if (!a || !b) return 0;
    const m = a.length, n = b.length;
    const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
    for (let i=0;i<=m;i++) dp[i][0] = i;
    for (let j=0;j<=n;j++) dp[0][j] = j;
    for (let i=1;i<=m;i++){
      for (let j=1;j<=n;j++){
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i-1][j] + 1,
          dp[i][j-1] + 1,
          dp[i-1][j-1] + cost
        );
      }
    }
    const dist = dp[m][n];
    return 1 - dist / Math.max(m, n);
  }

  function computeScores(items, path){
    const segs = path.replace(/\/+$/, '').split('/').filter(Boolean);
    const category = segs[0] || '';
    const slug = segs[1] || segs[0] || '';
    const pathTokens = tokenize(path);

    return items.map(p => {
      const catMatch = p.categorySlug === category ? 1 : 0;
      const slugSim = levenshteinRatio(slug, p.slug);
      const titleTokens = p.tokens || tokenize(p.title);
      const titleOverlap = jaccard(pathTokens, titleTokens);
      const tagOverlap = jaccard(pathTokens, p.tags || []);
      const starts = p.slug.startsWith(slug) || p.title.toLowerCase().startsWith(slug.toLowerCase()) ? 1 : 0;
      const score = 3*catMatch + 4*slugSim + 3*titleOverlap + 2*tagOverlap + 1*starts;
      return { post: p, score };
    }).sort((a,b) => b.score - a.score);
  }

  async function loadIndex(){
    const res = await fetch('/js/search-index.json');
    if (!res.ok) throw new Error('index fetch failed');
    return res.json();
  }

  async function trySemantic(path){
    try {
      const url = `/api/semantic-suggest?path=${encodeURIComponent(path)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      if (!json || !Array.isArray(json.items)) return null;
      return json.items.map(p => ({ post: p, score: 1 }));
    } catch { return null; }
  }

  function render(list){
    const root = document.getElementById('suggestions');
    if (!root) return;
    root.innerHTML = '';
    list.forEach(({post}) => {
      const a = document.createElement('a');
      a.href = `/${post.categorySlug}/${post.slug}`;
      a.className = 'block p-4 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors';
      const t = document.createElement('div');
      t.className = 'font-serif text-xl';
      t.textContent = post.title;
      const m = document.createElement('div');
      m.className = 'mt-1 text-sm text-gray-600';
      m.textContent = post.excerpt || '';
      a.appendChild(t); a.appendChild(m);
      root.appendChild(a);
    });
  }

  async function init(){
    try {
      const idx = await loadIndex();
      const path = window.location.pathname || '/';
      const ranked = computeScores(idx.items || [], path);
      render(ranked.slice(0, 5));

      // If semantic API enabled, blend results
      const sem = await trySemantic(path);
      if (sem && sem.length){
        const map = new Map();
        ranked.slice(0,10).forEach(r => map.set(r.post.slug, r));
        sem.forEach(r => {
          const ex = map.get(r.post.slug);
          if (ex) ex.score += 2; else map.set(r.post.slug, r);
        });
        const blended = Array.from(map.values()).sort((a,b)=>b.score-a.score).slice(0,5);
        render(blended);
      }

      const input = document.getElementById('q');
      if (input) {
        input.addEventListener('input', function(){
          const q = this.value || '';
          const rankedQ = computeScores(idx.items || [], q);
          render(rankedQ.slice(0,5));
        });
      }
    } catch (e) {
      // Silent fail; keep basic 404
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


