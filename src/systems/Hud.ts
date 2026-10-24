import { DurakEngine } from '../engine/DurakEngine';
import { DurakTeacher } from '../engine/DurakTeacher';
import { SUIT_SYMBOLS, SUIT_NAMES_LT, type Card } from '../engine/types';
import { type GraphicsPreset } from '../core/GraphicsQuality';
import { ModalManager, Toast } from './Ui';

export class Hud {
  private statusLine: HTMLElement;
  private opponentStrip: HTMLElement | null;
  private opponentStripCache: string = '';
  private deckCounter: HTMLElement;
  private discardCounter: HTMLElement | null;
  private roundBadge: HTMLElement;
  private teacherModal: HTMLElement;
  private jsonModal: HTMLElement;
  private gameoverModal: HTMLElement | null;
  private btnReopenGameover: HTMLElement | null;

  private phaseBadge: HTMLElement | null;
  private phaseInstruction: HTMLElement | null;
  private trumpCardText: HTMLElement | null;
  private trumpNameText: HTMLElement | null;
  private btnAudio: HTMLElement | null;

  // Mobile navigation drawer
  private mobileDrawer: HTMLElement | null;
  private drawerBackdrop: HTMLElement | null;
  private btnMobileMenu: HTMLElement | null;
  private drawerGraphicsSelect: HTMLSelectElement | null;

  // Hand pager
  private handPager: HTMLElement | null;
  private btnHandPrev: HTMLElement | null;
  private btnHandNext: HTMLElement | null;
  private handPagerIndicator: HTMLElement | null;

  // Action controls
  private btnPlayCard: HTMLElement | null;
  private btnTake: HTMLElement | null;
  private btnPass: HTMLElement | null;
  private btnHint: HTMLElement | null;
  private defenseTargetBar: HTMLElement | null;

  private gameoverDismissed: boolean = false;

  private onTakeCallback?: () => void;
  private onPassCallback?: () => void;
  private onHintCallback?: () => void;
  private onRestartCallback?: () => void;
  private onOpenSetupCallback?: () => void;
  private onOpenLeaderboardCallback?: () => void;
  private onOpenOnlineCallback?: () => void;
  private onToggleAudioCallback?: () => boolean;
  private onPlaySelectedCardCallback?: () => void;
  private onGraphicsChangeCallback?: (preset: GraphicsPreset) => void;
  private onHandPageCallback?: (direction: -1 | 1) => void;

  constructor() {
    this.statusLine = document.getElementById('status-line')!;
    this.opponentStrip = document.getElementById('opponent-strip');
    this.deckCounter = document.getElementById('deck-counter')!;
    this.discardCounter = document.getElementById('discard-counter');
    this.roundBadge = document.getElementById('round-badge')!;
    this.teacherModal = document.getElementById('teacher-modal')!;
    this.jsonModal = document.getElementById('json-modal')!;
    this.gameoverModal = document.getElementById('gameover-modal');
    this.btnReopenGameover = document.getElementById('btn-reopen-gameover');

    this.phaseBadge = document.getElementById('phase-badge');
    this.phaseInstruction = document.getElementById('phase-instruction');
    this.trumpCardText = document.getElementById('trump-card-text');
    this.trumpNameText = document.getElementById('trump-name-text');
    this.btnAudio = document.getElementById('btn-audio');

    this.mobileDrawer = document.getElementById('mobile-drawer');
    this.drawerBackdrop = document.getElementById('drawer-backdrop');
    this.btnMobileMenu = document.getElementById('btn-mobile-menu');
    this.drawerGraphicsSelect = document.getElementById('drawer-graphics-select') as HTMLSelectElement | null;

    this.handPager = document.getElementById('hand-pager');
    this.btnHandPrev = document.getElementById('btn-hand-prev');
    this.btnHandNext = document.getElementById('btn-hand-next');
    this.handPagerIndicator = document.getElementById('hand-pager-indicator');

    this.btnPlayCard = document.getElementById('btn-play-card');
    this.btnTake = document.getElementById('btn-take');
    this.btnPass = document.getElementById('btn-pass');
    this.btnHint = document.getElementById('btn-hint');
    this.defenseTargetBar = document.getElementById('defense-target-bar');

    this.bindEvents();
  }

