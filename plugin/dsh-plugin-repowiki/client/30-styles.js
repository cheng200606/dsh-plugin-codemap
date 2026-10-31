/* ---- 30-styles.js ----
 * The stylesheet injected once into the panel.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    /** One-off keyframes (shimmer, fade) the inline styles cannot express. */
    function injectPanelStyles() {
      try {
        if (document.getElementById('repowiki-panel-styles')) return
        const style = document.createElement('style')
        style.id = 'repowiki-panel-styles'
        style.textContent = `
@keyframes repowiki-shimmer { 0% { background-position: -220px 0; } 100% { background-position: 220px 0; } }
@keyframes repowiki-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes repowiki-pulse { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }

.repowiki-shell {
  --rw-fg: var(--dsw-alias-label-primary, #e9eaee);
  --rw-fg-2: var(--dsw-alias-label-secondary, #b7bcc5);
  --rw-fg-3: var(--dsw-alias-label-tertiary, #8a909a);
  --rw-line: var(--dsw-alias-border-l2, rgba(127,127,127,.24));
  --rw-surface: var(--dsw-alias-fill-tsp-primary, rgba(127,127,127,.06));
  --rw-surface-2: var(--dsw-alias-fill-tsp-secondary, rgba(127,127,127,.12));
  --rw-accent: var(--dsw-alias-accent, #6ea8fe);
  --rw-accent-soft: color-mix(in srgb, var(--rw-accent) 13%, transparent);
  --rw-accent-line: color-mix(in srgb, var(--rw-accent) 42%, transparent);
  --rw-shadow: 0 18px 48px rgba(0,0,0,.14), 0 2px 8px rgba(0,0,0,.06);
  color: var(--rw-fg);
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  letter-spacing: .01em;
  background:
    radial-gradient(900px 420px at 100% -10%, color-mix(in srgb, var(--rw-accent) 8%, transparent), transparent 70%),
    radial-gradient(700px 380px at -10% 110%, color-mix(in srgb, var(--rw-accent) 5%, transparent), transparent 70%);
}
.repowiki-shell *, .repowiki-shell *::before, .repowiki-shell *::after { box-sizing: border-box; }
.repowiki-shell button, .repowiki-shell input { font: inherit; }
.repowiki-shell button { -webkit-tap-highlight-color: transparent; }
.repowiki-shell button:focus-visible, .repowiki-shell input:focus-visible, .repowiki-shell [tabindex]:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--rw-accent) 72%, transparent);
  outline-offset: 2px;
}
.repowiki-shell ::selection { background: color-mix(in srgb, var(--rw-accent) 28%, transparent); }
.repowiki-shell ::-webkit-scrollbar { width: 9px; height: 9px; }
.repowiki-shell ::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--rw-fg-3) 28%, transparent); border: 3px solid transparent; border-radius: 999px; background-clip: padding-box; }
.repowiki-shell ::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--rw-fg-3) 46%, transparent); border: 3px solid transparent; background-clip: padding-box; }
.repowiki-shell ::-webkit-scrollbar-track { background: transparent; }

.repowiki-header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 9px 18px;
  border-bottom: 1px solid var(--rw-line);
  background: color-mix(in srgb, var(--rw-surface) 52%, transparent);
  backdrop-filter: blur(14px) saturate(130%);
  flex-wrap: wrap;
  flex: 0 0 auto;
}
.repowiki-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.repowiki-brand-mark {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 11px;
  color: #fff;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--rw-accent) 72%, #fff 28%), color-mix(in srgb, var(--rw-accent) 82%, #000 18%));
  box-shadow: 0 8px 18px color-mix(in srgb, var(--rw-accent) 24%, transparent), inset 0 1px 0 rgba(255,255,255,.28);
}
.repowiki-brand-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.repowiki-brand-line { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.repowiki-brand-title { font-size: 13px; font-weight: 650; letter-spacing: -.01em; white-space: nowrap; }
.repowiki-brand-slash { color: var(--rw-fg-3); font-size: 11px; }
.repowiki-brand-repo { font-size: 13px; font-weight: 600; color: var(--rw-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.repowiki-brand-sub { font-size: 10.5px; color: var(--rw-fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px; font-variant-numeric: tabular-nums; }
.repowiki-run-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; }

.repowiki-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--rw-line);
  background: color-mix(in srgb, var(--rw-surface) 80%, transparent);
}
.repowiki-tab {
  height: 27px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--rw-fg-3);
  font-size: 11.5px;
  cursor: pointer;
  transition: background .15s ease, color .15s ease, box-shadow .15s ease;
}
.repowiki-tab:hover { color: var(--rw-fg); background: color-mix(in srgb, var(--rw-fg) 7%, transparent); }
.repowiki-tab.is-active {
  color: var(--rw-fg);
  background: color-mix(in srgb, var(--rw-fg) 10%, transparent);
  box-shadow: inset 0 0 0 1px var(--rw-line), 0 1px 2px rgba(0,0,0,.06);
}
.repowiki-tab svg { opacity: .8; }
.repowiki-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }

.repowiki-btn {
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid var(--rw-line);
  border-radius: 9px;
  background: transparent;
  color: var(--rw-fg-2);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease, color .15s ease, transform .15s ease;
}
.repowiki-btn:hover:not(:disabled) {
  color: var(--rw-fg);
  background: var(--rw-surface);
  border-color: color-mix(in srgb, var(--rw-fg) 18%, var(--rw-line));
}
.repowiki-btn:active:not(:disabled) { transform: translateY(1px); }
.repowiki-btn.is-primary {
  color: #fff;
  border-color: color-mix(in srgb, var(--rw-accent) 72%, #000 12%);
  background: linear-gradient(180deg, color-mix(in srgb, var(--rw-accent) 92%, #fff 8%), var(--rw-accent));
  box-shadow: 0 6px 16px color-mix(in srgb, var(--rw-accent) 22%, transparent), inset 0 1px 0 rgba(255,255,255,.22);
}
.repowiki-btn.is-primary:hover:not(:disabled) { color: #fff; filter: brightness(1.04); background: linear-gradient(180deg, color-mix(in srgb, var(--rw-accent) 92%, #fff 8%), var(--rw-accent)); }
.repowiki-btn.is-active { color: var(--rw-fg); background: var(--rw-accent-soft); border-color: var(--rw-accent-line); }
.repowiki-btn.is-icon { width: 30px; padding: 0; }
.repowiki-btn:disabled { opacity: .5; cursor: default; }

.repowiki-segment { display: inline-flex; align-items: center; gap: 2px; padding: 3px; border: 1px solid var(--rw-line); border-radius: 9px; background: color-mix(in srgb, var(--rw-surface) 80%, transparent); }
.repowiki-segment button { height: 23px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: var(--rw-fg-3); font-size: 11px; cursor: pointer; }
.repowiki-segment button:hover { color: var(--rw-fg); }
.repowiki-segment button.is-active { color: var(--rw-fg); background: color-mix(in srgb, var(--rw-fg) 10%, transparent); }
.repowiki-segment button:disabled { opacity: .38; cursor: default; }

.repowiki-chip, .repowiki-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--rw-line);
  background: color-mix(in srgb, var(--rw-surface) 70%, transparent);
  color: var(--rw-fg-2);
  font-size: 10.5px;
  line-height: 18px;
  white-space: nowrap;
}
.repowiki-status { background: transparent; }

.repowiki-sidebar {
  width: 272px;
  flex: 0 0 272px;
  padding: 14px 12px 20px;
  border-right: 1px solid var(--rw-line);
  overflow-y: auto;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--rw-surface) 48%, transparent));
}
.repowiki-search { position: relative; display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.repowiki-search-field { position: relative; flex: 1 1 auto; min-width: 0; }
.repowiki-search-field input {
  width: 100%;
  height: 34px;
  padding: 0 28px 0 30px;
  border: 1px solid var(--rw-line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--rw-surface) 88%, transparent);
  color: var(--rw-fg);
  font-size: 12px;
  outline: none;
  transition: border-color .15s ease, background .15s ease, box-shadow .15s ease;
}
.repowiki-search-field input::placeholder { color: var(--rw-fg-3); }
.repowiki-search-field input:focus { border-color: var(--rw-accent-line); box-shadow: 0 0 0 3px var(--rw-accent-soft); background: color-mix(in srgb, var(--rw-surface) 65%, transparent); }
.repowiki-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--rw-fg-3); pointer-events: none; }
.repowiki-search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--rw-fg-3); cursor: pointer; }
.repowiki-search-clear:hover { color: var(--rw-fg); background: var(--rw-surface-2); }
.repowiki-sidebar-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 2px 2px 10px; }
.repowiki-eyebrow { font-size: 9.5px; font-weight: 650; letter-spacing: .14em; text-transform: uppercase; color: var(--rw-fg-3); }
.repowiki-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin: 0 0 5px;
  padding: 4px 4px;
  border: 0;
  background: transparent;
  color: var(--rw-fg-3);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .1em;
  text-transform: uppercase;
  cursor: pointer;
}
.repowiki-section-label:hover { color: var(--rw-fg-2); }
.repowiki-section-count { margin-left: auto; padding: 0 6px; border-radius: 999px; background: var(--rw-surface); color: var(--rw-fg-3); font-size: 9.5px; line-height: 15px; letter-spacing: 0; }
.repowiki-tree-row { transition: background .12s ease, color .12s ease, box-shadow .12s ease; }
.repowiki-tree-row:hover { background: color-mix(in srgb, var(--rw-fg) 7%, transparent) !important; }
.repowiki-tree-row.is-active { box-shadow: inset 2px 0 0 var(--rw-accent); }
.repowiki-tree-row.is-active:hover { background: var(--rw-accent-soft) !important; }

.repowiki-main { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.repowiki-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.repowiki-page { width: 100%; max-width: 900px; margin: 0 auto; padding: 30px 34px 76px; }
.repowiki-overview { width: 100%; max-width: 1060px; margin: 0 auto; padding: 26px 30px 64px; }
.repowiki-cards, .repowiki-projects { width: 100%; max-width: 1020px; margin: 0 auto; padding: 26px 30px 64px; }
.repowiki-page-title { margin: 6px 0 10px; font-size: 27px; line-height: 1.25; font-weight: 650; letter-spacing: -.025em; color: var(--rw-fg); }
.repowiki-page-goal { max-width: 70ch; margin: 0 0 16px; color: var(--rw-fg-2); font-size: 13px; line-height: 1.75; }
.repowiki-page-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.repowiki-back { display: inline-flex; align-items: center; gap: 5px; padding: 0; border: 0; background: transparent; color: var(--rw-fg-3); font-size: 11px; cursor: pointer; }
.repowiki-back:hover { color: var(--rw-fg); }
.repowiki-path { max-width: 58%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 8px; border-radius: 999px; background: var(--rw-surface); color: var(--rw-fg-3); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
.repowiki-breadcrumb { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; font-size: 11px; color: var(--rw-fg-3); }
.repowiki-breadcrumb button { padding: 0; border: 0; background: transparent; color: var(--rw-accent); font-size: 11px; cursor: pointer; }
.repowiki-breadcrumb button:hover { text-decoration: underline; }
.repowiki-toc { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0 0 20px; padding: 9px 12px; border: 1px solid var(--rw-line); border-radius: 11px; background: color-mix(in srgb, var(--rw-surface) 92%, #808080 8%); backdrop-filter: blur(12px); box-shadow: 0 6px 18px rgba(0,0,0,.06); }
.repowiki-toc button { padding: 1px 5px; border: 0; border-radius: 5px; background: transparent; color: var(--rw-fg-2); font-size: 11px; cursor: pointer; }
.repowiki-toc button:hover { color: var(--rw-fg); background: var(--rw-surface-2); }

.repowiki-stat {
  flex: 1 1 0;
  min-width: 128px;
  padding: 14px 16px;
  border: 1px solid var(--rw-line);
  border-radius: 14px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--rw-fg) 5%, transparent), transparent 72%),
    color-mix(in srgb, var(--rw-surface) 60%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--rw-fg) 5%, transparent);
}
.repowiki-stat-label { margin-bottom: 5px; color: var(--rw-fg-3); font-size: 10.5px; letter-spacing: .04em; }
.repowiki-stat-value { color: var(--rw-fg); font-size: 23px; font-weight: 650; line-height: 1.05; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.repowiki-stat-sub { color: var(--rw-fg-3); font-size: 10.5px; }

.repowiki-empty { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px 24px; text-align: center; }
.repowiki-empty-mark { width: 58px; height: 58px; display: grid; place-items: center; margin-bottom: 4px; border-radius: 18px; border: 1px solid var(--rw-line); background: linear-gradient(145deg, var(--rw-accent-soft), var(--rw-surface)); color: var(--rw-accent); box-shadow: var(--rw-shadow); }
.repowiki-empty-title { font-size: 17px; font-weight: 650; letter-spacing: -.02em; }
.repowiki-empty-copy { max-width: 420px; margin: 0 0 8px; color: var(--rw-fg-3); font-size: 12px; line-height: 1.7; }

.repowiki-loading { flex: 1 1 auto; width: 100%; max-width: 760px; margin: 0 auto; padding: 30px 34px; }
.repowiki-skeleton { border-radius: 7px; background: linear-gradient(90deg, var(--rw-surface) 25%, var(--rw-surface-2) 50%, var(--rw-surface) 75%); background-size: 440px 100%; animation: repowiki-shimmer 1.4s ease-in-out infinite; }

.repowiki-error { max-width: 620px; margin: 28px auto; padding: 20px; border: 1px solid color-mix(in srgb, #e06c6c 38%, transparent); border-radius: 14px; background: color-mix(in srgb, #e06c6c 7%, transparent); }
.repowiki-error-title { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; font-weight: 650; }
.repowiki-error-body { color: var(--rw-fg-2); font-size: 12px; line-height: 1.7; }
.repowiki-error-hint { margin-top: 8px; color: var(--rw-fg-3); font-size: 11.5px; line-height: 1.65; }

.repowiki-graph { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: 18px 20px 20px; }
.repowiki-graph-toolbar { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.repowiki-graph-heading { min-width: 0; }
.repowiki-graph-heading h2 { margin: 3px 0 2px; color: var(--rw-fg); font-size: 19px; font-weight: 650; letter-spacing: -.02em; }
.repowiki-graph-sub { color: var(--rw-fg-3); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.repowiki-graph-tools { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }
.repowiki-graph-search { position: relative; }
.repowiki-graph-search input { width: 172px; height: 30px; padding: 0 10px 0 28px; border: 1px solid var(--rw-line); border-radius: 9px; background: color-mix(in srgb, var(--rw-surface) 84%, transparent); color: var(--rw-fg); font-size: 11.5px; outline: none; }
.repowiki-graph-search input::placeholder { color: var(--rw-fg-3); }
.repowiki-graph-search input:focus { border-color: var(--rw-accent-line); box-shadow: 0 0 0 3px var(--rw-accent-soft); }
.repowiki-graph-search svg { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--rw-fg-3); pointer-events: none; }
.repowiki-graph-canvas {
  position: relative;
  flex: 1 1 auto;
  min-height: 340px;
  border: 1px solid var(--rw-line);
  border-radius: 18px;
  overflow: hidden;
  background:
    radial-gradient(760px 380px at 50% 0%, color-mix(in srgb, var(--rw-accent) 7%, transparent), transparent 72%),
    color-mix(in srgb, var(--rw-surface) 42%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--rw-fg) 4%, transparent);
}
.repowiki-graph-canvas::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--rw-fg-3) 26%, transparent) 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: .42;
  mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 72%, transparent 100%);
}
.repowiki-graph-canvas > svg { position: absolute; inset: 0; z-index: 1; display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; user-select: none; }
.repowiki-graph-canvas.is-dragging { border-color: var(--rw-accent-line); }
.repowiki-graph-canvas.is-dragging > svg { cursor: grabbing; }
.repowiki-graph-node .repowiki-node-box { fill: color-mix(in srgb, var(--rw-fg) 5%, transparent); stroke: color-mix(in srgb, var(--rw-fg) 16%, transparent); stroke-width: 1; transition: fill .16s ease, stroke .16s ease, filter .16s ease; }
.repowiki-graph-node:hover .repowiki-node-box { stroke: var(--rw-accent-line); filter: drop-shadow(0 8px 16px rgba(0,0,0,.16)); }
.repowiki-graph-node:focus-visible { outline: none; }
.repowiki-graph-node:focus-visible .repowiki-node-box { stroke: var(--rw-accent); stroke-width: 2; }
.repowiki-graph-node.is-selected .repowiki-node-box { fill: var(--rw-accent-soft); stroke: var(--rw-accent); stroke-width: 1.6; }
.repowiki-graph-node.is-dimmed { opacity: .17; }
.repowiki-node-title { fill: var(--rw-fg); font-size: 12px; font-weight: 600; letter-spacing: .005em; }
.repowiki-node-meta { fill: var(--rw-fg-3); font-size: 10px; }
.repowiki-graph-edge { fill: none; stroke: color-mix(in srgb, var(--rw-fg) 22%, transparent); stroke-width: 1.05; opacity: .9; transition: stroke .16s ease, opacity .16s ease; }
.repowiki-graph-edge.is-active { stroke: var(--rw-accent); stroke-width: 1.8; opacity: 1; }
.repowiki-graph-edge.is-dimmed { opacity: .1; }
.repowiki-graph-guide { stroke: var(--rw-line); stroke-width: 1; stroke-dasharray: 2 7; opacity: .55; }
.repowiki-graph-layer { fill: var(--rw-fg-3); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; opacity: .62; }
.repowiki-graph-watermark { position: absolute; z-index: 0; left: 18px; bottom: 16px; color: var(--rw-fg); font-size: 36px; font-weight: 700; letter-spacing: .16em; opacity: .035; pointer-events: none; user-select: none; white-space: nowrap; }
.repowiki-graph-hint { position: absolute; z-index: 2; left: 14px; top: 13px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border: 1px solid var(--rw-line); border-radius: 999px; background: color-mix(in srgb, var(--rw-surface) 75%, transparent); backdrop-filter: blur(10px); color: var(--rw-fg-3); font-size: 10px; pointer-events: none; }
.repowiki-graph-legend { position: absolute; z-index: 2; right: 14px; bottom: 13px; display: flex; align-items: center; gap: 11px; padding: 6px 10px; border: 1px solid var(--rw-line); border-radius: 999px; background: color-mix(in srgb, var(--rw-surface) 75%, transparent); backdrop-filter: blur(10px); color: var(--rw-fg-3); font-size: 10px; pointer-events: none; }
.repowiki-graph-tip { position: absolute; z-index: 2; left: 14px; bottom: 15px; color: var(--rw-fg-3); font-size: 10px; pointer-events: none; }
.repowiki-legend-dot { display: inline-block; width: 6px; height: 6px; margin-right: 4px; border-radius: 2px; vertical-align: 1px; }
.repowiki-graph-inspector {
  position: absolute;
  z-index: 3;
  left: 14px;
  bottom: 14px;
  width: min(390px, calc(100% - 28px));
  padding: 14px 15px;
  border: 1px solid var(--rw-line);
  border-radius: 14px;
  background: color-mix(in srgb, var(--rw-surface) 70%, transparent);
  backdrop-filter: blur(18px) saturate(140%);
  box-shadow: var(--rw-shadow);
  animation: repowiki-fade-in .2s ease;
}
.repowiki-graph-inspector-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 8px; }
.repowiki-graph-inspector-title { font-size: 13px; font-weight: 650; color: var(--rw-fg); }
.repowiki-graph-inspector-path { margin-top: 7px; color: var(--rw-fg-3); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
.repowiki-graph-inspector-copy { margin-top: 7px; color: var(--rw-fg-3); font-size: 11px; line-height: 1.65; }
.repowiki-graph-empty { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 340px; color: var(--rw-fg-3); font-size: 12px; }

.repowiki-progress { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 36px 24px; }
.repowiki-progress-card { width: 440px; max-width: 88%; padding: 16px 17px; border: 1px solid var(--rw-line); border-radius: 15px; background: color-mix(in srgb, var(--rw-surface) 66%, transparent); box-shadow: var(--rw-shadow); }
.repowiki-progress-bar { height: 6px; border-radius: 999px; background: var(--rw-surface-2); overflow: hidden; }
.repowiki-progress-bar > div { height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--rw-accent) 70%, #fff 30%), var(--rw-accent)); transition: width .3s ease; }
.repowiki-progress-phase { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: var(--rw-fg-2); font-size: 12px; }
.repowiki-spinner { width: 10px; height: 10px; border: 2px solid color-mix(in srgb, var(--rw-accent) 30%, transparent); border-top-color: var(--rw-accent); border-radius: 50%; animation: repowiki-spin .7s linear infinite; }
@keyframes repowiki-spin { to { transform: rotate(360deg); } }

.repowiki-toast { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); padding: 8px 15px; border: 1px solid var(--rw-line); border-radius: 999px; box-shadow: var(--rw-shadow); color: var(--rw-fg); font-size: 12px; white-space: nowrap; z-index: 6; }
.repowiki-help { position: absolute; right: 14px; bottom: 50px; width: 348px; padding: 15px 16px; border: 1px solid var(--rw-line); border-radius: 14px; box-shadow: var(--rw-shadow); color: var(--rw-fg-2); font-size: 12px; line-height: 1.65; z-index: 6; }
.repowiki-help-row { margin-bottom: 8px; }
.repowiki-help-row strong { color: var(--rw-fg); font-weight: 650; }
.repowiki-help-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; color: var(--rw-fg); font-weight: 650; }
.repowiki-help-close { padding: 0; border: 0; background: transparent; color: var(--rw-fg-3); font-size: 13px; cursor: pointer; }
.repowiki-help-close:hover { color: var(--rw-fg); }

.repowiki-copy { height: 20px; padding: 0 7px; border: 1px solid var(--rw-line); border-radius: 5px; background: transparent; color: var(--rw-fg-3); font-size: 10px; cursor: pointer; }
.repowiki-copy:hover { color: var(--rw-fg); background: var(--rw-surface); }

.repowiki-banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 22px 0; padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--rw-accent) 34%, var(--rw-line)); border-radius: 11px; background: color-mix(in srgb, var(--rw-accent) 8%, transparent); color: var(--rw-fg-2); font-size: 11.5px; line-height: 1.55; }
.repowiki-banner.is-warn { border-color: color-mix(in srgb, #e0a34a 45%, var(--rw-line)); background: color-mix(in srgb, #e0a34a 10%, transparent); }
.repowiki-banner .repowiki-btn { height: 25px; margin-left: auto; }

.repowiki-badge-stale { display: inline-flex; align-items: center; gap: 5px; height: 25px; padding: 0 9px; border: 1px solid color-mix(in srgb, #e0a34a 48%, var(--rw-line)); border-radius: 999px; background: color-mix(in srgb, #e0a34a 10%, transparent); color: #d99a3c; font-size: 10.5px; cursor: pointer; }

.repowiki-modal-mask { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 22px; background: rgba(0,0,0,.28); backdrop-filter: blur(2px); }
.repowiki-modal { width: min(430px, 100%); padding: 18px 18px 15px; border: 1px solid var(--rw-line); border-radius: 16px; background: var(--rw-surface); background-color: color-mix(in srgb, var(--rw-surface) 96%, #808080 4%); box-shadow: var(--rw-shadow); }
.repowiki-modal h3 { margin: 0 0 8px; font-size: 14px; color: var(--rw-fg); }
.repowiki-modal p { margin: 0 0 14px; color: var(--rw-fg-2); font-size: 11.5px; line-height: 1.65; }
.repowiki-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

.repowiki-source { position: absolute; z-index: 30; top: 0; right: 0; bottom: 0; width: min(560px, 92%); display: flex; flex-direction: column; border-left: 1px solid var(--rw-line); background: color-mix(in srgb, var(--rw-surface) 94%, #808080 6%); box-shadow: -18px 0 42px rgba(0,0,0,.18); animation: repowiki-slide-in .18s ease; }
@keyframes repowiki-slide-in { from { transform: translateX(24px); opacity: .4; } to { transform: none; opacity: 1; } }
.repowiki-source-head { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--rw-line); }
.repowiki-source-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: var(--rw-fg); }
.repowiki-source-body { flex: 1 1 auto; overflow: auto; padding: 8px 0 24px; }
.repowiki-source-line { display: flex; gap: 12px; padding: 0 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; line-height: 1.72; white-space: pre; }
.repowiki-source-line .ln { flex: 0 0 42px; text-align: right; color: var(--rw-fg-3); user-select: none; opacity: .7; }
.repowiki-source-line .tx { color: var(--rw-fg-2); }
.repowiki-source-line.is-hit { background: color-mix(in srgb, var(--rw-accent) 13%, transparent); }
.repowiki-source-line.is-hit .ln { color: var(--rw-accent); opacity: 1; }
.repowiki-source-line.is-hit .tx { color: var(--rw-fg); }

.repowiki-filter { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--rw-line); border-radius: 8px; background: var(--rw-surface); }
.repowiki-filter button { height: 22px; padding: 0 7px; border: 0; border-radius: 6px; background: transparent; color: var(--rw-fg-3); font-size: 10.5px; cursor: pointer; }
.repowiki-filter button.is-active { color: var(--rw-fg); background: color-mix(in srgb, var(--rw-fg) 10%, transparent); }
.repowiki-search mark { padding: 0 1px; border-radius: 2px; background: color-mix(in srgb, #e0a34a 38%, transparent); color: inherit; }
.repowiki-recent { margin-bottom: 12px; }
.repowiki-recent-list { display: flex; flex-wrap: wrap; gap: 4px; }
.repowiki-recent-list button { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 8px; border: 1px solid var(--rw-line); border-radius: 999px; background: transparent; color: var(--rw-fg-3); font-size: 10.5px; cursor: pointer; }
.repowiki-recent-list button:hover { color: var(--rw-fg); background: var(--rw-surface); }

.repowiki-row { transition: background .12s ease, border-color .12s ease; }
.repowiki-row:hover { background: color-mix(in srgb, var(--rw-fg) 7%, transparent) !important; }
.repowiki-fade { animation: repowiki-fade-in .25s ease; }
[data-bidx] { scroll-margin-top: 62px; }

@media (max-width: 980px) {
  .repowiki-sidebar { width: 236px; flex-basis: 236px; }
  .repowiki-page { padding: 24px 24px 64px; }
  .repowiki-overview, .repowiki-cards, .repowiki-projects { padding: 22px 24px 56px; }
  .repowiki-brand-sub { max-width: 240px; }
}
@media (max-width: 1120px) {
  .repowiki-header { gap: 8px; padding: 8px 12px; }
  .repowiki-brand-repo { max-width: 110px; }
  .repowiki-root-btn { max-width: 148px !important; }
  .repowiki-tab { padding: 0 8px; }
  .repowiki-tab-label { display: none; }
  .repowiki-tab { width: 30px; justify-content: center; }
  .repowiki-brand-sub { max-width: 210px; }
  .repowiki-generate { display: none; }
}
.repowiki-menu-btn { display: none; }
.repowiki-drawer-mask { display: none; }
@media (max-width: 760px) {
  .repowiki-sidebar { display: none; }
  .repowiki-menu-btn { display: inline-flex; }
  .repowiki-drawer-mask { display: block; position: absolute; inset: 0; z-index: 19; background: rgba(0,0,0,.26); }
  .repowiki-sidebar.is-open {
    display: block;
    position: absolute;
    z-index: 20;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(300px, 86%);
    background: color-mix(in srgb, var(--rw-surface) 96%, #808080 4%);
    box-shadow: 18px 0 40px rgba(0,0,0,.22);
  }
  .repowiki-header { padding: 8px 12px; }
  .repowiki-tabs { order: 3; width: 100%; justify-content: stretch; }
  .repowiki-tab { flex: 1 1 0; justify-content: center; }
  .repowiki-actions { width: 100%; justify-content: flex-end; }
  .repowiki-page-title { font-size: 23px; }
  .repowiki-source { width: 100%; }
  .repowiki-toc-rail { display: none; }
}
@media (min-width: 1180px) {
  .repowiki-toc-rail { display: block; position: sticky; top: 18px; flex: 0 0 176px; align-self: flex-start; max-height: calc(100vh - 120px); overflow: auto; padding-left: 14px; border-left: 1px solid var(--rw-line); }
  .repowiki-toc-rail button { display: block; width: 100%; text-align: left; padding: 3px 0; border: 0; background: transparent; color: var(--rw-fg-3); font-size: 11px; line-height: 1.5; cursor: pointer; }
  .repowiki-toc-rail button:hover { color: var(--rw-accent); }
  .repowiki-toc-rail .is-sub { padding-left: 10px; font-size: 10.5px; }
  .repowiki-toc-inline { display: none; }
}
        `
        document.head.appendChild(style)
      } catch {
        // No document? The panel still renders without the animations.
      }
    }

    /** Perceptual tone of a page status, shared by dots and chips. */
