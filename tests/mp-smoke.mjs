// Neautomatinis multiplayer dūmų testas: host sukuria kambarį, klientas prisijunga,
// pradedamas žaidimas, abiejuose matoma būsena.
import { chromium } from '@playwright/test';

const URL = 'http://127.0.0.1:5199/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CLICK = { timeout: 60000, noWaitAfter: true };

const browser = await chromium.launch();
const browser2 = await chromium.launch();
const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const clientCtx = await browser2.newContext({ viewport: { width: 1280, height: 800 } });
const host = await hostCtx.newPage();
const client = await clientCtx.newPage();
const errors = [];
host.on('pageerror', (e) => errors.push('HOST: ' + e.message));
client.on('pageerror', (e) => errors.push('CLIENT: ' + e.message));

await host.goto(URL);
await client.goto(URL);
await wait(1500);

// 1. Atidaryti lobį ir sukurti kambarį (3 vietos)
await host.bringToFront();
await host.click('#btn-online', CLICK);
await host.fill('#ol-name', 'Šeimininkas');
await host.click('#ol-create', CLICK);
let code = '';
for (let i = 0; i < 30; i++) {
  await wait(1000);
  code = (await host.textContent('#ol-room-code')).trim();
  if (code !== '—') break;
}
console.log('ROOM_CODE=' + code);
if (!/^[A-Z2-9]{5}$/.test(code)) throw new Error('Kambario kodas nesugeneruotas: ' + code);

// 2. Klientas prisijungia
await client.bringToFront();
await client.click('#btn-online', CLICK);
await client.fill('#ol-name', 'Draugas');
await client.fill('#ol-code', code);
await client.click('#ol-join', CLICK);
await wait(20000);
const clientStatus = (await client.textContent('#ol-client-status')).trim();
console.log('CLIENT_STATUS=' + clientStatus);
if (!clientStatus.includes('laukiama')) throw new Error('Klientas neprisijungė: ' + clientStatus);

// 3. Host mato 2 žaidėjus, gali pradėti
const hostList = (await host.textContent('#ol-host-players')).trim();
console.log('HOST_PLAYERS=' + hostList.replace(/\s+/g, ' '));
if (!hostList.includes('Draugas')) throw new Error('Hostas nemato žaidėjo');
const startDisabled = await host.locator('#ol-start').isDisabled();
if (startDisabled) throw new Error('Startas vis dar išjungtas');

// 4. Pradėti žaidimą
await host.bringToFront();
await host.click('#ol-start', CLICK);
await wait(8000);

for (const [label, page] of [['HOST', host], ['CLIENT', client]]) {
  const info = await page.evaluate(() => {
    const n = window.__NET_DEBUG__;
    return {
      seat: n?.getMySeat?.(),
      role: n?.role,
      status: document.getElementById('status-line')?.textContent || '',
    };
  });
  console.log(`${label}_INFO=` + JSON.stringify(info));
}

console.log('PAGE_ERRORS=' + JSON.stringify(errors));
await browser.close();
console.log('MULTIPLAYER_SMOKE_OK');
process.exit(0);
