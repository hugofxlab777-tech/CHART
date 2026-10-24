import { ModalManager } from './Ui';
import type { NetPlayerInfo } from '../engine/OnlineMultiplayer';

/**
 * Kambario (lobby) modalas internetiniam žaidimui:
 * sukurti kambarį / prisijungti kodu / palaukti žaidėjų.
 */
export class OnlineLobbyModal {
  private readonly el: HTMLElement;
  private readonly menuView: HTMLElement;
  private readonly hostView: HTMLElement;
  private readonly clientView: HTMLElement;
  private readonly roomCodeEl: HTMLElement;
  private readonly copyCodeBtn: HTMLButtonElement;
  private readonly hostPlayersEl: HTMLElement;
  private readonly hostStartBtn: HTMLButtonElement;
  private readonly seatCountSelect: HTMLSelectElement;
  private readonly clientPlayersEl: HTMLElement;
  private readonly clientStatusEl: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly codeInput: HTMLInputElement;
  private readonly errorEl: HTMLElement;

  public onCreateRoom: ((name: string, seatCount: number) => void) | null = null;
  public onJoinRoom: ((code: string, name: string) => void) | null = null;
  public onStartGame: (() => void) | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'modal-overlay hidden';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Žaidimas internetu');
    this.el.innerHTML = `
      <div class="modal-card" style="max-width:440px;width:92%;">
        <h2 style="margin:0 0 4px;">🌐 Žaidimas internetu</h2>
        <p style="margin:0 0 14px;opacity:.75;font-size:.9rem;">Žaiskite su draugais — pakanka kambario kodo. Šeimininkas valdo žaidimą.</p>

        <div id="ol-error" class="hidden" style="color:#ff8a80;font-size:.88rem;margin-bottom:10px;"></div>

        <!-- Meniu -->
        <div id="ol-menu">
          <label style="display:block;font-size:.85rem;margin-bottom:4px;">Jūsų vardas</label>
          <input id="ol-name" type="text" maxlength="14" value="Žaidėjas" class="setup-input" style="width:100%;margin-bottom:14px;" />
          <button id="ol-create" class="btn-action btn-gold-outline" style="width:100%;margin-bottom:10px;">🃏 Sukurti kambarį</button>
          <div style="display:flex;gap:8px;">
            <input id="ol-code" type="text" maxlength="5" placeholder="KODAS" class="setup-input" style="flex:1;text-transform:uppercase;letter-spacing:.2em;" />
            <button id="ol-join" class="btn-action" style="flex:1;">➡ Prisijungti</button>
          </div>
        </div>

        <!-- Host rodinys -->
        <div id="ol-host" class="hidden">
          <div style="text-align:center;margin-bottom:12px;">
            <div style="font-size:.85rem;opacity:.7;">Kambario kodas — perduokite draugams:</div>
            <div id="ol-room-code" style="font-size:2rem;font-weight:700;letter-spacing:.35em;margin:6px 0;">—</div>
            <button id="ol-copy" class="btn-action" style="padding:.4em 1em;">📋 Kopijuoti nuorodą</button>
          </div>
          <label style="display:block;font-size:.85rem;margin-bottom:4px;">Žaidėjų vietų skaičius (AI užpildo laisvas)</label>
          <select id="ol-seats" class="setup-input" style="width:100%;margin-bottom:12px;">
            <option value="2">2 žaidėjai</option>
            <option value="3" selected>3 žaidėjai</option>
            <option value="4">4 žaidėjai</option>
            <option value="5">5 žaidėjai</option>
            <option value="6">6 žaidėjai</option>
          </select>
          <div id="ol-host-players" style="margin-bottom:12px;font-size:.92rem;"></div>
          <button id="ol-start" class="btn-action btn-play" style="width:100%;" disabled>⏳ Laukiama žaidėjų…</button>
        </div>

        <!-- Client rodinys -->
        <div id="ol-client" class="hidden">
          <div id="ol-client-status" style="margin-bottom:10px;font-size:.92rem;">Jungiamasi…</div>
          <div id="ol-client-players" style="font-size:.92rem;"></div>
        </div>

        <button id="ol-back" class="btn-action" style="width:100%;margin-top:14px;">⬅ Atgal / Baigti</button>
      </div>
    `;
    document.body.appendChild(this.el);

