/**
 * Browser regression for the CodeMap panel.
 *
 * Unlike `local-e2e.mjs` (host pipeline) and `client-graph.mjs` (host probes),
 * this test drives a real DSH Web instance with Playwright. It is opt-in: it
 * skips with exit code 0 when no URL is given or Playwright is not installed,
 * so the zero-dependency install path is unaffected.
 *
 * Usage:
 *   DSH_WEB_URL="http://127.0.0.1:3081/?token=..." node test/ui-e2e.mjs
 *
 * It covers the regressions that motivated v0.11:
 *   - the panel renders without a page error
 *   - a citation opens the source drawer and Escape closes it
 *   - the graph pans with the left button
 *   - a graph node exposes the related wiki page
 *   - the import dialog opens and cancels
 *   - switching to a missing language explains itself
 *   - the narrow viewport exposes the page-tree drawer
 */
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const url = process.argv[2] || process.env.DSH_WEB_URL || ''
if (!url) {
  console.log('ui-e2e: skipped (set DSH_WEB_URL to run the browser regression)')
  process.exit(0)
}

let chromium
const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)
for (const candidate of candidates) {
  try {
    const specifier = candidate.includes('\\') || /^[A-Za-z]:\//.test(candidate)
      ? pathToFileURL(candidate).href
      : candidate
    const imported = await import(specifier)
    chromium = imported.chromium || imported.default?.chromium
    break
  } catch {
    // Try the next location.
  }
}
if (!chromium) {
  console.log('ui-e2e: skipped (playwright is not installed; set PLAYWRIGHT_MODULE to its index.js)')
  process.exit(0)
}

const here = dirname(fileURLToPath(import.meta.url))
const artifacts = join(here, 'artifacts')
await mkdir(artifacts, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`)
})

const checks = []
const check = (name, condition, detail = '') => {
  checks.push({ name, ok: Boolean(condition), detail })
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const cont = page.getByRole('button', { name: '继续' })
  if (await cont.count()) await cont.first().click().catch(() => {})
  await page.getByText('代码地图', { exact: true }).first().click()
  await page.waitForTimeout(1400)

  check('the panel shell renders', (await page.locator('.codemap-shell').count()) === 1)
  check('the header keeps its brand', (await page.locator('.codemap-brand').count()) === 1)
  const cacheKeys = await page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith('codemap:panel:')))
  check('the panel payload is cached for instant re-entry', cacheKeys.length > 0, cacheKeys.join(','))
  await page.screenshot({ path: join(artifacts, 'ui-overview.png') })

  const treeRows = page.locator('aside .codemap-tree-row')
  check('the page tree lists pages', (await treeRows.count()) > 0, `${await treeRows.count()} rows`)
  if (await treeRows.count()) {
    await treeRows.nth(1).click()
    await page.waitForTimeout(800)
  }
  check('a page opens', (await page.locator('.codemap-page').count()) === 1)
  check('the duplicated H1 is removed', (await page.locator('.codemap-page h1').count()) === 1)

  const citation = page.locator('.codemap-page code').filter({ hasText: /:\d/ }).first()
  if (await citation.count()) {
    await citation.click()
    await page.waitForTimeout(900)
    check('a citation opens the source drawer', (await page.locator('.codemap-source').count()) === 1)
    check('the source drawer highlights a line', (await page.locator('.codemap-source-line.is-hit').count()) === 1)
    await page.screenshot({ path: join(artifacts, 'ui-source.png') })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    check('Escape closes the source drawer', (await page.locator('.codemap-source').count()) === 0)
  } else {
    check('the page has a citation', false, 'no path:line chip found')
  }

  await page.getByRole('button', { name: /^图谱$/ }).first().click()
  await page.waitForTimeout(1200)
  const svg = page.locator('svg[role="group"]').last()
  const before = await svg.getAttribute('viewBox')
  const box = await svg.boundingBox()
  if (box) {
    const x = box.x + box.width * 0.55
    const y = box.y + box.height * 0.5
    await page.mouse.move(x, y)
    await page.mouse.down({ button: 'left' })
    await page.mouse.move(x + 140, y + 70, { steps: 12 })
    await page.mouse.up({ button: 'left' })
    await page.waitForTimeout(400)
  }
  const after = await svg.getAttribute('viewBox')
  check('the graph pans with the left button', before !== after, `${before} -> ${after}`)

  // Pick a module node that actually owns files: the root module (`mod:`) has
  // no directory, so it legitimately has no related page.
  const allNodes = page.locator('g[data-graph-node]')
  const nodeCount = await allNodes.count()
  let node = allNodes.first()
  for (let index = 0; index < nodeCount; index += 1) {
    const id = await allNodes.nth(index).getAttribute('data-graph-node')
    if (id && id !== 'mod:') {
      node = allNodes.nth(index)
      break
    }
  }
  if (await node.count()) {
    await node.click()
    await page.waitForTimeout(600)
    check('a node opens the inspector', (await page.locator('.codemap-graph-inspector').count()) === 1)
    const wikiLink = page.getByRole('button', { name: '打开相关 Wiki' })
    check('the inspector links to the related wiki page', (await wikiLink.count()) > 0)
    await page.screenshot({ path: join(artifacts, 'ui-graph.png') })
  }

  await page.locator('.codemap-btn[aria-label="更多"]').click()
  await page.waitForTimeout(250)
  check('the more menu offers imports and a full regenerate', (await page.getByRole('menuitem').count()) >= 3)
  await page.getByRole('menuitem').first().click()
  await page.waitForTimeout(250)
  check('import asks for confirmation', (await page.locator('.codemap-modal').count()) === 1)
  await page.getByRole('button', { name: '取消' }).click()

  await page.getByRole('button', { name: 'en', exact: true }).click()
  await page.waitForTimeout(900)
  check('a missing translation explains itself', (await page.locator('.codemap-banner').count()) === 1)
  await page.getByRole('button', { name: 'zh', exact: true }).click()
  await page.waitForTimeout(700)

  await page.setViewportSize({ width: 720, height: 900 })
  await page.waitForTimeout(400)
  const menu = page.locator('.codemap-menu-btn')
  check('the narrow layout exposes the drawer toggle', await menu.isVisible().catch(() => false))
  if (await menu.isVisible().catch(() => false)) {
    await menu.click()
    await page.waitForTimeout(300)
    check('the page-tree drawer opens', (await page.locator('.codemap-sidebar.is-open').count()) === 1)
    await page.screenshot({ path: join(artifacts, 'ui-mobile.png') })
  }

  check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

let failed = 0
for (const entry of checks) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'}  ${entry.name}${entry.detail ? ` (${entry.detail})` : ''}`)
  if (!entry.ok) failed += 1
}
console.log(failed === 0 ? `\nAll ${checks.length} UI checks passed.` : `\n${failed} UI check(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
