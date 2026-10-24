import {
  type Card,
  type GameOptions,
  type Move,
  type PlayerState,
  type Rank,
  type SerializedGameState,
  type Suit,
  type TableBout,
  type ValidationResult,
  STANDARD_RANKS_36,
  EXTENDED_RANKS_52,
  SUIT_SYMBOLS,
} from './types';
import { type DurakCustomConfig, DEFAULT_DURAK_CONFIG } from './GameSetupConfig';

export class DurakEngine {
  public options: GameOptions;
  public customConfig: DurakCustomConfig;
  public players: PlayerState[] = [];
  public deck: Card[] = [];
  public trumpCard: Card | null = null;
  public trumpSuit: Suit = 'hearts';
  public isNoTrump: boolean = false;
  public discardPile: Card[] = [];
  public table: TableBout[] = [];
  public attackerIndex: number = 0;
  public defenderIndex: number = 1;
  public roundNumber: number = 1;
  public defenderTaking: boolean = false;
  public passes: Set<number> = new Set();
  public gameOver: boolean = false;
  public loserPlayerId: number | null = null;
  public winningTeamId: string | null = null;
  public isDraw: boolean = false;
  public lastRefereeMessage: string = '';

  private ranksOrder: Rank[];
  private rng: () => number;
  private winnersList: number[] = [];

  constructor(options: Partial<GameOptions> = {}, rng: () => number = Math.random) {
    this.customConfig = options.customConfig || {
      ...DEFAULT_DURAK_CONFIG,
      game_variant: options.variant || DEFAULT_DURAK_CONFIG.game_variant,
      players: {
        ...DEFAULT_DURAK_CONFIG.players,
        count: options.playerCount ?? DEFAULT_DURAK_CONFIG.players.count,
      },
      deck: {
        ...DEFAULT_DURAK_CONFIG.deck,
        size: options.deckSize ?? DEFAULT_DURAK_CONFIG.deck.size,
      },
    };

    const variant = options.variant || this.customConfig.game_variant;
    const playerCount = options.playerCount ?? this.customConfig.players.count;
    const deckSize = options.deckSize ?? this.customConfig.deck.size;

    this.options = {
      variant,
      playerCount,
      deckSize,
      firstRoundAttackLimit: options.firstRoundAttackLimit ?? this.customConfig.attack.first_round_max_cards,
      allowTrumpRevealTransfer: options.allowTrumpRevealTransfer ?? this.customConfig.transfer.allow_trump_reveal_transfer,
      throwInOrder: options.throwInOrder ?? this.customConfig.attack.throw_in_order,
      partnerMode: options.partnerMode ?? (this.customConfig.team_mode.enabled || this.customConfig.pair_mode.enabled),
      customConfig: this.customConfig,
    };
    this.rng = rng;
    this.ranksOrder = this.options.deckSize === 52 ? EXTENDED_RANKS_52 : STANDARD_RANKS_36;
    this.isNoTrump = this.customConfig.deck.trump_rule === 'no_trump';
  }

