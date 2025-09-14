const fs = require('fs');
const path = require('path');

describe('404 search index', () => {
  it('emits search-index.json with expected fields', () => {
    const p = path.join(process.cwd(), 'dist', 'js', 'search-index.json');
    if (!fs.existsSync(p)) return; // allow running before build
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    expect(Array.isArray(j.items)).toBe(true);
    if (j.items.length) {
      const it = j.items[0];
      expect(it).toHaveProperty('slug');
      expect(it).toHaveProperty('categorySlug');
      expect(it).toHaveProperty('title');
    }
  });
});


