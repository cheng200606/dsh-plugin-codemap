/**
 * The standalone fallback page.
 *
 * The browser half of the plugin is a client bundle: it only appears in the
 * harness web UI once the host process has composed it into the boot graph.
 * This page is the fallback for every case where that has not happened (a
 * host that was started before the client half existed, a browser that refuses
 * the bundle, a reader that only wants a link).
 *
 * It is deliberately self-contained: no framework, no external asset, no
 * import. It talks to the same four routes the panel uses.
 */

/**
 * Render the standalone page.
 *
 * @param {{panel: string, page: string, search: string, generate: string}} routes
 * @returns {string} the HTML document.
 */
export function renderFallbackPage(routes) {
  const config = JSON.stringify({
    panel: routes.panel,
    page: routes.page,
    search: routes.search,
    generate: routes.generate,
  })
  return `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Repo Wiki</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 14px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { display: flex; gap: 12px; align-items: center; padding: 10px 16px; border-bottom: 1px solid #8883; }
  header h1 { font-size: 15px; margin: 0; }
  header .meta { opacity: .7; font-size: 12px; }
  main { display: flex; min-height: calc(100vh - 44px); }
  #tree { width: 260px; border-right: 1px solid #8883; padding: 8px; overflow: auto; }
  #tree input { width: 100%; box-sizing: border-box; padding: 4px 6px; margin-bottom: 8px; }
  #tree h2 { font-size: 11px; text-transform: uppercase; opacity: .6; margin: 10px 0 4px; }
  #tree a { display: block; padding: 3px 6px; border-radius: 4px; cursor: pointer; text-decoration: none; color: inherit; }
  #tree a:hover { background: #8882; }
  #tree a.active { background: #8883; }
  #tree .st { font-size: 11px; opacity: .6; margin-left: 6px; }
  #content { flex: 1; padding: 16px 24px; overflow: auto; }
  #content pre { background: #8881; padding: 8px; border-radius: 6px; overflow: auto; }
  #content table { border-collapse: collapse; }
  #content td, #content th { border: 1px solid #8883; padding: 3px 6px; }
  .banner { padding: 8px 16px; background: #f0c00022; border-bottom: 1px solid #8883; font-size: 13px; }
  .err { color: #c0392b; }
</style>
</head>
<body>
<header>
  <h1>Repo Wiki</h1>
  <span class="meta" id="root">&nbsp;</span>
  <span class="meta" id="stats">&nbsp;</span>
  <button id="refresh">刷新</button>
  <button id="generate">生成</button>
  <select id="lang"><option value="zh">zh</option><option value="en">en</option></select>
</header>
<div class="banner" id="state">载入中…</div>
<main>
  <nav id="tree"><input id="q" placeholder="搜索页面…"></nav>
  <section id="content"><p class="err" id="err"></p></section>
</main>
<script>
const ROUTES = ${config};
const state = { panel: null, page: null, lang: 'zh' };
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

async function api(path, options) {
  const response = await fetch(path, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const raw = body && typeof body.error === 'object' && body.error !== null ? body.error : body;
    const detail = (raw && (raw.message || raw.error)) || ('HTTP ' + response.status);
    const error = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    error.code = (raw && raw.code) || 'failed';
    error.hint = (raw && raw.hint) || '';
    throw error;
  }
  return body;
}

function setState(text, kind) {
  const node = $('state');
  node.textContent = text;
  node.className = kind === 'error' ? 'banner err' : 'banner';
}

async function loadPanel() {
  setState('载入中…');
  try {
    state.panel = await api(ROUTES.panel);
  } catch (error) {
    setState('载入失败：' + error.message + (error.hint ? '（' + error.hint + '）' : ''), 'error');
    return;
  }
  const panel = state.panel || {};
  $('root').textContent = panel.root || '';
  const stats = panel.stats || {};
  $('stats').textContent = [stats.pageCount + ' 页', stats.citationTotal + ' 引用', stats.fresh + ' 新鲜']
    .filter(Boolean).join(' · ');
  const client = panel.client || {};
  const bits = [];
  if (client.composed) bits.push('客户端半体已进图' + (client.served ? '（可取包 ' + client.bytes + ' B）' : '（取包失败）'));
  else if (client.error) bits.push(client.error);
  setState(bits.join(' · ') || '就绪');
  renderTree();
}

function renderTree(hits) {
  const tree = $('tree');
  const panel = state.panel || {};
  const pages = hits || panel.pages || [];
  const sections = panel.sections || [];
  let html = '';
  if (hits) {
    html += '<h2>搜索结果 (' + pages.length + ')</h2>';
    for (const hit of pages) {
      html += '<a data-id="' + esc(hit.id) + '">' + esc(hit.title) + '<span class="st">' + esc(hit.id) + '</span></a>';
    }
  } else {
    for (const section of sections) {
      html += '<h2>' + esc(section.label || '根目录') + '</h2>';
      for (const id of section.pages || []) {
        const page = (panel.pages || []).find((p) => p.id === id) || { id, title: id };
        html += '<a data-id="' + esc(page.id) + '">' + esc(page.title) + '<span class="st">' + esc(page.status || '') + '</span></a>';
      }
    }
    const cards = panel.cards || [];
    if (cards.length) {
      html += '<h2>知识卡</h2>';
      for (const card of cards) {
        html += '<a data-id="' + esc('card:' + card.id) + '">' + esc(card.title) + '</a>';
      }
    }
  }
  tree.innerHTML = html;
  for (const link of tree.querySelectorAll('a')) {
    link.addEventListener('click', () => openPage(link.getAttribute('data-id')));
  }
}

function renderBlocks(blocks) {
  let html = '';
  for (const block of blocks || []) {
    if (block.type === 'heading') {
      const level = Math.min(Math.max(block.level || 2, 1), 5);
      html += '<h' + level + '>' + esc(block.text) + '</h' + level + '>';
    } else if (block.type === 'paragraph') {
      html += '<p>' + esc(block.text) + '</p>';
    } else if (block.type === 'list') {
      html += '<ul>' + (block.items || []).map((item) => '<li>' + esc(item) + '</li>').join('') + '</ul>';
    } else if (block.type === 'code' || block.type === 'mermaid') {
      html += '<pre>' + esc(block.code) + '</pre>';
    } else if (block.type === 'table') {
      html += '<table><tr>' + (block.header || []).map((cell) => '<th>' + esc(cell) + '</th>').join('') + '</tr>';
      for (const row of block.rows || []) html += '<tr>' + row.map((cell) => '<td>' + esc(cell) + '</td>').join('') + '</tr>';
      html += '</table>';
    } else if (block.type === 'quote') {
      html += '<blockquote>' + esc(block.text) + '</blockquote>';
    }
  }
  return html;
}

async function openPage(id) {
  setState('载入页面 ' + id + ' …');
  try {
    const page = await api(ROUTES.page + '?id=' + encodeURIComponent(id));
    state.page = page;
    $('content').innerHTML = '<h1>' + esc(page.title) + '</h1><p class="meta">' + esc(page.path) + ' · ' + esc(page.status) + '</p>' + renderBlocks(page.blocks);
    setState('就绪');
  } catch (error) {
    $('content').innerHTML = '<p class="err">' + esc(error.message) + '</p>';
    setState('载入失败：' + error.message, 'error');
  }
}

let searchTimer = null;
$('q').addEventListener('input', (event) => {
  clearTimeout(searchTimer);
  const value = event.target.value.trim();
  if (!value) { renderTree(); return; }
  searchTimer = setTimeout(async () => {
    try {
      const result = await api(ROUTES.search + '?q=' + encodeURIComponent(value));
      renderTree(result.hits || []);
    } catch (error) {
      setState('搜索失败：' + error.message, 'error');
    }
  }, 200);
});

$('refresh').addEventListener('click', () => loadPanel());
$('lang').addEventListener('change', (event) => { state.lang = event.target.value; });
$('generate').addEventListener('click', async () => {
  setState('生成中…');
  try {
    const result = await api(ROUTES.generate, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'full', language: state.lang }),
    });
    setState('生成完成：写入 ' + (result.pagesWritten ?? 0) + ' 页，跳过 '
      + (result.pagesSkipped ?? 0) + ' 页，引用 ' + (result.citations ? result.citations.valid : 0)
      + '/' + (result.citations ? result.citations.total : 0));
    await loadPanel();
  } catch (error) {
    setState('生成失败：' + error.message + (error.hint ? '（' + error.hint + '）' : ''), 'error');
  }
});

loadPanel();
</script>
</body>
</html>
`
}
