/**
 * Koordinatinis UI auditas: matuoja visų HUD elementų bounding box
 * ir tikrina nukarpymus bei tarpusavyje susikirtimus.
 */
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:5188';

const VIEWPORTS = [
  { name: 'p390x844', width: 390, height: 844, mobile: true },
  { name: 'p360x740', width: 360, height: 740, mobile: true },
  { name: 'p320x568', width: 320, height: 568, mobile: true },
  { name: 'l844x390', width: 844, height: 390, mobile: true },
  { name: 'l740x360', width: 740, height: 360, mobile: true },
  { name: 'd1280x800', width: 1280, height: 800, mobile: false },
];

const MEASURE = () => {
  const pick = (sel) => Array.from(document.querySelectorAll(sel)).filter((el) => el.offsetParent !== null);
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom, tag: el.id || el.className.split(' ')[0] };
  };
  const groups = {
    header: pick('#game-header .brand-cluster, #game-header .hud-crest, #game-header .btn-icon'),
    referee: pick('#referee-bar .phase-banner, #referee-bar .opp-badge, #referee-bar #status-line'),
    bottom: pick('#bottom-zone > *, #bottom-zone .btn-action, #bottom-zone .btn-pager, #bottom-zone .btn-target-bout'),
    pill: pick('.floating-pill'),
    modal: pick('.modal-overlay:not(.hidden) .modal-card'),
  };
  const out = {};
  for (const [g, els] of Object.entries(groups)) out[g] = els.map(box);
  return out;
};

const overlapArea = (a, b) => {
  const w = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
  const h = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
  return w > 0 && h > 0 ? w * h : 0;
};

function checkView(vw, vh, groups, label, issues) {
  const all = Object.values(groups).flat();
  for (const b of all) {
    if (b.x1 < -1 || b.y1 < -1 || b.x2 > vw + 1 || b.y2 > vh + 1) {
      issues.push(`[${label}] NUKARPYTAS: ${b.tag} (${Math.round(b.x1)},${Math.round(b.y1)})-(${Math.round(b.x2)},${Math.round(b.y2)}) vp=${vw}x${vh}`);
    }
  }
  // Susikirtimai tarp skirtingų grupių ir tarp tos pačios grupės elementų
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      // praleidžiam įdedamuosius elementus (mygtukas footer viduje ir pan.)
      if (b.x1 >= a.x1 && b.x2 <= a.x2 && b.y1 >= a.y1 && b.y2 <= a.y2) continue;
      if (a.x1 >= b.x1 && a.x2 <= b.x2 && a.y1 >= b.y1 && a.y2 <= b.y2) continue;
      const ov = overlapArea(a, b);
      if (ov > 4) {
        issues.push(`[${label}] SUSIKERTA: ${a.tag} ∩ ${b.tag} = ${Math.round(ov)}px²`);
      }
    }
  }
}

const browser = await chromium.launch();
let issues = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 10, null, { timeout: 30000 });

  // Būsena A: start
  let g = await page.evaluate(MEASURE);
  checkView(vp.width, vp.height, g, `${vp.name}/start`, issues);

  // Būsena B: visi veiksmai + pager + gynybos juosta
  await page.evaluate(() => {
    document.getElementById('btn-take')?.classList.remove('hidden');
    document.getElementById('btn-pass')?.classList.remove('hidden');
    document.getElementById('btn-play-card')?.classList.remove('hidden');
    document.getElementById('btn-play-card').textContent = '🛡️ Atmušti 10♥';
    document.getElementById('hand-pager')?.classList.remove('hidden');
    const bar = document.getElementById('defense-target-bar');
    bar.classList.remove('hidden');
    bar.innerHTML = `<span class="target-bar-label">Pasirinkite ginamą kortą:</span><div class="target-bout-buttons"><button class="btn-action btn-target-bout">Atmušti 6♥</button><button class="btn-action btn-target-bout">Atmušti 10♠</button><button class="btn-action btn-target-bout">Atmušti J♦</button></div>`;
  });
  await page.waitForTimeout(200);
  g = await page.evaluate(MEASURE);
  checkView(vp.width, vp.height, g, `${vp.name}/actions`, issues);
  issues.push(`--- ${vp.name}/actions bottom-zone: ${JSON.stringify(g.bottom)}`);

  // Būsena C: gameover piliulė
  await page.evaluate(() => {
    document.getElementById('btn-take')?.classList.add('hidden');
    document.getElementById('btn-pass')?.classList.add('hidden');
    document.getElementById('btn-play-card')?.classList.add('hidden');
    document.getElementById('hand-pager')?.classList.add('hidden');
    document.getElementById('defense-target-bar')?.classList.add('hidden');
    window.__THREE_GAME_TEST_HOOKS__?.setState('complete');
    document.getElementById('btn-gameover-inspect')?.click();
  });
  await page.waitForTimeout(300);
  g = await page.evaluate(MEASURE);
  checkView(vp.width, vp.height, g, `${vp.name}/pill`, issues);

  await context.close();
}
await browser.close();
console.log(issues.join('\n') || 'Jokių problemų nerasta');
