/**
 * Mobilaus UI auditas: ekrano kopijos įvairiuose viewport'uose ir būsenose.
 * Naudojimas: node scripts/ui-mobile-audit.mjs
 * Reikalauja paleisto dev serverio (http://127.0.0.1:5188).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:5188';
const OUT = path.resolve('artifacts/audit');

const VIEWPORTS = [
  { name: 'p390x844', width: 390, height: 844, mobile: true },
  { name: 'p360x740', width: 360, height: 740, mobile: true },
  { name: 'p320x568', width: 320, height: 568, mobile: true },
  { name: 'l844x390', width: 844, height: 390, mobile: true },
  { name: 'l740x360', width: 740, height: 360, mobile: true },
  { name: 'd1280x800', width: 1280, height: 800, mobile: false },
];

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
}

async function trySelectCard(page) {
  // Bando paspausti 3D rankos kortą apačioje — jei pavyksta, atsiranda „Dėti" mygtukas
  const candidates = [
    [0.5, 0.82],
    [0.5, 0.85],
    [0.4, 0.82],
    [0.6, 0.82],
    [0.5, 0.75],
  ];
  for (const [fx, fy] of candidates) {
    await page.mouse.click(fx * page.viewportSize().width, fy * page.viewportSize().height);
    await page.waitForTimeout(250);
    const visible = await page.evaluate(
      () => !document.getElementById('btn-play-card')?.classList.contains('hidden')
    );
    if (visible) return true;
  }
  return false;
}

async function forceHudStates(page) {
  // Atveria visus veiksmų mygtukus, rankos navigaciją ir gynybos juostą (maketo testui)
  await page.evaluate(() => {
    document.getElementById('btn-take')?.classList.remove('hidden');
    document.getElementById('btn-pass')?.classList.remove('hidden');
    const pager = document.getElementById('hand-pager');
    pager?.classList.remove('hidden');
    const ind = document.getElementById('hand-pager-indicator');
    if (ind) ind.textContent = '1-6 iš 12';
    const bar = document.getElementById('defense-target-bar');
    if (bar) {
      bar.classList.remove('hidden');
      bar.innerHTML = `
        <span class="target-bar-label">Pasirinkite ginamą kortą:</span>
        <div class="target-bout-buttons">
          <button class="btn-action btn-target-bout">Atmušti 6♥</button>
          <button class="btn-action btn-target-bout">Atmušti 10♠</button>
          <button class="btn-action btn-target-bout">Atmušti J♦</button>
        </div>`;
    }
  });
}

async function resetHudStates(page) {
  await page.evaluate(() => {
    document.getElementById('btn-take')?.classList.add('hidden');
    document.getElementById('btn-pass')?.classList.add('hidden');
    document.getElementById('hand-pager')?.classList.add('hidden');
    const bar = document.getElementById('defense-target-bar');
    bar?.classList.add('hidden');
    bar && (bar.innerHTML = '');
  });
}

const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(BASE);
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10, null, { timeout: 30000 });
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setReducedMotion(true));

  // 1. Pradinė būsena (ataka)
  await shot(page, `${vp.name}-01-start.png`);

  // 2. Pasirinkta korta + visi veiksmų mygtukai
  const selected = await trySelectCard(page);
  await forceHudStates(page);
  await page.waitForTimeout(300);
  await shot(page, `${vp.name}-02-actions${selected ? '' : '-nocard'}.png`);
  await resetHudStates(page);

  // 3. Online lobby (meniu rodinys)
  await page.evaluate(() => document.getElementById('btn-online')?.click());
  await page.waitForTimeout(200);
  await shot(page, `${vp.name}-03-lobby.png`);
  await page.keyboard.press('Escape');

  // 4. Setup vedlys
  await page.evaluate((mobile) => {
    if (mobile) document.getElementById('btn-mobile-menu')?.click();
    document.getElementById(mobile ? 'drawer-btn-setup' : 'btn-setup')?.click();
  }, vp.mobile);
  await page.waitForTimeout(300);
  await shot(page, `${vp.name}-04-setup.png`);
  await page.keyboard.press('Escape');

  // 5. Taisyklės + Lyderių lenta
  await page.evaluate((mobile) => {
    if (mobile) {
      document.getElementById('btn-mobile-menu')?.click();
      document.getElementById('drawer-btn-rules')?.click();
    } else {
      document.getElementById('btn-rules')?.click();
    }
  }, vp.mobile);
  await page.waitForTimeout(200);
  await shot(page, `${vp.name}-05-rules.png`);
  await page.keyboard.press('Escape');

  await page.evaluate((mobile) => {
    if (mobile) {
      document.getElementById('btn-mobile-menu')?.click();
      document.getElementById('drawer-btn-leaderboard')?.click();
    } else {
      document.getElementById('btn-leaderboard')?.click();
    }
  }, vp.mobile);
  await page.waitForTimeout(200);
  await shot(page, `${vp.name}-06-leaderboard.png`);
  await page.keyboard.press('Escape');

  // 6. Žaidimo pabaiga + „Rodyti rezultatus" piliulė
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('complete'));
  await page.waitForTimeout(400);
  await shot(page, `${vp.name}-07-gameover.png`);
  await page.evaluate(() => document.getElementById('btn-gameover-inspect')?.click());
  await page.waitForTimeout(200);
  await shot(page, `${vp.name}-08-pill.png`);

  if (errors.length) {
    console.log(`[${vp.name}] JS klaidos:`, errors.slice(0, 5));
  }
  await context.close();
}

await browser.close();
console.log('Audito kopijos:', OUT);