    this.menuView = this.el.querySelector('#ol-menu')!;
    this.hostView = this.el.querySelector('#ol-host')!;
    this.clientView = this.el.querySelector('#ol-client')!;
    this.roomCodeEl = this.el.querySelector('#ol-room-code')!;
    this.copyCodeBtn = this.el.querySelector('#ol-copy')!;
    this.hostPlayersEl = this.el.querySelector('#ol-host-players')!;
    this.hostStartBtn = this.el.querySelector('#ol-start')!;
    this.seatCountSelect = this.el.querySelector('#ol-seats')!;
    this.clientPlayersEl = this.el.querySelector('#ol-client-players')!;
    this.clientStatusEl = this.el.querySelector('#ol-client-status')!;
    this.nameInput = this.el.querySelector('#ol-name')!;
    this.codeInput = this.el.querySelector('#ol-code')!;
    this.errorEl = this.el.querySelector('#ol-error')!;

    this.el.querySelector('#ol-create')!.addEventListener('click', () => {
      this.onCreateRoom?.(this.getCleanName(), Number(this.seatCountSelect.value));
    });
    this.el.querySelector('#ol-join')!.addEventListener('click', () => {
      const code = this.codeInput.value.trim().toUpperCase();
      if (code.length < 4) {
        this.showError('Įveskite kambario kodą.');
        return;
      }
      this.onJoinRoom?.(code, this.getCleanName());
    });
    this.hostStartBtn.addEventListener('click', () => this.onStartGame?.());
    this.copyCodeBtn.addEventListener('click', () => {
      const code = this.el.dataset.roomCode || '';
      const url = `${window.location.origin}${window.location.pathname}?kambarys=${code}`;
      navigator.clipboard?.writeText(url).then(() => {
        this.copyCodeBtn.textContent = '✅ Nukopijuota';
        setTimeout(() => (this.copyCodeBtn.textContent = '📋 Kopijuoti nuorodą'), 1800);
      });
    });
    this.el.querySelector('#ol-back')!.addEventListener('click', () => {
      ModalManager.close(this.el);
    });
  }

  public open(prefillCode?: string): void {
    this.showError(null);
    this.showView('menu');
    this.codeInput.value = prefillCode || '';
    ModalManager.open(this.el);
  }

  public close(): void {
    ModalManager.close(this.el);
  }

  public isOpen(): boolean {
    return ModalManager.isOpen(this.el);
  }

  public showHostView(code: string): void {
    this.el.dataset.roomCode = code;
    this.roomCodeEl.textContent = code;
    this.showView('host');
    this.updateHostStart(false);
  }

  public showClientView(status: string): void {
    this.clientStatusEl.textContent = status;
    this.showView('client');
  }

  public setClientStatus(status: string): void {
    this.clientStatusEl.textContent = status;
  }

  public updatePlayers(players: NetPlayerInfo[], _hostName: string, totalSeats: number): void {
    const list = players
      .map((p) => `<div>🧑 <strong>${escapeHtml(p.name)}</strong>${p.seat === 0 ? ' (šeimininkas)' : ''}</div>`)
      .join('');
    const missing = Math.max(totalSeats - players.length, 0);
    const waiting = Array.from({ length: missing }, () => '<div style="opacity:.45;">⏳ laukia žaidėjo…</div>').join('');
    this.hostPlayersEl.innerHTML = list + waiting;
    this.clientPlayersEl.innerHTML = `<div style="opacity:.7;margin-bottom:6px;">Kambarys (${players.length}/${totalSeats}):</div>` + list + waiting;
    this.updateHostStart(players.length >= 2);
  }

  public updateHostStart(canStart: boolean): void {
    if (canStart) {
      this.hostStartBtn.disabled = false;
      this.hostStartBtn.textContent = '▶️ Pradėti žaidimą';
    } else {
      this.hostStartBtn.disabled = true;
      this.hostStartBtn.textContent = '⏳ Laukiama žaidėjų…';
    }
  }

  public getSeatCount(): number {
    return Number(this.seatCountSelect.value);
  }

  public showError(text: string | null): void {
    if (text) {
      this.errorEl.textContent = text;
      this.errorEl.classList.remove('hidden');
    } else {
      this.errorEl.classList.add('hidden');
    }
  }

  private showView(view: 'menu' | 'host' | 'client'): void {
    this.menuView.classList.toggle('hidden', view !== 'menu');
    this.hostView.classList.toggle('hidden', view !== 'host');
    this.clientView.classList.toggle('hidden', view !== 'client');
    this.el.querySelector<HTMLElement>('#ol-back')!.textContent =
      view === 'menu' ? '⬅ Uždaryti' : '⬅ Baigti žaidimą internetu';
  }

  private getCleanName(): string {
    const name = this.nameInput.value.trim() || 'Žaidėjas';
    return name.slice(0, 14);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
