import type { DurakCustomConfig } from './GameSetupConfig';

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | '3' | '4' | '5';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

export const SUIT_NAMES_LT: Record<Suit, string> = {
  clubs: 'Kryžiai (Giliukai)',
  diamonds: 'Būgnai',
  hearts: 'Širdys (Čirvai)',
  spades: 'Vynai (Pikai)',
};

export const RANK_NAMES_LT: Partial<Record<Rank, string>> = {
  J: 'Bubis',
  Q: 'Dama',
  K: 'Karalius',
  A: 'Tūzas',
};

export const STANDARD_RANKS_36: Rank[] = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const EXTENDED_RANKS_52: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export type GameVariant = 'podkidnoy_durak' | 'perevodnoy_durak' | 'custom_mix';

export interface GameOptions {
  variant: GameVariant;
  playerCount: number; // 2..8
  deckSize: 36 | 52;
  firstRoundAttackLimit: number;
  allowTrumpRevealTransfer: boolean;
  throwInOrder: 'clockwise' | 'free_for_all' | 'attacker_first_then_clockwise' | 'only_attacker' | 'team_members_first';
  partnerMode: boolean;
  customConfig?: DurakCustomConfig;
}

export interface TableBout {
  attack: Card;
  defense: Card | null;
}

export interface PlayerState {
  id: number;
  name: string;
  isAi: boolean;
  hand: Card[];
  isExited: boolean;
  exitRank: number | null; // 1st winner, 2nd winner, etc.
  teamId?: string;
  pairId?: string;
  score?: number;
}

export interface Move {
  type: 'attack' | 'throw_in' | 'beat' | 'transfer' | 'take' | 'pass';
  playerId: number;
  card?: Card;
  targetAttackIndex?: number;
  revealOnly?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  reasonLt?: string;
  ruleBroken?: string;
}

export interface SerializedGameState {
  trump_suit: Suit;
  trump_card: Card | null;
  deck_count: number;
  discard_count: number;
  attacker: string;
  defender: string;
  table: Array<{ attack: string; defense: string | null }>;
  your_hand: string[];
  legal_moves: string[];
  current_turn: string;
  status_message_lt: string;
}

