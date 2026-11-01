/* ---- 30-styles.js ----
 * The stylesheet injected once into the panel.
 * This file is concatenated into ../../client.js by scripts/build-client.mjs.
 */
    /** One-off keyframes (shimmer, fade) the inline styles cannot express. */
    function injectPanelStyles() {
      try {
        if (document.getElementById('codemap-panel-styles')) return
        const style = document.createElement('style')
        style.id = 'codemap-panel-styles'
        style.textContent = `
@keyframes codemap-shimmer { 0% { background-position: -220px 0; } 100% { background-position: 220px 0; } }
@keyframes codemap-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes codemap-pulse { 0%, 100% { opacity: .45; } 50% { opacity: 1; } }

.codemap-shell {
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
.codemap-shell *, .codemap-shell *::before, .codemap-shell *::after { box-sizing: border-box; }
.codemap-shell button, .codemap-shell input { font: inherit; }
.codemap-shell button { -webkit-tap-highlight-color: transparent; }
.codemap-shell button:focus-visible, .codemap-shell input:focus-visible, .codemap-shell [tabindex]:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--rw-accent) 72%, transparent);
  outline-offset: 2px;
}
.codemap-shell ::selection { background: color-mix(in srgb, var(--rw-accent) 28%, transparent); }
.codemap-shell ::-webkit-scrollbar { width: 9px; height: 9px; }
.codemap-shell ::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--rw-fg-3) 28%, transparent); border: 3px solid transparent; border-radius: 999px; background-clip: padding-box; }
.codemap-shell ::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--rw-fg-3) 46%, transparent); border: 3px solid transparent; background-clip: padding-box; }
.codemap-shell ::-webkit-scrollbar-track { background: transparent; }

.codemap-header {
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
  /* The popover menus hang out of the header. backdrop-filter already makes
     the header a stacking context, but without a z-index the content column
     (position: relative) paints over it, so page text showed through the menu.
     Lifting the header above the content column fixes that ordering. */
  position: relative;
  z-index: 20;
}
.codemap-brand {
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
.codemap-brand-mark {
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
.codemap-brand-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.codemap-brand-line { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
.codemap-brand-title { font-size: 13px; font-weight: 650; letter-spacing: -.01em; white-space: nowrap; }
.codemap-brand-slash { color: var(--rw-fg-3); font-size: 11px; }
.codemap-brand-repo { font-size: 13px; font-weight: 600; color: var(--rw-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
.codemap-brand-sub { font-size: 10.5px; color: var(--rw-fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px; font-variant-numeric: tabular-nums; }
.codemap-run-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; }

.codemap-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--rw-line);
  background: color-mix(in srgb, var(--rw-surface) 80%, transparent);
}
.codemap-tab {
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
.codemap-tab:hover { color: var(--rw-fg); background: color-mix(in srgb, var(--rw-fg) 7%, transparent); }
.codemap-tab.is-active {
  color: var(--rw-fg);
  background: color-mix(in srgb, var(--rw-fg) 10%, transparent);
  box-shadow: inset 0 0 0 1px var(--rw-line), 0 1px 2px rgba(0,0,0,.06);
}
.codemap-tab svg { opacity: .8; }
.codemap-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }

.codemap-btn {
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
.codemap-btn:hover:not(:disabled) {
  color: var(--rw-fg);
  background: var(--rw-surface);
  border-color: color-mix(in srgb, var(--rw-fg) 18%, var(--rw-line));
}
.codemap-btn:active:not(:disabled) { transform: translateY(1px); }
.codemap-btn.is-primary {
  color: #fff;
  border-color: color-mix(in srgb, var(--rw-accent) 72%, #000 12%);
  background: linear-gradient(180deg, color-mix(in srgb, var(--rw-accent) 92%, #fff 8%), var(--rw-accent));
  box-shadow: 0 6px 16px color-mix(in srgb, var(--rw-accent) 22%, transparent), inset 0 1px 0 rgba(255,255,255,.22);
}
.codemap-btn.is-primary:hover:not(:disabled) { color: #fff; filter: brightness(1.04); background: linear-gradient(180deg, color-mix(in srgb, var(--rw-accent) 92%, #fff 8%), var(--rw-accent)); }
.codemap-btn.is-active { color: var(--rw-fg); background: var(--rw-accent-soft); border-color: var(--rw-accent-line); }
.codemap-btn.is-icon { width: 30px; padding: 0; }
.codemap-btn:disabled { opacity: .5; cursor: default; }

.codemap-segment { display: inline-flex; align-items: center; gap: 2px; padding: 3px; border: 1px solid var(--rw-line); border-radius: 9px; background: color-mix(in srgb, var(--rw-surface) 80%, transparent); }
.codemap-segment button { height: 23px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: var(--rw-fg-3); font-size: 11px; cursor: pointer; }
.codemap-segment button:hover { color: var(--rw-fg); }
.codemap-segment button.is-active { color: var(--rw-fg); background: color-mix(in srgb, var(--rw-fg) 10%, transparent); }
.codemap-segment button:disabled { opacity: .38; cursor: default; }

.codemap-chip, .codemap-status {
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
.codemap-status { background: transparent; }

.codemap-sidebar {
  width: 272px;
  flex: 0 0 272px;
  padding: 14px 12px 20px;
  border-right: 1px solid var(--rw-line);
  overflow-y: auto;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--rw-surface) 48%, transparent));
}
.codemap-search { position: relative; display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.codemap-search-field { position: relative; flex: 1 1 auto; min-width: 0; }
.codemap-search-field input {
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
.codemap-search-field input::placeholder { color: var(--rw-fg-3); }
.codemap-search-field input:focus { border-color: var(--rw-accent-line); box-shadow: 0 0 0 3px var(--rw-accent-soft); background: color-mix(in srgb, var(--rw-surface) 65%, transparent); }
.codemap-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--rw-fg-3); pointer-events: none; }
.codemap-search-clear { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--rw-fg-3); cursor: pointer; }
.codemap-search-clear:hover { color: var(--rw-fg); background: var(--rw-surface-2); }
.codemap-sidebar-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 2px 2px 10px; }
.codemap-eyebrow { font-size: 9.5px; font-weight: 650; letter-spacing: .14em; text-transform: uppercase; color: var(--rw-fg-3); }
.codemap-section-label {
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
.codemap-section-label:hover { color: var(--rw-fg-2); }
.codemap-section-count { margin-left: auto; padding: 0 6px; border-radius: 999px; background: var(--rw-surface); color: var(--rw-fg-3); font-size: 9.5px; line-height: 15px; letter-spacing: 0; }
.codemap-tree-row { transition: background .12s ease, color .12s ease, box-shadow .12s ease; }
.codemap-tree-row:hover { background: color-mix(in srgb, var(--rw-fg) 7%, transparent) !important; }
.codemap-tree-row.is-active { box-shadow: inset 2px 0 0 var(--rw-accent); }
.codemap-tree-row.is-active:hover { background: var(--rw-accent-soft) !important; }

.codemap-main { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.codemap-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.codemap-page { width: 100%; max-width: 900px; margin: 0 auto; padding: 30px 34px 76px; }
.codemap-overview { width: 100%; max-width: 1060px; margin: 0 auto; padding: 26px 30px 64px; }
.codemap-cards, .codemap-projects { width: 100%; max-width: 1020px; margin: 0 auto; padding: 26px 30px 64px; }
.codemap-page-title { margin: 6px 0 10px; font-size: 27px; line-height: 1.25; font-weight: 650; letter-spacing: -.025em; color: var(--rw-fg); }
.codemap-page-goal { max-width: 70ch; margin: 0 0 16px; color: var(--rw-fg-2); font-size: 13px; line-height: 1.75; }
.codemap-page-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.codemap-back { display: inline-flex; align-items: center; gap: 5px; padding: 0; border: 0; background: transparent; color: var(--rw-fg-3); font-size: 11px; cursor: pointer; }
.codemap-back:hover { color: var(--rw-fg); }
.codemap-path { max-width: 58%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 8px; border-radius: 999px; background: var(--rw-surface); color: var(--rw-fg-3); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
.codemap-breadcrumb { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; font-size: 11px; color: var(--rw-fg-3); }
.codemap-breadcrumb button { padding: 0; border: 0; background: transparent; color: var(--rw-accent); font-size: 11px; cursor: pointer; }
.codemap-breadcrumb button:hover { text-decoration: underline; }
.codemap-toc { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 0 0 20px; padding: 9px 12px; border: 1px solid var(--rw-line); border-radius: 11px; background: color-mix(in srgb, var(--rw-surface) 92%, #808080 8%); backdrop-filter: blur(12px); box-shadow: 0 6px 18px rgba(0,0,0,.06); }
.codemap-toc button { padding: 1px 5px; border: 0; border-radius: 5px; background: transparent; color: var(--rw-fg-2); font-size: 11px; cursor: pointer; }
.codemap-toc button:hover { color: var(--rw-fg); background: var(--rw-surface-2); }

.codemap-stat {
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
.codemap-stat-label { margin-bottom: 5px; color: var(--rw-fg-3); font-size: 10.5px; letter-spacing: .04em; }
.codemap-stat-value { color: var(--rw-fg); font-size: 23px; font-weight: 650; line-height: 1.05; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.codemap-stat-sub { color: var(--rw-fg-3); font-size: 10.5px; }

.codemap-empty { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px 24px; text-align: center; }
.codemap-empty-mark { width: 58px; height: 58px; display: grid; place-items: center; margin-bottom: 4px; border-radius: 18px; border: 1px solid var(--rw-line); background: linear-gradient(145deg, var(--rw-accent-soft), var(--rw-surface)); color: var(--rw-accent); box-shadow: var(--rw-shadow); }
.codemap-empty-title { font-size: 17px; font-weight: 650; letter-spacing: -.02em; }
.codemap-empty-copy { max-width: 420px; margin: 0 0 8px; color: var(--rw-fg-3); font-size: 12px; line-height: 1.7; }

.codemap-loading { flex: 1 1 auto; width: 100%; max-width: 760px; margin: 0 auto; padding: 30px 34px; }
.codemap-skeleton { border-radius: 7px; background: linear-gradient(90deg, var(--rw-surface) 25%, var(--rw-surface-2) 50%, var(--rw-surface) 75%); background-size: 440px 100%; animation: codemap-shimmer 1.4s ease-in-out infinite; }

.codemap-error { max-width: 620px; margin: 28px auto; padding: 20px; border: 1px solid color-mix(in srgb, #e06c6c 38%, transparent); border-radius: 14px; background: color-mix(in srgb, #e06c6c 7%, transparent); }
.codemap-error-title { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; font-weight: 650; }
.codemap-error-body { color: var(--rw-fg-2); font-size: 12px; line-height: 1.7; }
.codemap-error-hint { margin-top: 8px; color: var(--rw-fg-3); font-size: 11.5px; line-height: 1.65; }

.codemap-graph { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: 18px 20px 20px; }
.codemap-graph-toolbar { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.codemap-graph-heading { min-width: 0; }
.codemap-graph-heading h2 { margin: 3px 0 2px; color: var(--rw-fg); font-size: 19px; font-weight: 650; letter-spacing: -.02em; }
.codemap-graph-sub { color: var(--rw-fg-3); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.codemap-graph-tools { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; }
.codemap-graph-search { position: relative; }
.codemap-graph-search input { width: 172px; height: 30px; padding: 0 10px 0 28px; border: 1px solid var(--rw-line); border-radius: 9px; background: color-mix(in srgb, var(--rw-surface) 84%, transparent); color: var(--rw-fg); font-size: 11.5px; outline: none; }
.codemap-graph-search input::placeholder { color: var(--rw-fg-3); }
.codemap-graph-search input:focus { border-color: var(--rw-accent-line); box-shadow: 0 0 0 3px var(--rw-accent-soft); }
.codemap-graph-search svg { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--rw-fg-3); pointer-events: none; }
.codemap-graph-canvas {
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
.codemap-graph-canvas::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--rw-fg-3) 26%, transparent) 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: .42;
  mask-image: linear-gradient(180deg, #000 0%, rgba(0,0,0,.35) 72%, transparent 100%);
}
.codemap-graph-canvas > svg { position: absolute; inset: 0; z-index: 1; display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; user-select: none; }
.codemap-graph-canvas.is-dragging { border-color: var(--rw-accent-line); }
.codemap-graph-canvas.is-dragging > svg { cursor: grabbing; }
.codemap-graph-node .codemap-node-box { fill: color-mix(in srgb, var(--rw-fg) 5%, transparent); stroke: color-mix(in srgb, var(--rw-fg) 16%, transparent); stroke-width: 1; transition: fill .16s ease, stroke .16s ease, filter .16s ease; }
.codemap-graph-node:hover .codemap-node-box { stroke: var(--rw-accent-line); filter: drop-shadow(0 8px 16px rgba(0,0,0,.16)); }
.codemap-graph-node:focus-visible { outline: none; }
.codemap-graph-node:focus-visible .codemap-node-box { stroke: var(--rw-accent); stroke-width: 2; }
.codemap-graph-node.is-selected .codemap-node-box { fill: var(--rw-accent-soft); stroke: var(--rw-accent); stroke-width: 1.6; }
.codemap-graph-node.is-dimmed { opacity: .17; }
.codemap-node-title { fill: var(--rw-fg); font-size: 12px; font-weight: 600; letter-spacing: .005em; }
.codemap-node-meta { fill: var(--rw-fg-3); font-size: 10px; }
.codemap-graph-edge { fill: none; stroke: color-mix(in srgb, var(--rw-fg) 22%, transparent); stroke-width: 1.05; opacity: .9; transition: stroke .16s ease, opacity .16s ease; }
.codemap-graph-edge.is-active { stroke: var(--rw-accent); stroke-width: 1.8; opacity: 1; }
.codemap-graph-edge.is-dimmed { opacity: .1; }
.codemap-graph-guide { stroke: var(--rw-line); stroke-width: 1; stroke-dasharray: 2 7; opacity: .55; }
.codemap-graph-layer { fill: var(--rw-fg-3); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; opacity: .62; }
.codemap-graph-watermark { position: absolute; z-index: 0; left: 18px; bottom: 16px; color: var(--rw-fg); font-size: 36px; font-weight: 700; letter-spacing: .16em; opacity: .035; pointer-events: none; user-select: none; white-space: nowrap; }
.codemap-graph-hint { position: absolute; z-index: 2; left: 14px; top: 13px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border: 1px solid var(--rw-line); border-radius: 999px; background: color-mix(in srgb, var(--rw-surface) 75%, transparent); backdrop-filter: blur(10px); color: var(--rw-fg-3); font-size: 10px; pointer-events: none; }
.codemap-graph-legend { position: absolute; z-index: 2; right: 14px; bottom: 13px; display: flex; align-items: center; gap: 11px; padding: 6px 10px; border: 1px solid var(--rw-line); border-radius: 999px; background: color-mix(in srgb, var(--rw-surface) 75%, transparent); backdrop-filter: blur(10px); color: var(--rw-fg-3); font-size: 10px; pointer-events: none; }
.codemap-graph-tip { position: absolute; z-index: 2; left: 14px; bottom: 15px; color: var(--rw-fg-3); font-size: 10px; pointer-events: none; }
.codemap-legend-dot { display: inline-block; width: 6px; height: 6px; margin-right: 4px; border-radius: 2px; vertical-align: 1px; }
.codemap-graph-inspector {
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
  animation: codemap-fade-in .2s ease;
}
.codemap-graph-inspector-head { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 8px; }
.codemap-graph-inspector-title { font-size: 13px; font-weight: 650; color: var(--rw-fg); }
.codemap-graph-inspector-path { margin-top: 7px; color: var(--rw-fg-3); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; }
.codemap-graph-inspector-copy { margin-top: 7px; color: var(--rw-fg-3); font-size: 11px; line-height: 1.65; }
.codemap-graph-empty { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 340px; color: var(--rw-fg-3); font-size: 12px; }

.codemap-progress { flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 36px 24px; }
.codemap-progress-card { width: 440px; max-width: 88%; padding: 16px 17px; border: 1px solid var(--rw-line); border-radius: 15px; background: color-mix(in srgb, var(--rw-surface) 66%, transparent); box-shadow: var(--rw-shadow); }
.codemap-progress-bar { height: 6px; border-radius: 999px; background: var(--rw-surface-2); overflow: hidden; }
.codemap-progress-bar > div { height: 100%; border-radius: inherit; background: linear-gradient(90deg, color-mix(in srgb, var(--rw-accent) 70%, #fff 30%), var(--rw-accent)); transition: width .3s ease; }
.codemap-progress-phase { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: var(--rw-fg-2); font-size: 12px; }
.codemap-spinner { width: 10px; height: 10px; border: 2px solid color-mix(in srgb, var(--rw-accent) 30%, transparent); border-top-color: var(--rw-accent); border-radius: 50%; animation: codemap-spin .7s linear infinite; }
@keyframes codemap-spin { to { transform: rotate(360deg); } }

.codemap-toast { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); padding: 8px 15px; border: 1px solid var(--rw-line); border-radius: 999px; box-shadow: var(--rw-shadow); color: var(--rw-fg); font-size: 12px; white-space: nowrap; z-index: 6; }
.codemap-help { position: absolute; right: 14px; bottom: 50px; width: 348px; padding: 15px 16px; border: 1px solid var(--rw-line); border-radius: 14px; box-shadow: var(--rw-shadow); color: var(--rw-fg-2); font-size: 12px; line-height: 1.65; z-index: 6; }
.codemap-help-row { margin-bottom: 8px; }
.codemap-help-row strong { color: var(--rw-fg); font-weight: 650; }
.codemap-help-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; color: var(--rw-fg); font-weight: 650; }
.codemap-help-close { padding: 0; border: 0; background: transparent; color: var(--rw-fg-3); font-size: 13px; cursor: pointer; }
.codemap-help-close:hover { color: var(--rw-fg); }

.codemap-copy { height: 20px; padding: 0 7px; border: 1px solid var(--rw-line); border-radius: 5px; background: transparent; color: var(--rw-fg-3); font-size: 10px; cursor: pointer; }
.codemap-copy:hover { color: var(--rw-fg); background: var(--rw-surface); }

.codemap-banner { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 12px 22px 0; padding: 9px 12px; border: 1px solid color-mix(in srgb, var(--rw-accent) 34%, var(--rw-line)); border-radius: 11px; background: color-mix(in srgb, var(--rw-accent) 8%, transparent); color: var(--rw-fg-2); font-size: 11.5px; line-height: 1.55; }
.codemap-banner.is-warn { border-color: color-mix(in srgb, #e0a34a 45%, var(--rw-line)); background: color-mix(in srgb, #e0a34a 10%, transparent); }
.codemap-banner .codemap-btn { height: 25px; margin-left: auto; }

.codemap-badge-stale { display: inline-flex; align-items: center; gap: 5px; height: 25px; padding: 0 9px; border: 1px solid color-mix(in srgb, #e0a34a 48%, var(--rw-line)); border-radius: 999px; background: color-mix(in srgb, #e0a34a 10%, transparent); color: #d99a3c; font-size: 10.5px; cursor: pointer; }

.codemap-modal-mask { position: absolute; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 22px; background: rgba(0,0,0,.28); backdrop-filter: blur(2px); }
.codemap-modal { width: min(430px, 100%); padding: 18px 18px 15px; border: 1px solid var(--rw-line); border-radius: 16px; background: var(--rw-surface); background-color: color-mix(in srgb, var(--rw-surface) 96%, #808080 4%); box-shadow: var(--rw-shadow); }
.codemap-modal h3 { margin: 0 0 8px; font-size: 14px; color: var(--rw-fg); }
.codemap-modal p { margin: 0 0 14px; color: var(--rw-fg-2); font-size: 11.5px; line-height: 1.65; }
.codemap-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

.codemap-source { position: absolute; z-index: 30; top: 0; right: 0; bottom: 0; width: min(560px, 92%); display: flex; flex-direction: column; border-left: 1px solid var(--rw-line); background: color-mix(in srgb, var(--rw-surface) 94%, #808080 6%); box-shadow: -18px 0 42px rgba(0,0,0,.18); animation: codemap-slide-in .18s ease; }
@keyframes codemap-slide-in { from { transform: translateX(24px); opacity: .4; } to { transform: none; opacity: 1; } }
.codemap-source-head { display: flex; align-items: center; gap: 8px; padding: 11px 14px; border-bottom: 1px solid var(--rw-line); }
.codemap-source-path { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; color: var(--rw-fg); }
.codemap-source-body { flex: 1 1 auto; overflow: auto; padding: 8px 0 24px; }
.codemap-source-line { display: flex; gap: 12px; padding: 0 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; line-height: 1.72; white-space: pre; }
.codemap-source-line .ln { flex: 0 0 42px; text-align: right; color: var(--rw-fg-3); user-select: none; opacity: .7; }
.codemap-source-line .tx { color: var(--rw-fg-2); }
.codemap-source-line.is-hit { background: color-mix(in srgb, var(--rw-accent) 13%, transparent); }
.codemap-source-line.is-hit .ln { color: var(--rw-accent); opacity: 1; }
.codemap-source-line.is-hit .tx { color: var(--rw-fg); }

.codemap-filter { display: inline-flex; gap: 2px; padding: 2px; border: 1px solid var(--rw-line); border-radius: 8px; background: var(--rw-surface); }
.codemap-filter button { height: 22px; padding: 0 7px; border: 0; border-radius: 6px; background: transparent; color: var(--rw-fg-3); font-size: 10.5px; cursor: pointer; }
.codemap-filter button.is-active { color: var(--rw-fg); background: color-mix(in srgb, var(--rw-fg) 10%, transparent); }
.codemap-search mark { padding: 0 1px; border-radius: 2px; background: color-mix(in srgb, #e0a34a 38%, transparent); color: inherit; }
.codemap-recent { margin-bottom: 12px; }
.codemap-recent-list { display: flex; flex-wrap: wrap; gap: 4px; }
.codemap-recent-list button { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 8px; border: 1px solid var(--rw-line); border-radius: 999px; background: transparent; color: var(--rw-fg-3); font-size: 10.5px; cursor: pointer; }
.codemap-recent-list button:hover { color: var(--rw-fg); background: var(--rw-surface); }

.codemap-row { transition: background .12s ease, border-color .12s ease; }
.codemap-row:hover { background: color-mix(in srgb, var(--rw-fg) 7%, transparent) !important; }
.codemap-fade { animation: codemap-fade-in .25s ease; }
[data-bidx] { scroll-margin-top: 62px; }

@media (max-width: 980px) {
  .codemap-sidebar { width: 236px; flex-basis: 236px; }
  .codemap-page { padding: 24px 24px 64px; }
  .codemap-overview, .codemap-cards, .codemap-projects { padding: 22px 24px 56px; }
  .codemap-brand-sub { max-width: 240px; }
}
@media (max-width: 1120px) {
  .codemap-header { gap: 8px; padding: 8px 12px; }
  .codemap-brand-repo { max-width: 110px; }
  .codemap-root-btn { max-width: 148px !important; }
  .codemap-tab { padding: 0 8px; }
  .codemap-tab-label { display: none; }
  .codemap-tab { width: 30px; justify-content: center; }
  .codemap-brand-sub { max-width: 210px; }
  .codemap-generate { display: none; }
}
.codemap-menu-btn { display: none; }
.codemap-drawer-mask { display: none; }
@media (max-width: 760px) {
  .codemap-sidebar { display: none; }
  .codemap-menu-btn { display: inline-flex; }
  .codemap-drawer-mask { display: block; position: absolute; inset: 0; z-index: 19; background: rgba(0,0,0,.26); }
  .codemap-sidebar.is-open {
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
  .codemap-header { padding: 8px 12px; }
  .codemap-tabs { order: 3; width: 100%; justify-content: stretch; }
  .codemap-tab { flex: 1 1 0; justify-content: center; }
  .codemap-actions { width: 100%; justify-content: flex-end; }
  .codemap-page-title { font-size: 23px; }
  .codemap-source { width: 100%; }
  .codemap-toc-rail { display: none; }
}
@media (min-width: 1180px) {
  .codemap-toc-rail { display: block; position: sticky; top: 18px; flex: 0 0 176px; align-self: flex-start; max-height: calc(100vh - 120px); overflow: auto; padding-left: 14px; border-left: 1px solid var(--rw-line); }
  .codemap-toc-rail button { display: block; width: 100%; text-align: left; padding: 3px 0; border: 0; background: transparent; color: var(--rw-fg-3); font-size: 11px; line-height: 1.5; cursor: pointer; }
  .codemap-toc-rail button:hover { color: var(--rw-accent); }
  .codemap-toc-rail .is-sub { padding-left: 10px; font-size: 10.5px; }
  .codemap-toc-inline { display: none; }
}
        `
        document.head.appendChild(style)
      } catch {
        // No document? The panel still renders without the animations.
      }
    }

    /** Perceptual tone of a page status, shared by dots and chips. */
