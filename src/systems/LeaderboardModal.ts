import { LeaderboardManager } from '../engine/Leaderboard';
import { ModalManager, confirmDialog } from './Ui';

export class LeaderboardModal {
  private container: HTMLElement;
  private manager: LeaderboardManager;

  constructor(manager: LeaderboardManager, containerId: string = 'leaderboard-modal') {
    this.manager = manager;
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      el.className = 'modal-overlay hidden';
      document.body.appendChild(el);
    }
    this.container = el;
    this.render();
  }

  public open(): void {
    this.render();
    ModalManager.open(this.container);
  }

  public close(): void {
    ModalManager.close(this.container);
  }

  private render(): void {
    const entries = this.manager.getEntries();

    this.container.innerHTML = `
      <div class="modal-card modal-leaderboard" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
        <div class="modal-header">
          <div class="setup-header-title">
            <span class="setup-icon">🏆</span>
            <div>
              <h3 id="leaderboard-title">Karališkojo Durak Klubo Reitingai</h3>
              <p class="setup-subtitle">Žaidėjų statistika ir pergalių koeficientai</p>
            </div>
          </div>
          <button id="btn-close-leaderboard" class="btn-close" aria-label="Uždaryti reitingų lentelę">×</button>
        </div>

        <div class="modal-body leaderboard-body">
          <div class="leaderboard-table-wrapper">
            <table class="leaderboard-table" aria-label="Reitingų sąrašas">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Žaidėjas</th>
                  <th class="text-center">Pergalės</th>
                  <th class="text-center">Pralaimėjimai</th>
                  <th class="text-center">Laimėjimo %</th>
                  <th class="text-center">Raundai</th>
                </tr>
              </thead>
              <tbody>
                ${entries
                  .map((e, idx) => {
                    const total = e.wins + e.losses;
                    const winRate = total > 0 ? Math.round((e.wins / total) * 100) : 0;
                    const isUser = e.id === 'player_0';
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                    return `
                      <tr class="${isUser ? 'leaderboard-user-row' : ''}">
                        <td class="col-rank">${medal}</td>
                        <td class="col-name">
                          <strong>${e.name}</strong>
                          ${e.demo ? ' <span class="badge-demo">Demo</span>' : ''}
                          ${isUser ? ' <span class="badge-you">(Jūs)</span>' : ''}
                        </td>
                        <td class="text-center tabular-num text-success">${e.wins}</td>
                        <td class="text-center tabular-num text-danger">${e.losses}</td>
                        <td class="text-center tabular-num text-gold font-bold">${winRate}%</td>
                        <td class="text-center tabular-num text-dim">${e.totalRounds}</td>
                      </tr>
                    `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="modal-footer leaderboard-footer">
          <button id="btn-reset-leaderboard" class="btn-action btn-secondary" style="font-size: 12px; padding: 6px 12px;">Išvalyti reitingus</button>
          <button id="btn-close-leaderboard-foot" class="btn-action btn-gold">Uždaryti</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.container.querySelector('#btn-close-leaderboard')?.addEventListener('click', () => this.close());
    this.container.querySelector('#btn-close-leaderboard-foot')?.addEventListener('click', () => this.close());
    this.container.querySelector('#btn-reset-leaderboard')?.addEventListener('click', () => {
      confirmDialog({
        title: 'Reitingų atstatymas',
        message: 'Ar tikrai norite atstatyti reitingų statistiką į pradinę būseną?',
        confirmLabel: 'Atstatyti',
        danger: true,
      }).then((confirmed) => {
        if (confirmed) {
          this.manager.reset();
          this.render();
        }
      });
    });
  }
}
