import { DurakEngine } from './DurakEngine';
import { type Move } from './types';

export class DurakAI {
  constructor(private engine: DurakEngine) {}

  public getBestMove(playerId: number): Move | null {
    const legalMoves = this.engine.getLegalMovesForPlayer(playerId);
    if (legalMoves.length === 0) return null;

    const difficulty = this.engine.customConfig.players.ai_difficulty || 'normal';

    if (difficulty === 'easy') {
      // Easy: mostly random selection among attack/beat or take
      const playable = legalMoves.filter((m) => m.type !== 'pass' && m.type !== 'take');
      if (playable.length > 0 && Math.random() > 0.3) {
        return playable[Math.floor(Math.random() * playable.length)];
      }
      return legalMoves[Math.floor(Math.random() * legalMoves.length)];
    }

    const isDefender = playerId === this.engine.defenderIndex;

    // Team check: is defender a teammate?
    const player = this.engine.players[playerId];
    const defender = this.engine.players[this.engine.defenderIndex];
    const isTeammateDefender =
      this.engine.customConfig.team_mode.enabled &&
      player.teamId &&
      defender.teamId &&
      player.teamId === defender.teamId;

    // If teammate is defending and we are co-attacker, pass to protect teammate
    if (!isDefender && isTeammateDefender) {
      const passMove = legalMoves.find((m) => m.type === 'pass');
      if (passMove) return passMove;
    }

    if (isDefender) {
      return this.chooseDefenseMove(playerId, legalMoves, difficulty);
    } else {
      return this.chooseAttackMove(playerId, legalMoves, difficulty);
    }
  }

  private chooseAttackMove(playerId: number, moves: Move[], difficulty: string): Move {
    const attackOrThrow = moves.filter((m) => m.type === 'attack' || m.type === 'throw_in');
    if (attackOrThrow.length === 0) {
      return moves.find((m) => m.type === 'pass') || moves[0];
    }

    const player = this.engine.players[playerId];
    const rankCounts: Record<string, number> = {};
    for (const c of player.hand) {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    }

    attackOrThrow.sort((a, b) => {
      const cardA = a.card!;
      const cardB = b.card!;
      const isTrumpA = !this.engine.isNoTrump && cardA.suit === this.engine.trumpSuit;
      const isTrumpB = !this.engine.isNoTrump && cardB.suit === this.engine.trumpSuit;

      if (isTrumpA !== isTrumpB) {
        return isTrumpA ? 1 : -1; // non-trump first
      }

      // If both non-trumps or both trumps: prefer card with highest count in hand (pairs)
      const countA = rankCounts[cardA.rank] || 1;
      const countB = rankCounts[cardB.rank] || 1;
      if (countA !== countB && !isTrumpA) {
        return countB - countA;
      }

      // In hard/insane: prioritize getting rid of lowest ranks first
      const valA = this.engine.getRankValue(cardA.rank);
      const valB = this.engine.getRankValue(cardB.rank);
      return valA - valB;
    });

    // Insane mode: if defender already taking, throw in all non-trumps aggressively
    if (difficulty === 'insane' && this.engine.defenderTaking) {
      const nonTrumpThrow = attackOrThrow.find((m) => m.card?.suit !== this.engine.trumpSuit);
      if (nonTrumpThrow) return nonTrumpThrow;
    }

    return attackOrThrow[0];
  }

  private chooseDefenseMove(_playerId: number, moves: Move[], difficulty: string): Move {
    // 1. In Perevodnoy: check if transferring is viable
    const transferMoves = moves.filter((m) => m.type === 'transfer');
    if (transferMoves.length > 0) {
      const nonTrumpTransfer = transferMoves.find((m) => m.card?.suit !== this.engine.trumpSuit);
      if (nonTrumpTransfer) return nonTrumpTransfer;
      if (this.engine.table.length >= 2 || difficulty === 'insane') return transferMoves[0];
    }

    // 2. Filter beat moves
    const beatMoves = moves.filter((m) => m.type === 'beat');
    if (beatMoves.length > 0) {
      beatMoves.sort((a, b) => {
        const cardA = a.card!;
        const cardB = b.card!;
        const isTrumpA = !this.engine.isNoTrump && cardA.suit === this.engine.trumpSuit;
        const isTrumpB = !this.engine.isNoTrump && cardB.suit === this.engine.trumpSuit;

        if (isTrumpA !== isTrumpB) {
          return isTrumpA ? 1 : -1;
        }

        return this.engine.getRankValue(cardA.rank) - this.engine.getRankValue(cardB.rank);
      });

      const bestBeat = beatMoves[0];
      const isTrumpBeat = !this.engine.isNoTrump && bestBeat.card?.suit === this.engine.trumpSuit;
      const rankVal = this.engine.getRankValue(bestBeat.card!.rank);

      // In hard / insane: if beat requires wasting Ace or King trump early and table is small, take
      if (
        (difficulty === 'hard' || difficulty === 'insane') &&
        isTrumpBeat &&
        rankVal >= 7 &&
        this.engine.deck.length > 8 &&
        this.engine.table.length <= 2
      ) {
        const takeMove = moves.find((m) => m.type === 'take');
        if (takeMove) return takeMove;
      }

      return bestBeat;
    }

    // Otherwise take
    const take = moves.find((m) => m.type === 'take');
    return take || moves[0];
  }
}