  public setCallbacks(callbacks: {
    onTake: () => void;
    onPass: () => void;
    onHint: () => void;
    onRestart: () => void;
    onOpenSetup?: () => void;
    onOpenLeaderboard?: () => void;
    onOpenOnline?: () => void;
    onToggleAudio?: () => boolean;
    onPlaySelectedCard?: () => void;
    onGraphicsChange?: (preset: GraphicsPreset) => void;
    onHandPage?: (direction: -1 | 1) => void;
  }): void {
    this.onTakeCallback = callbacks.onTake;
    this.onPassCallback = callbacks.onPass;
    this.onHintCallback = callbacks.onHint;
    this.onRestartCallback = callbacks.onRestart;
    this.onOpenSetupCallback = callbacks.onOpenSetup;
    this.onOpenLeaderboardCallback = callbacks.onOpenLeaderboard;
    this.onOpenOnlineCallback = callbacks.onOpenOnline;
    this.onToggleAudioCallback = callbacks.onToggleAudio;
    this.onPlaySelectedCardCallback = callbacks.onPlaySelectedCard;
    this.onGraphicsChangeCallback = callbacks.onGraphicsChange;
    this.onHandPageCallback = callbacks.onHandPage;
  }

  private bindEvents(): void {
    this.btnTake?.addEventListener('click', () => this.onTakeCallback?.());
    this.btnPass?.addEventListener('click', () => this.onPassCallback?.());
    this.btnHint?.addEventListener('click', () => this.onHintCallback?.());
    this.btnPlayCard?.addEventListener('click', () => this.onPlaySelectedCardCallback?.());

    // Debug-only surfaces (JSON state) are hidden in production builds
    if (!import.meta.env.DEV) {
      document.getElementById('btn-json')?.classList.add('hidden');
      document.getElementById('drawer-btn-json')?.classList.add('hidden');
    }

    document.getElementById('btn-setup')?.addEventListener('click', () => this.onOpenSetupCallback?.());
    document.getElementById('btn-online')?.addEventListener('click', () => this.onOpenOnlineCallback?.());
    document.getElementById('drawer-btn-online')?.addEventListener('click', () => {
      this.closeMobileDrawer();
      this.onOpenOnlineCallback?.();
    });
    document.getElementById('btn-leaderboard')?.addEventListener('click', () => this.onOpenLeaderboardCallback?.());
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.gameoverDismissed = false;
      this.onRestartCallback?.();
    });

    // Mobile drawer triggers
    this.btnMobileMenu?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openMobileDrawer();
    });
    const closeDrawerBtn = document.getElementById('drawer-btn-close');
    closeDrawerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMobileDrawer();
    });
    this.drawerBackdrop?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeMobileDrawer();
    });
    this.mobileDrawer?.addEventListener('click', (e) => {
      if (e.target === this.mobileDrawer) {
        this.closeMobileDrawer();
      }
    });

    document.getElementById('drawer-btn-setup')?.addEventListener('click', () => {
      this.closeMobileDrawer();
      this.onOpenSetupCallback?.();
    });
    document.getElementById('drawer-btn-rules')?.addEventListener('click', () => {
      this.closeMobileDrawer();
      this.openModal(this.teacherModal);
    });
    document.getElementById('drawer-btn-leaderboard')?.addEventListener('click', () => {
      this.closeMobileDrawer();
      this.onOpenLeaderboardCallback?.();
    });
    document.getElementById('drawer-btn-json')?.addEventListener('click', () => {
      this.closeMobileDrawer();
      this.openModal(this.jsonModal);
    });
    document.getElementById('drawer-btn-restart')?.addEventListener('click', () => {
      this.closeMobileDrawer();
      this.gameoverDismissed = false;
      this.onRestartCallback?.();
    });

    this.drawerGraphicsSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.onGraphicsChangeCallback?.(target.value as GraphicsPreset);
    });

    // Hand pager buttons
    this.btnHandPrev?.addEventListener('click', () => this.onHandPageCallback?.(-1));
    this.btnHandNext?.addEventListener('click', () => this.onHandPageCallback?.(1));

    // Audio toggle
    this.btnAudio?.addEventListener('click', () => {
      if (this.onToggleAudioCallback) {
        const isMuted = this.onToggleAudioCallback();
        this.updateAudioButton(isMuted);
      }
    });

    // Modal open buttons
    document.getElementById('btn-rules')?.addEventListener('click', () => {
      this.openModal(this.teacherModal);
    });
    document.getElementById('btn-close-rules')?.addEventListener('click', () => {
      ModalManager.close(this.teacherModal);
    });

    document.getElementById('btn-json')?.addEventListener('click', () => {
      this.openModal(this.jsonModal);
    });
    document.getElementById('btn-close-json')?.addEventListener('click', () => {
      ModalManager.close(this.jsonModal);
    });

    // Game Over modal buttons
    document.getElementById('btn-gameover-restart')?.addEventListener('click', () => {
      this.gameoverDismissed = false;
      ModalManager.close(this.gameoverModal!);
      this.btnReopenGameover?.classList.add('hidden');
      this.onRestartCallback?.();
    });

    document.getElementById('btn-gameover-inspect')?.addEventListener('click', () => {
      this.gameoverDismissed = true;
      ModalManager.close(this.gameoverModal!);
      this.btnReopenGameover?.classList.remove('hidden');
    });

    this.btnReopenGameover?.addEventListener('click', () => {
      this.gameoverDismissed = false;
      ModalManager.open(this.gameoverModal!);
      this.btnReopenGameover?.classList.add('hidden');
    });

    // Copy JSON button
    document.getElementById('btn-copy-json')?.addEventListener('click', async () => {
      const code = document.getElementById('json-content')?.innerText;
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        Toast.show('Būsenos JSON nukopijuotas į iškarpinę.', 'success');
      } catch {
        Toast.show('Nepavyko nukopijuoti — leiskite naršyklei prieigą prie iškarpinės.', 'error');
      }
    });
  }

  private openModal(el: HTMLElement): void {
    ModalManager.open(el);
  }

  public openMobileDrawer(): void {
    if (this.mobileDrawer) {
      this.mobileDrawer.classList.remove('hidden');
    }
    this.btnMobileMenu?.setAttribute('aria-expanded', 'true');
  }

  public closeMobileDrawer(): void {
    if (this.mobileDrawer && !this.mobileDrawer.classList.contains('hidden')) {
      this.mobileDrawer.classList.add('hidden');
      this.btnMobileMenu?.setAttribute('aria-expanded', 'false');
    }
  }

  public setGraphicsSelectValue(preset: GraphicsPreset): void {
    if (this.drawerGraphicsSelect) {
      this.drawerGraphicsSelect.value = preset;
    }
  }

  public updateAudioButton(isMuted: boolean): void {
    if (!this.btnAudio) return;
    const iconEl = document.getElementById('audio-icon');
    const labelEl = document.getElementById('audio-label');
    if (iconEl) iconEl.innerText = isMuted ? '🔇' : '🔊';
    if (labelEl) labelEl.innerText = isMuted ? 'Nutildyta' : 'Garsas';
    this.btnAudio.setAttribute('title', isMuted ? 'Garsas nutildytas (Spauskite įjungti)' : 'Garsas įjungtas');
  }

  public updateHandPager(totalCards: number, startIndex: number, pageSize: number): void {
    if (!this.handPager || !this.handPagerIndicator) return;

    if (totalCards <= pageSize) {
      this.handPager.classList.add('hidden');
      return;
    }

    this.handPager.classList.remove('hidden');
    const endIndex = Math.min(startIndex + pageSize, totalCards);
    this.handPagerIndicator.innerText = `${startIndex + 1}-${endIndex} iš ${totalCards}`;

    if (this.btnHandPrev) {
      (this.btnHandPrev as HTMLButtonElement).disabled = startIndex <= 0;
    }
    if (this.btnHandNext) {
      (this.btnHandNext as HTMLButtonElement).disabled = endIndex >= totalCards;
    }
  }

  public updateSelectedCardAction(
    card: Card | null,
    legalMoveType: 'attack' | 'throw_in' | 'beat' | 'transfer' | null
  ): void {
    if (!this.btnPlayCard) return;

    if (!card || !legalMoveType) {
      this.btnPlayCard.classList.add('hidden');
      this.clearDefenseTargets();
      return;
    }

    const rank = card.rank;
    const suitSymbol = SUIT_SYMBOLS[card.suit] || '';
    let label = `⚔️ Dėti ${rank}${suitSymbol}`;
    if (legalMoveType === 'beat') {
      label = `🛡️ Atmušti su ${rank}${suitSymbol}`;
    } else if (legalMoveType === 'transfer') {
      label = `🔄 Perduoti su ${rank}${suitSymbol}`;
    }

    this.btnPlayCard.innerText = label;
    this.btnPlayCard.classList.remove('hidden');
  }

  public showDefenseTargetSelection(
    openBouts: Array<{ boutIndex: number; attackCard: Card }>,
    onSelect: (idx: number) => void
  ): void {
    if (!this.defenseTargetBar) return;

    if (openBouts.length <= 1) {
      this.defenseTargetBar.classList.add('hidden');
      this.defenseTargetBar.innerHTML = '';
      return;
    }

    this.defenseTargetBar.classList.remove('hidden');
    this.defenseTargetBar.innerHTML = `
      <span class="target-bar-label">Pasirinkite ginamą kortą:</span>
      <div class="target-bout-buttons">
        ${openBouts
          .map(
            (b) => `
            <button class="btn-action btn-target-bout" data-bout-idx="${b.boutIndex}">
              Atmušti ${b.attackCard.rank}${SUIT_SYMBOLS[b.attackCard.suit]}
            </button>
          `
          )
          .join('')}
      </div>
    `;

    this.defenseTargetBar.querySelectorAll('.btn-target-bout').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const boutIdx = parseInt(target.getAttribute('data-bout-idx') || '0', 10);
        onSelect(boutIdx);
        this.clearDefenseTargets();
      });
    });
  }

  public clearDefenseTargets(): void {
    if (this.defenseTargetBar) {
      this.defenseTargetBar.classList.add('hidden');
      this.defenseTargetBar.innerHTML = '';
    }
  }

  public update(engine: DurakEngine, playerLegalMoves: string[]): void {
    // 1. Status line
    this.statusLine.innerText = engine.lastRefereeMessage || 'Pasirinkite kortą arba veiksmą.';

    // 2. Deck & Trumps
    const trumpSymbol = engine.isNoTrump ? 'Ø' : SUIT_SYMBOLS[engine.trumpSuit];
    const trumpName = engine.isNoTrump ? 'Be kozirių' : SUIT_NAMES_LT[engine.trumpSuit];
    const uiCfg = engine.customConfig.interface;

    this.deckCounter.innerText = uiCfg.show_card_count ? `${engine.deck.length}` : '?';
    if (this.discardCounter) {
      this.discardCounter.innerText = uiCfg.show_discard_pile ? `${engine.discardPile.length}` : '-';
    }

    const trumpBadgeEl = document.getElementById('trump-badge');
    if (trumpBadgeEl) {
      trumpBadgeEl.classList.toggle('hidden', !uiCfg.show_trump_card);
    }

    if (this.trumpCardText && this.trumpNameText) {
      const cardRank = engine.trumpCard ? engine.trumpCard.rank : '';
      const isTaken = engine.deck.length === 0;
      this.trumpCardText.className = `trump-card-pill suit-${engine.trumpSuit}`;
      this.trumpCardText.innerText = engine.isNoTrump ? 'Ø' : `${cardRank}${trumpSymbol}`;
      this.trumpNameText.innerText = isTaken ? `${trumpName} (Paimta)` : trumpName;
    }

    // 3. Round info
    let variantLt = 'Metamas durnius';
    if (engine.options.variant === 'perevodnoy_durak') variantLt = 'Perduodamasis durnius';
    else if (engine.options.variant === 'custom_mix') variantLt = 'Mišrus durnius';
    this.roundBadge.innerText = `${variantLt} • Raundas ${engine.roundNumber}`;

    // 4. Player & Opponent role badges (re-render only when the state actually changes)
    if (this.opponentStrip) {
      const stripHtml = engine.players
        .map((p, idx) => {
          const isAttacker = idx === engine.attackerIndex;
          const isDefender = idx === engine.defenderIndex;
          const roleClass = isAttacker ? 'role-attacker' : isDefender ? 'role-defender' : '';
          const roleIcon = isAttacker ? '⚔️' : isDefender ? '🛡️' : '🃏';
          const nameLabel = idx === 0 ? 'Jūs' : p.name;
          const teamLabel = p.teamId ? ` [${p.teamId}]` : '';
          const cardCountStr = uiCfg.show_card_count ? `${p.hand.length}` : '?';
          return `<span class="opp-badge ${roleClass}">${roleIcon} ${nameLabel}${teamLabel}: <strong class="opp-count tabular-num">${cardCountStr}</strong></span>`;
        })
        .join('');
      if (stripHtml !== this.opponentStripCache) {
        this.opponentStripCache = stripHtml;
        this.opponentStrip.innerHTML = stripHtml;
      }
    }

    // 5. Phase & Turn Banner
    this.updatePhaseBanner(engine, playerLegalMoves);

    // 6. Action buttons visibility
    const canTake = playerLegalMoves.some((m) => m === 'take');
    const canPass = playerLegalMoves.some((m) => m.startsWith('pass'));

    if (this.btnTake) this.btnTake.classList.toggle('hidden', !canTake);
    if (this.btnPass) this.btnPass.classList.toggle('hidden', !canPass);
    if (this.btnHint) this.btnHint.classList.toggle('hidden', !uiCfg.suggest_best_move);

    // 7. Game Over Modal
    this.updateGameOverState(engine);

    // 8. Update Rules Modal content
    const rulesBody = document.getElementById('rules-summary-body');
    if (rulesBody) {
      rulesBody.innerHTML = DurakTeacher.getRuleSummaryLt(engine).replace(/\n/g, '<br>');
    }

    // 9. Update JSON Modal
    const jsonPre = document.getElementById('json-content');
    if (jsonPre) {
      jsonPre.innerText = JSON.stringify(engine.toSpecOutputFormat(0), null, 2);
    }
  }

  private updatePhaseBanner(engine: DurakEngine, _playerLegalMoves: string[]): void {
    if (!this.phaseBadge || !this.phaseInstruction) return;

    if (engine.gameOver) {
      this.phaseBadge.className = 'phase-badge phase-gameover';
      this.phaseBadge.innerText = '🏆 PABAIGA';
      this.phaseInstruction.innerText = 'Žaidimas baigtas. Peržiūrėkite rezultatus!';
      return;
    }

    const humanIsDefender = engine.defenderIndex === 0;
    const humanIsAttacker = engine.attackerIndex === 0;
    const hasUnbeaten = engine.table.some((b) => b.defense === null);

    if (humanIsDefender) {
      if (hasUnbeaten) {
        this.phaseBadge.className = 'phase-badge phase-defense';
        this.phaseBadge.innerText = '🛡️ JŪSŲ GINYBA';
        this.phaseInstruction.innerText = 'Pasirinkite kortą atmušimui arba spauskite „Imti kortas“';
      } else {
        this.phaseBadge.className = 'phase-badge phase-wait';
        this.phaseBadge.innerText = '⏳ LAUKIAMA OPONENTO';
        this.phaseInstruction.innerText = 'Priešininkas svarsto papildomą ataką...';
      }
    } else if (humanIsAttacker) {
      if (engine.table.length === 0) {
        this.phaseBadge.className = 'phase-badge phase-attack';
        this.phaseBadge.innerText = '⚔️ JŪSŲ ATAKA';
        this.phaseInstruction.innerText = 'Pasirinkite kortą pirmai atakai';
      } else if (engine.defenderTaking) {
        this.phaseBadge.className = 'phase-badge phase-attack';
        this.phaseBadge.innerText = '📥 OPONENTAS PASIDAVĖ';
        this.phaseInstruction.innerText = 'Pamėskite sutampančias kortas arba spauskite „Bita / Baigti“';
      } else if (hasUnbeaten) {
        this.phaseBadge.className = 'phase-badge phase-wait';
        this.phaseBadge.innerText = '⏳ OPONENTAS GINASI';
        this.phaseInstruction.innerText = 'Laukiama priešininko atmušimo...';
      } else {
        this.phaseBadge.className = 'phase-badge phase-attack';
        this.phaseBadge.innerText = '⚔️ PAPILDYMAS';
        this.phaseInstruction.innerText = 'Pamėskite sutampančio rango kortą arba spauskite „Bita / Baigti“';
      }
    } else {
      // Human is waiting
      this.phaseBadge.className = 'phase-badge phase-wait';
      this.phaseBadge.innerText = '⏳ OPONENTŲ KOVA';
      this.phaseInstruction.innerText = 'Vyksta kova prie stalo...';
    }
  }

  private updateGameOverState(engine: DurakEngine): void {
    if (!this.gameoverModal) return;

    if (!engine.gameOver) {
      this.gameoverDismissed = false;
      if (ModalManager.isOpen(this.gameoverModal)) ModalManager.close(this.gameoverModal);
      this.btnReopenGameover?.classList.add('hidden');
      return;
    }

    // Game is over!
    if (!this.gameoverDismissed) {
      this.btnReopenGameover?.classList.add('hidden');
      if (!ModalManager.isOpen(this.gameoverModal)) {
        // Closing via ESC/backdrop acts like "Apžiūrėti stalą": show the reopen pill
        ModalManager.open(this.gameoverModal, {
          onClose: () => {
            this.gameoverDismissed = true;
            this.btnReopenGameover?.classList.remove('hidden');
          },
        });
      }
    } else if (!ModalManager.isOpen(this.gameoverModal)) {
      this.btnReopenGameover?.classList.remove('hidden');
    }

    const titleEl = document.getElementById('gameover-title');
    const subtitleEl = document.getElementById('gameover-subtitle');
    const emblemEl = document.getElementById('gameover-emblem');
    const loserEl = document.getElementById('stat-loser');
    const roundsEl = document.getElementById('stat-rounds');
    const discardEl = document.getElementById('stat-discard');

    const humanIsLoser = engine.loserPlayerId === 0;
    const isDraw = engine.isDraw;

    if (isDraw) {
      if (emblemEl) emblemEl.innerText = '🤝';
      if (titleEl) titleEl.innerText = 'LYGIOSIOS!';
      if (subtitleEl) subtitleEl.innerText = 'Nėra durniaus – visi žaidėjai sėkmingai išėjo.';
      if (loserEl) loserEl.innerText = 'Nėra (Lygiosios)';
    } else if (humanIsLoser) {
      if (emblemEl) emblemEl.innerText = '🃏';
      if (titleEl) titleEl.innerText = 'DURNIUS!';
      if (subtitleEl) subtitleEl.innerText = 'Šį kartą likote su kortomis rankoje. Sėkmės kitą kartą!';
      if (loserEl) loserEl.innerText = 'Jūs';
    } else {
      const loserName = engine.players.find((p) => p.id === engine.loserPlayerId)?.name || 'Botas Jonas';
      if (emblemEl) emblemEl.innerText = '👑';
      if (titleEl) titleEl.innerText = 'PERGALĖ!';
      if (subtitleEl) subtitleEl.innerText = `Sveikiname! Durniumi liko ${loserName}.`;
      if (loserEl) loserEl.innerText = loserName;
    }

    if (roundsEl) roundsEl.innerText = `${engine.roundNumber}`;
    if (discardEl) discardEl.innerText = `${engine.discardPile.length}`;
  }

  public showRefereeAlert(msg: string): void {
    this.statusLine.innerText = msg;
    this.statusLine.classList.add('flash-alert');
    setTimeout(() => {
      this.statusLine.classList.remove('flash-alert');
    }, 600);
  }
}
