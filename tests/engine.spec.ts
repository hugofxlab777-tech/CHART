import { test, expect } from '@playwright/test';
import { DurakEngine } from '../src/engine/DurakEngine';
import { type Card } from '../src/engine/types';

test.describe('Durak Engine & Referee Specification Validation', () => {
  test('Few-Shot 1: Trump beats any non-trump and higher rank beats lower in same suit', () => {
    const engine = new DurakEngine({ variant: 'podkidnoy_durak', playerCount: 2 });
    engine.initGame();

    // Set custom scenario: Trump is hearts
    engine.trumpSuit = 'hearts';
    const card8S: Card = { id: '8_spades', rank: '8', suit: 'spades' };
    const card9S: Card = { id: '9_spades', rank: '9', suit: 'spades' };
    const card6H: Card = { id: '6_hearts', rank: '6', suit: 'hearts' };
    const cardKD: Card = { id: 'K_diamonds', rank: 'K', suit: 'diamonds' };

    // 9S beats 8S (same suit, higher)
    expect(engine.canBeat(card8S, card9S)).toBe(true);

    // 6H (trump) beats 8S (non-trump)
    expect(engine.canBeat(card8S, card6H)).toBe(true);

    // KD cannot beat 8S (different non-trump suit)
    expect(engine.canBeat(card8S, cardKD)).toBe(false);
  });

  test('Few-Shot 2: Throw-in requires matching rank already on table', () => {
    const engine = new DurakEngine({ variant: 'podkidnoy_durak', playerCount: 3 });
    engine.initGame();

    engine.attackerIndex = 0;
    engine.defenderIndex = 1;
    engine.players[1].hand = [
      { id: 'K_spades', rank: 'K', suit: 'spades' },
      { id: 'Q_spades', rank: 'Q', suit: 'spades' },
    ];

    // Table: 8S beaten by 9S
    engine.table = [
      {
        attack: { id: '8_spades', rank: '8', suit: 'spades' },
        defense: { id: '9_spades', rank: '9', suit: 'spades' },
      },
    ];

    const thirdPlayerId = 2;
    engine.players[thirdPlayerId].hand = [
      { id: '9_diamonds', rank: '9', suit: 'diamonds' },
      { id: '7_clubs', rank: '7', suit: 'clubs' },
    ];

    // 9D throw-in is VALID (9 is on table)
    const validMove = engine.validateMove({
      type: 'throw_in',
      playerId: thirdPlayerId,
      card: { id: '9_diamonds', rank: '9', suit: 'diamonds' },
    });
    expect(validMove.valid).toBe(true);

    // 7C throw-in is INVALID (7 is not on table)
    const invalidMove = engine.validateMove({
      type: 'throw_in',
      playerId: thirdPlayerId,
      card: { id: '7_clubs', rank: '7', suit: 'clubs' },
    });
    expect(invalidMove.valid).toBe(false);
  });

  test('Few-Shot 3: Perevodnoy transfer before beating cards', () => {
    const engine = new DurakEngine({ variant: 'perevodnoy_durak', playerCount: 3 });
    engine.initGame();

    engine.attackerIndex = 0;
    engine.defenderIndex = 1;

    // Attacker plays 10C
    engine.table = [{ attack: { id: '10_clubs', rank: '10', suit: 'clubs' }, defense: null }];

    const defender = engine.players[1];
    defender.hand = [
      { id: '10_diamonds', rank: '10', suit: 'diamonds' },
      { id: 'A_clubs', rank: 'A', suit: 'clubs' },
    ];

    // Next player has 4 cards
    engine.players[2].hand = [
      { id: '6_spades', rank: '6', suit: 'spades' },
      { id: '7_spades', rank: '7', suit: 'spades' },
      { id: '8_spades', rank: '8', suit: 'spades' },
      { id: '9_spades', rank: '9', suit: 'spades' },
    ];

    const transferMove = engine.validateMove({
      type: 'transfer',
      playerId: 1,
      card: { id: '10_diamonds', rank: '10', suit: 'diamonds' },
    });
    expect(transferMove.valid).toBe(true);
  });

  test('Few-Shot 4: Perevodnoy cannot transfer after a card was already beaten', () => {
    const engine = new DurakEngine({ variant: 'perevodnoy_durak', playerCount: 3 });
    engine.initGame();

    engine.table = [
      {
        attack: { id: '7_hearts', rank: '7', suit: 'hearts' },
        defense: { id: '9_hearts', rank: '9', suit: 'hearts' },
      },
    ];

    const defender = engine.players[engine.defenderIndex];
    defender.hand = [{ id: '7_spades', rank: '7', suit: 'spades' }];

    const transferMove = engine.validateMove({
      type: 'transfer',
      playerId: engine.defenderIndex,
      card: { id: '7_spades', rank: '7', suit: 'spades' },
    });

    expect(transferMove.valid).toBe(false);
    expect(transferMove.reasonLt).toContain('jau sumušta');
  });
});