  public initGame(playerNames: string[] = ['Žaidėjas', 'AI 1', 'AI 2', 'AI 3']): void {
    this.players = [];
    const cfg = this.customConfig;
    const count = Math.min(Math.max(cfg.players.count || this.options.playerCount, 2), 8);
    const names = cfg.players.names.length >= count ? cfg.players.names : playerNames;
    const humanSet = new Set(cfg.players.human_players || ['Tu']);

    for (let i = 0; i < count; i++) {
      const pName = names[i] || (i === 0 ? 'Tu' : `AI-${i}`);
      const isHuman = humanSet.has(pName) || (humanSet.size === 0 && i === 0);
      
      // Determine Team / Pair
      let teamId: string | undefined;
      let pairId: string | undefined;

      if (cfg.team_mode.enabled) {
        for (const [tName, members] of Object.entries(cfg.team_mode.team_members)) {
          if (members.includes(pName)) {
            teamId = tName;
            break;
          }
        }
        if (!teamId) {
          // Default assignment (e.g. alternate seats)
          const tIdx = i % cfg.team_mode.team_count;
          teamId = cfg.team_mode.team_names[tIdx] || `Komanda ${String.fromCharCode(65 + tIdx)}`;
        }
      }

      if (cfg.pair_mode.enabled) {
        for (const [pTitle, members] of Object.entries(cfg.pair_mode.pair_members)) {
          if (members.includes(pName)) {
            pairId = pTitle;
            break;
          }
        }
        if (!pairId) {
          const pairIdx = Math.floor(i / 2);
          pairId = `Pora ${pairIdx + 1}`;
        }
      }

      this.players.push({
        id: i,
        name: pName,
        isAi: !isHuman,
        hand: [],
        isExited: false,
        exitRank: null,
        teamId,
        pairId,
        score: 0,
      });
    }

    this.deck = this.generateDeck();
    this.shuffle(this.deck);
    this.discardPile = [];
    this.table = [];
    this.roundNumber = 1;
    this.defenderTaking = false;
    this.passes.clear();
    this.gameOver = false;
    this.loserPlayerId = null;
    this.winningTeamId = null;
    this.isDraw = false;
    this.winnersList = [];

    // Trump card determination
    this.isNoTrump = cfg.deck.trump_rule === 'no_trump';
    if (this.isNoTrump) {
      this.trumpCard = null;
      this.trumpSuit = 'hearts'; // fallback non-acting suit
    } else if (cfg.deck.trump_rule === 'random') {
      const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
      this.trumpSuit = suits[Math.floor(this.rng() * suits.length)];
      this.trumpCard = this.deck[this.deck.length - 1];
    } else {
      // standard_bottom_card
      this.trumpCard = this.deck[this.deck.length - 1];
      this.trumpSuit = this.trumpCard.suit;
    }

    // Deal cards according to starting_size (default 6)
    const cardsPerPlayer = cfg.hand.starting_size || 6;
    for (let round = 0; round < cardsPerPlayer; round++) {
      for (let p = 0; p < this.players.length; p++) {
        if (this.deck.length > 0) {
          this.players[p].hand.push(this.deck.shift()!);
        }
      }
    }

    // Determine first attacker
    if (cfg.deck.first_attacker_rule === 'random') {
      this.attackerIndex = Math.floor(this.rng() * this.players.length);
    } else {
      this.attackerIndex = this.findLowestTrumpHolder();
    }
    this.defenderIndex = this.getNextActivePlayerIndex(this.attackerIndex);
    
    const trumpMsg = this.isNoTrump
      ? 'Be kozirių.'
      : `Koziris: ${SUIT_SYMBOLS[this.trumpSuit]} (${this.trumpSuit}).`;
    this.lastRefereeMessage = `Žaidimas pradėtas. ${trumpMsg} Pirmas puola ${this.players[this.attackerIndex].name}.`;
  }

  private generateDeck(): Card[] {
    const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
    const ranks = this.ranksOrder;
    const deck: Card[] = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({
          id: `${rank}_${suit}`,
          suit,
          rank,
        });
      }
    }
    return deck;
  }

  private shuffle(array: Card[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private findLowestTrumpHolder(): number {
    let bestPlayer = 0;
    let lowestRankValue = 999;

    for (let i = 0; i < this.players.length; i++) {
      for (const card of this.players[i].hand) {
        if (card.suit === this.trumpSuit) {
          const rankVal = this.getRankValue(card.rank);
          if (rankVal < lowestRankValue) {
            lowestRankValue = rankVal;
            bestPlayer = i;
          }
        }
      }
    }
    return bestPlayer;
  }

  public getRankValue(rank: Rank): number {
    return this.ranksOrder.indexOf(rank);
  }

  public getNextActivePlayerIndex(fromIndex: number): number {
    let next = (fromIndex + 1) % this.players.length;
    let loops = 0;
    while (this.players[next].isExited && loops < this.players.length) {
      next = (next + 1) % this.players.length;
      loops++;
    }
    return next;
  }

  public hasCustomRule(ruleId: string): boolean {
    return this.customConfig.custom_rules.includes(ruleId);
  }

  public canBeat(attackCard: Card, defenseCard: Card): boolean {
    // Custom rule: Ace beats everything
    if (this.hasCustomRule('ace_beats_everything') && defenseCard.rank === 'A') {
      return true;
    }

    // No trump mode
    if (this.isNoTrump) {
      if (defenseCard.suit === attackCard.suit) {
        return this.getRankValue(defenseCard.rank) > this.getRankValue(attackCard.rank);
      }
      return false;
    }

    if (defenseCard.suit === attackCard.suit) {
      return this.getRankValue(defenseCard.rank) > this.getRankValue(attackCard.rank);
    }
    if (defenseCard.suit === this.trumpSuit && attackCard.suit !== this.trumpSuit) {
      return true;
    }
    return false;
  }

  public validateMove(move: Move): ValidationResult {
    const player = this.players[move.playerId];
    if (!player) return { valid: false, reasonLt: 'Žaidėjas neegzistuoja.' };
    if (player.isExited) return { valid: false, reasonLt: 'Žaidėjas jau baigė žaidimą.' };

    const isDefender = move.playerId === this.defenderIndex;
    const isAttacker = move.playerId === this.attackerIndex;

    // 1. Move: ATTACK (First card in round)
    if (move.type === 'attack') {
      if (!isAttacker) {
        return { valid: false, reasonLt: 'Tik pagrindinis puolėjas gali pradėti ataką.' };
      }
      if (this.table.length > 0) {
        return { valid: false, reasonLt: 'Raundas jau pradėtas, naudokite primetimą (throw_in).' };
      }
      if (!move.card || !this.hasCard(player, move.card)) {
        return { valid: false, reasonLt: 'Neturite šios kortos rankoje.' };
      }

      // Custom rule: no trump attack
      if (this.hasCustomRule('no_trump_attack') && !this.isNoTrump && move.card.suit === this.trumpSuit) {
        return { valid: false, reasonLt: 'Draudžiama pulti koziriais pagal namų taisyklę.' };
      }

      // Custom rule: no trump first round
      if (this.hasCustomRule('no_trump_first_round') && this.roundNumber === 1 && !this.isNoTrump && move.card.suit === this.trumpSuit) {
        return { valid: false, reasonLt: 'Draudžiama mesti kozirius pirmame raunde.' };
      }

      // Custom rule: must attack lowest card
      if (this.hasCustomRule('must_attack_lowest_card')) {
        const lowestVal = Math.min(...player.hand.map((c) => this.getRankValue(c.rank)));
        if (this.getRankValue(move.card.rank) > lowestVal) {
          return { valid: false, reasonLt: 'Privaloma pulti žemiausio rango turima korta.' };
        }
      }

      return { valid: true };
    }

    // 2. Move: THROW_IN (Co-attack or attacker continuation)
    if (move.type === 'throw_in') {
      if (isDefender) {
        return { valid: false, reasonLt: 'Gynėjas negali primesti kortų pats sau.' };
      }
      if (this.table.length === 0) {
        return { valid: false, reasonLt: 'Pirmiausia reikia pradėti ataką.' };
      }
      if (!move.card || !this.hasCard(player, move.card)) {
        return { valid: false, reasonLt: 'Neturite šios kortos rankoje.' };
      }

      // Custom rule: no help from others
      if (this.hasCustomRule('no_help_from_others') && move.playerId !== this.attackerIndex) {
        return { valid: false, reasonLt: 'Pagal pasirinktą taisyklę tik pagrindinis puolėjas gali primesti kortas.' };
      }

      // Custom rule: no trump first round
      if (this.hasCustomRule('no_trump_first_round') && this.roundNumber === 1 && !this.isNoTrump && move.card.suit === this.trumpSuit) {
        return { valid: false, reasonLt: 'Draudžiama mesti kozirius pirmame raunde.' };
      }

      // Check max attack limits
      let maxLimit = this.roundNumber === 1 ? this.customConfig.attack.first_round_max_cards : this.customConfig.attack.max_cards_per_round;
      if (this.hasCustomRule('team_attack_bonus') && this.customConfig.team_mode.enabled) {
        maxLimit += 2;
      }

      if (this.table.length >= maxLimit) {
        return { valid: false, reasonLt: `Pasiektas maksimalus raundo atakos limitas (${maxLimit} kortos).` };
      }

      // Defender capacity check
      if (this.customConfig.attack.limit_by_defender_hand) {
        const defender = this.players[this.defenderIndex];
        const unbeatenCount = this.table.filter((b) => b.defense === null).length;
        if (unbeatenCount >= defender.hand.length && !this.defenderTaking) {
          return { valid: false, reasonLt: 'Negalima mesti daugiau kortų nei gynėjas turi rankoje.' };
        }
      }

      // Rank match check
      const ranksOnTable = new Set<Rank>();
      for (const b of this.table) {
        ranksOnTable.add(b.attack.rank);
        if (b.defense) ranksOnTable.add(b.defense.rank);
      }
      if (!ranksOnTable.has(move.card.rank)) {
        return { valid: false, reasonLt: 'Primetamos kortos rangas turi sutapti su bent viena korta ant stalo.' };
      }

      return { valid: true };
    }

    // 3. Move: BEAT (Defense)
    if (move.type === 'beat') {
      if (!isDefender) {
        return { valid: false, reasonLt: 'Tik besiginantis žaidėjas gali mušti kortas.' };
      }
      if (this.defenderTaking) {
        return { valid: false, reasonLt: 'Jūs jau nusprendėte imti kortas, mušti nebegalima.' };
      }
      if (!move.card || !this.hasCard(player, move.card)) {
        return { valid: false, reasonLt: 'Neturite šios kortos rankoje.' };
      }
      if (move.targetAttackIndex === undefined || !this.table[move.targetAttackIndex]) {
        return { valid: false, reasonLt: 'Nenurodyta atakos korta, kurią norite mušti.' };
      }
      const targetBout = this.table[move.targetAttackIndex];
      if (targetBout.defense !== null) {
        return { valid: false, reasonLt: 'Ši korta jau yra sumušta.' };
      }
      if (!this.canBeat(targetBout.attack, move.card)) {
        if (!this.isNoTrump && targetBout.attack.suit === this.trumpSuit && move.card.suit !== this.trumpSuit) {
          return { valid: false, reasonLt: 'Kozirį galima mušti tik aukštesniu koziriu.' };
        }
        return { valid: false, reasonLt: 'Korta nėra aukštesnė tos pačios spalvos korta ar tinkamas koziris.' };
      }
      return { valid: true };
    }

    // 4. Move: TRANSFER (Perevodnoy)
    if (move.type === 'transfer') {
      const isTransferAllowed =
        this.customConfig.transfer.enabled ||
        this.options.variant === 'perevodnoy_durak' ||
        this.options.variant === 'custom_mix';

      if (!isTransferAllowed) {
        return { valid: false, reasonLt: 'Perdavimas išjungtas nustatymuose.' };
      }
      if (!isDefender) {
        return { valid: false, reasonLt: 'Tik gynėjas gali perduoti ataką.' };
      }
      if (this.customConfig.transfer.only_before_defense && this.table.some((b) => b.defense !== null)) {
        return { valid: false, reasonLt: 'Kai bent viena korta jau sumušta, perduoti atakos nebegalima.' };
      }
      if (this.table.length === 0) {
        return { valid: false, reasonLt: 'Nėra atakos, kurios būtų galima perduoti.' };
      }
      if (!move.card || !this.hasCard(player, move.card)) {
        return { valid: false, reasonLt: 'Neturite šios kortos rankoje.' };
      }

      // Custom rule: king_no_transfer
      if (this.hasCustomRule('king_no_transfer') && move.card.rank === 'K') {
        return { valid: false, reasonLt: 'Karalius draudžia perdavimą pagal namų taisyklę.' };
      }

      // Check card rank against attack cards
      const attackRank = this.table[0].attack.rank;
      if (move.card.rank !== attackRank) {
        return { valid: false, reasonLt: `Perdavimui reikalinga korta su rangu ${attackRank}.` };
      }

      // Check trump reveal rule
      if (move.revealOnly) {
        if (!this.customConfig.transfer.allow_trump_reveal_transfer && !this.hasCustomRule('trump_reveal_transfer')) {
          return { valid: false, reasonLt: 'Kozirio parodymo perdavimas išjungtas taisyklėse.' };
        }
        if (move.card.suit !== this.trumpSuit) {
          return { valid: false, reasonLt: 'Parodant perduoti galima tik turint kozirį.' };
        }
      }

      // Next defender capacity check
      if (this.customConfig.transfer.require_enough_cards_for_next_defender) {
        const nextDefenderIndex = this.getNextActivePlayerIndex(this.defenderIndex);
        const nextDefender = this.players[nextDefenderIndex];
        const newAttackingCardsCount = this.table.length + (move.revealOnly ? 0 : 1);
        if (nextDefender.hand.length < newAttackingCardsCount) {
          return {
            valid: false,
            reasonLt: `Sekantis žaidėjas (${nextDefender.name}) turi per mažai kortų (${nextDefender.hand.length}), kad priimtų perdavimą.`,
          };
        }
      }

      return { valid: true };
    }

    // 5. Move: TAKE (Defender gives up and takes all table cards)
    if (move.type === 'take') {
      if (!isDefender) {
        return { valid: false, reasonLt: 'Tik gynėjas gali paimti stalo kortas.' };
      }
      if (this.table.length === 0) {
        return { valid: false, reasonLt: 'Stalas tuščias, nėra ko imti.' };
      }
      return { valid: true };
    }

    // 6. Move: PASS (Attacker or co-attacker has no more cards to add / done)
    if (move.type === 'pass') {
      if (isDefender) {
        return { valid: false, reasonLt: 'Gynėjas negali pasuoti – turi mušti arba imti.' };
      }
      return { valid: true };
    }

    return { valid: false, reasonLt: 'Nežinomas ėjimo tipas.' };
  }

  public executeMove(move: Move): boolean {
    const val = this.validateMove(move);
    if (!val.valid) {
      this.lastRefereeMessage = val.reasonLt || 'Neleistinas ėjimas.';
      return false;
    }

    const player = this.players[move.playerId];

    if (move.type === 'attack') {
      this.removeCard(player, move.card!);
      this.table.push({ attack: move.card!, defense: null });
      this.passes.clear();
      this.lastRefereeMessage = `${player.name} puola su ${this.formatCard(move.card!)}.`;
    } else if (move.type === 'throw_in') {
      this.removeCard(player, move.card!);
      this.table.push({ attack: move.card!, defense: null });
      this.passes.clear();
      this.lastRefereeMessage = `${player.name} primeta ${this.formatCard(move.card!)}.`;
    } else if (move.type === 'beat') {
      this.removeCard(player, move.card!);
      this.table[move.targetAttackIndex!].defense = move.card!;
      this.passes.clear();
      this.lastRefereeMessage = `${player.name} sumuša ${this.formatCard(this.table[move.targetAttackIndex!].attack)} su ${this.formatCard(move.card!)}.`;
    } else if (move.type === 'transfer') {
      if (!move.revealOnly) {
        this.removeCard(player, move.card!);
        this.table.push({ attack: move.card!, defense: null });
      }
      const prevDefender = this.defenderIndex;
      this.defenderIndex = this.getNextActivePlayerIndex(this.defenderIndex);
      this.attackerIndex = prevDefender; // Old defender becomes attacker/co-attacker
      this.passes.clear();
      this.lastRefereeMessage = `${player.name} ${move.revealOnly ? 'parodė kozirį ir perdavė' : 'perdavė'} ataką žaidėjui ${this.players[this.defenderIndex].name}!`;
    } else if (move.type === 'take') {
      this.defenderTaking = true;
      this.passes.clear();
      this.lastRefereeMessage = `${player.name} pasiduoda ir ims stalo kortas. Kiti žaidėjai gali primesti.`;
    } else if (move.type === 'pass') {
      this.passes.add(move.playerId);
      this.lastRefereeMessage = `${player.name}: Bita / Nebeturiu ką mesti.`;
    }

    this.checkRoundProgression();
    return true;
  }

  private checkRoundProgression(): void {
    const activeAttackers = this.players.filter(
      (p, idx) => !p.isExited && idx !== this.defenderIndex
    );
    const allAttackersPassed = activeAttackers.every((p) => this.passes.has(p.id));

    // Case 1: Defender beat all cards AND all attackers passed
    const allBeaten = this.table.length > 0 && this.table.every((b) => b.defense !== null);
    if (allBeaten && allAttackersPassed) {
      this.endRoundBeaten();
      return;
    }

    // Case 2: Defender decided to take, and all attackers passed
    if (this.defenderTaking && allAttackersPassed) {
      this.endRoundTaken();
      return;
    }
  }

  private endRoundBeaten(): void {
    for (const b of this.table) {
      this.discardPile.push(b.attack);
      if (b.defense) this.discardPile.push(b.defense);
    }
    this.table = [];
    this.drawCards();

    this.lastRefereeMessage = `Visos kortos sumuštos! Kortos keliauja į bitą.`;

    // Next attacker is the defender who defended
    this.roundNumber++;
    this.defenderTaking = false;
    this.passes.clear();

    // Rotating trump rule
    if (this.customConfig.deck.trump_rule === 'rotating_suit') {
      const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
      this.trumpSuit = suits[(this.roundNumber - 1) % suits.length];
    }

    this.checkExits();
    if (this.gameOver) return;

    // Defender becomes next attacker if still has cards
    if (!this.players[this.defenderIndex].isExited) {
      this.attackerIndex = this.defenderIndex;
    } else {
      this.attackerIndex = this.getNextActivePlayerIndex(this.defenderIndex);
    }
    this.defenderIndex = this.getNextActivePlayerIndex(this.attackerIndex);
  }

  private endRoundTaken(): void {
    const defender = this.players[this.defenderIndex];
    for (const b of this.table) {
      defender.hand.push(b.attack);
      if (b.defense) defender.hand.push(b.defense);
    }
    this.table = [];
    this.drawCards();

    this.lastRefereeMessage = `${defender.name} pasiėmė visas stalo kortas.`;

    this.roundNumber++;
    this.defenderTaking = false;
    this.passes.clear();

    // Rotating trump rule
    if (this.customConfig.deck.trump_rule === 'rotating_suit') {
      const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
      this.trumpSuit = suits[(this.roundNumber - 1) % suits.length];
    }

    this.checkExits();
    if (this.gameOver) return;

    // Attacker passes to player left of defender
    this.attackerIndex = this.getNextActivePlayerIndex(this.defenderIndex);
    this.defenderIndex = this.getNextActivePlayerIndex(this.attackerIndex);
  }

  private drawCards(): void {
    if (this.deck.length === 0) return;

    // Order: first attacker, then clockwise other attackers, then defender last
    const drawOrder: number[] = [];
    let cur = this.attackerIndex;
    while (!drawOrder.includes(cur)) {
      if (cur !== this.defenderIndex && !this.players[cur].isExited) {
        drawOrder.push(cur);
      }
      cur = (cur + 1) % this.players.length;
    }
    if (!this.players[this.defenderIndex].isExited) {
      drawOrder.push(this.defenderIndex);
    }

    const handLimit = this.customConfig.hand.max_size || 6;
    for (const pIdx of drawOrder) {
      const p = this.players[pIdx];
      while (p.hand.length < handLimit && this.deck.length > 0) {
        p.hand.push(this.deck.shift()!);
      }
    }
  }

  private checkExits(): void {
    if (this.deck.length > 0) return;

    const remainingActive: PlayerState[] = [];
    for (const p of this.players) {
      if (!p.isExited && p.hand.length === 0) {
        p.isExited = true;
        this.winnersList.push(p.id);
        p.exitRank = this.winnersList.length;
      }
      if (!p.isExited) {
        remainingActive.push(p);
      }
    }

    // Team mode evaluation
    if (this.customConfig.team_mode.enabled) {
      const teamRemaining = new Map<string, PlayerState[]>();
      for (const p of this.players) {
        const tId = p.teamId || 'Default';
        if (!teamRemaining.has(tId)) teamRemaining.set(tId, []);
        if (!p.isExited) teamRemaining.get(tId)!.push(p);
      }

      const activeTeams = Array.from(teamRemaining.entries()).filter(([, members]) => members.length > 0);

      if (activeTeams.length === 0) {
        this.gameOver = true;
        this.isDraw = true;
        this.lastRefereeMessage = 'Lygiosios! Visos komandos išėjo kartu.';
        return;
      } else if (activeTeams.length === 1 && teamRemaining.size > 1) {
        this.gameOver = true;
        this.loserPlayerId = activeTeams[0][1][0]?.id ?? null;
        this.lastRefereeMessage = `Komandinis žaidimas baigtas! Pralaimėjo ${activeTeams[0][0]}.`;
        return;
      }
    }

    if (remainingActive.length === 0) {
      this.gameOver = true;
      this.isDraw = true;
      this.lastRefereeMessage = 'Lygiosios! Nėra durniaus – abu paskutiniai žaidėjai išėjo kartu.';
    } else if (remainingActive.length === 1) {
      this.gameOver = true;
      this.loserPlayerId = remainingActive[0].id;
      this.lastRefereeMessage = `Žaidimas baigtas! Durnius (pralaimėtojas) yra ${remainingActive[0].name}!`;
    }
  }

  public getLegalMovesForPlayer(playerId: number): Move[] {
    if (this.gameOver) return [];
    const player = this.players[playerId];
    if (!player || player.isExited) return [];

    const moves: Move[] = [];
    const isDefender = playerId === this.defenderIndex;

    if (isDefender) {
      if (!this.defenderTaking) {
        // Can take
        if (this.table.length > 0) {
          moves.push({ type: 'take', playerId });
        }

        // Can beat
        for (let tIdx = 0; tIdx < this.table.length; tIdx++) {
          if (this.table[tIdx].defense === null) {
            for (const c of player.hand) {
              if (this.canBeat(this.table[tIdx].attack, c)) {
                moves.push({ type: 'beat', playerId, card: c, targetAttackIndex: tIdx });
              }
            }
          }
        }

        // Can transfer (perevodnoy)
        if (this.options.variant === 'perevodnoy_durak' && this.table.length > 0 && this.table.every((b) => b.defense === null)) {
          const reqRank = this.table[0].attack.rank;
          for (const c of player.hand) {
            if (c.rank === reqRank) {
              const testMove: Move = { type: 'transfer', playerId, card: c };
              if (this.validateMove(testMove).valid) {
                moves.push(testMove);
              }
            }
          }
        }
      }
    } else {
      // Attacker or Co-attacker
      if (this.table.length === 0) {
        if (playerId === this.attackerIndex) {
          for (const c of player.hand) {
            moves.push({ type: 'attack', playerId, card: c });
          }
        }
      } else {
        // Throw-in
        for (const c of player.hand) {
          const testMove: Move = { type: 'throw_in', playerId, card: c };
          if (this.validateMove(testMove).valid) {
            moves.push(testMove);
          }
        }
        // Can pass / bita
        moves.push({ type: 'pass', playerId });
      }
    }

    return moves;
  }

  public toSpecOutputFormat(forPlayerId: number = 0): SerializedGameState {
    const player = this.players[forPlayerId] || this.players[0];
    const legalMoves = this.getLegalMovesForPlayer(forPlayerId).map((m) => {
      if (m.type === 'beat') return `beat with ${this.formatCard(m.card!)}`;
      if (m.type === 'take') return 'take';
      if (m.type === 'transfer') return `transfer with ${this.formatCard(m.card!)}`;
      if (m.type === 'throw_in') return `throw in ${this.formatCard(m.card!)}`;
      if (m.type === 'attack') return `attack with ${this.formatCard(m.card!)}`;
      if (m.type === 'pass') return 'pass / bita';
      return m.type;
    });

    return {
      trump_suit: this.trumpSuit,
      trump_card: this.trumpCard,
      deck_count: this.deck.length,
      discard_count: this.discardPile.length,
      attacker: this.players[this.attackerIndex]?.name || '',
      defender: this.players[this.defenderIndex]?.name || '',
      table: this.table.map((b) => ({
        attack: this.formatCard(b.attack),
        defense: b.defense ? this.formatCard(b.defense) : null,
      })),
      your_hand: player.hand.map((c) => this.formatCard(c)),
      legal_moves: Array.from(new Set(legalMoves)),
      current_turn: this.defenderTaking
        ? 'Puolėjai primeta arba sako Bita'
        : (this.table.some((b) => b.defense === null) ? `Gynėjas (${this.players[this.defenderIndex]?.name})` : `Puolėjas (${this.players[this.attackerIndex]?.name})`),
      status_message_lt: this.lastRefereeMessage,
    };
  }

  public formatCard(card: Card): string {
    const symbol = SUIT_SYMBOLS[card.suit];
    return `${card.rank}${symbol}`;
  }

  private hasCard(player: PlayerState, card: Card): boolean {
    return player.hand.some((c) => c.suit === card.suit && c.rank === card.rank);
  }

  private removeCard(player: PlayerState, card: Card): void {
    const idx = player.hand.findIndex((c) => c.suit === card.suit && c.rank === card.rank);
    if (idx !== -1) {
      player.hand.splice(idx, 1);
    }
  }
}
