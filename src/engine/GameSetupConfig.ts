import { Rank, STANDARD_RANKS_36 } from './types';

export type GameVariantType = 'podkidnoy_durak' | 'perevodnoy_durak' | 'custom_mix';
export type GameModeType = 'solo' | 'teams' | 'mixed';
export type AiDifficulty = 'easy' | 'normal' | 'hard' | 'insane';
export type TeamFormation = 'opposite_seats' | 'adjacent_seats' | 'random_assignment' | 'player_choice';
export type TeamWinCondition = 'first_team_to_empty_all_hands' | 'last_team_with_cards_loses' | 'most_cards_discarded';
export type TrumpRule = 'standard_bottom_card' | 'random' | 'no_trump' | 'player_choice' | 'rotating_suit';
export type FirstAttackerRule = 'lowest_trump_holder' | 'random' | 'previous_loser' | 'chosen_player' | 'team_captain';
export type ThrowInOrder = 'attacker_first_then_clockwise' | 'free_for_all' | 'only_attacker' | 'team_members_first';
export type TransferRankRule = 'same_rank_any_suit' | 'same_rank_trump_only' | 'same_rank_any_suit_plus_trump_reveal';
export type WinnerRule = 'first_to_empty_hand_wins' | 'last_player_is_durnius' | 'both';
export type DrawRule = 'draw' | 'last_to_take_cards_is_durnius' | 'replay';

export interface CustomRuleDef {
  id: string;
  name: string;
  type: string;
  description?: string;
}

export const AVAILABLE_CUSTOM_RULES: CustomRuleDef[] = [
  { id: 'no_trump_first_round', name: 'Draudžiama mesti kozirius pirmame raunde', type: 'restriction' },
  { id: 'no_trump_attack', name: 'Draudžiama pulti koziriais', type: 'restriction' },
  { id: 'ace_beats_everything', name: 'Tūzas atmuša bet ką', type: 'power_card' },
  { id: 'six_returns', name: 'Šešakė grąžina ataką', type: 'special_card' },
  { id: 'seven_draw_extra', name: 'Septynakė priverčia traukti kortą', type: 'special_card' },
  { id: 'eight_skip_turn', name: 'Aštuonakė praleidžia ėjimą', type: 'special_card' },
  { id: 'nine_swap_hand', name: 'Devynakė apkeičia rankas', type: 'special_card' },
  { id: 'ten_draw_two', name: 'Dešimtukė priverčia traukti dvi kortas', type: 'special_card' },
  { id: 'jack_reverse_direction', name: 'Bubis keičia eigą', type: 'special_card' },
  { id: 'queen_protect', name: 'Dama apsaugo nuo mėtymo', type: 'special_card' },
  { id: 'king_no_transfer', name: 'Karalius draudžia perdavimą', type: 'special_card' },
  { id: 'ace_no_take', name: 'Tūzas draudžia imti kortas', type: 'special_card' },
  { id: 'trump_reveal_transfer', name: 'Kozirio parodymo perdavimas', type: 'transfer_rule' },
  { id: 'forced_take_after_3_losses', name: 'Po 3 pralaimėjimų – privaloma imti', type: 'penalty' },
  { id: 'no_attack_same_player_twice', name: 'Draudžiama pulti tą patį žaidėją du kartus iš eilės', type: 'restriction' },
  { id: 'must_attack_lowest_card', name: 'Privaloma pulti žemiausia korta', type: 'restriction' },
  { id: 'no_discard_visibility', name: 'Atliekos nematomos', type: 'interface' },
  { id: 'blind_play', name: 'Aklas žaidimas', type: 'interface' },
  { id: 'speed_mode', name: 'Greito žaidimo režimas', type: 'interface' },
  { id: 'chaos_mode', name: 'Chaos režimas', type: 'modifier' },
  { id: 'team_mode', name: 'Komandinis režimas', type: 'team' },
  { id: 'pair_mode', name: 'Porų režimas (2v2)', type: 'team' },
  { id: 'no_help_from_others', name: 'Tik puolėjas gali mesti', type: 'restriction' },
  { id: 'double_penalty_trump_loss', name: 'Dviguba bauda už kozirio praradimą', type: 'penalty' },
  { id: 'reverse_trump', name: 'Atvirkštinis koziris', type: 'modifier' },
  { id: 'no_peeking', name: 'Draudžiama žiūrėti atliekas', type: 'restriction' },
  { id: 'hand_swap_on_loss', name: 'Rankų apsikeitimas po pralaimėjimo', type: 'special_rule' },
  { id: 'trump_hunter', name: 'Kozirių medžiotojas', type: 'bonus' },
  { id: 'low_card_bonus', name: 'Žemos kortos bonusas', type: 'bonus' },
  { id: 'no_second_chance', name: 'Be antros galimybės', type: 'restriction' },
  { id: 'mirror_mode', name: 'Veidrodžio režimas', type: 'modifier' },
  { id: 'random_trump_each_round', name: 'Atsitiktinis koziris kiekvieną raundą', type: 'modifier' },
  {
    id: 'team_shared_trump_knowledge',
    name: 'Komanda žino kozirius',
    description: 'Komandos nariai žino, kiek kozirių turi jų komandos narys.',
    type: 'team',
  },
  {
    id: 'pair_sacrifice',
    name: 'Poros auka',
    description: 'Poros narys gali aukoti savo kozirį, kad išgelbėtų poros narį nuo kortų ėmimo.',
    type: 'team',
  },
  {
    id: 'team_attack_bonus',
    name: 'Komandinio puolimo bonusas',
    description: 'Jei abu komandos nariai mesti kortas, maksimalus kortų skaičius padidėja +2.',
    type: 'team',
  },
  {
    id: 'pair_sync_attack',
    name: 'Sinchronizuotas poros puolimas',
    description: 'Poros nariai privalo mesti to paties rango kortas.',
    type: 'team',
  },
];

export interface DurakCustomConfig {
  game_variant: GameVariantType;
  game_mode: GameModeType;
  players: {
    count: number;
    names: string[];
    human_players: string[];
    ai_difficulty: AiDifficulty;
  };
  team_mode: {
    enabled: boolean;
    team_count: number;
    team_size: number;
    team_formation: TeamFormation;
    team_names: string[];
    team_members: Record<string, string[]>;
    shared_hand: boolean;
    allow_team_communication: boolean;
    team_score_shared: 'shared' | 'individual';
    team_win_condition: TeamWinCondition;
    team_elimination: boolean;
    team_penalty: boolean;
  };
  pair_mode: {
    enabled: boolean;
    pair_count: number;
    pair_formation: string;
    pair_members: Record<string, string[]>;
    pair_shared_victory: 'shared' | 'individual';
    pair_attack_coordination: boolean;
    pair_defense_coordination: boolean;
    pair_transfer_allowed: boolean;
    pair_score_shared: boolean;
  };
  deck: {
    size: 36 | 52;
    ranks: Rank[];
    trump_rule: TrumpRule;
    first_attacker_rule?: FirstAttackerRule;
  };
  hand: {
    starting_size: number;
    max_size: number;
  };
  attack: {
    max_cards_per_round: number;
    first_round_max_cards: number;
    limit_by_defender_hand: boolean;
    allow_same_rank_throw_in: boolean;
    throw_in_order: ThrowInOrder;
    allow_trump_throw_in: boolean;
    allow_pairs_attack: boolean;
    allow_multiple_suits_attack: boolean;
    allow_attack_after_transfer: boolean;
  };
  transfer: {
    enabled: boolean;
    only_before_defense: boolean;
    rank_rule: TransferRankRule;
    allow_trump_reveal_transfer: boolean;
    chain_limit: 'unlimited' | '1' | '2' | '3';
    require_enough_cards_for_next_defender: boolean;
    allow_transfer_to_any_player: 'next_player_only' | 'any_player' | 'team_members_only';
    transfer_back_to_attacker: boolean;
  };
  endgame: {
    winner_rule: WinnerRule;
    draw_rule: DrawRule;
    multi_round_game: boolean;
    score_system: boolean;
    elimination_mode: boolean;
    loser_penalty: boolean;
  };
  interface: {
    show_ai_hands: boolean;
    show_teammate_hand: boolean;
    show_discard_pile: boolean;
    show_card_count: boolean;
    suggest_best_move: boolean;
    explain_illegal_moves: boolean;
    auto_play_ai_turns: boolean;
    show_possible_moves: boolean;
    show_trump_card: boolean;
    show_team_score: boolean;
  };
  custom_rules: string[];
  validated: boolean;
}

export const DEFAULT_DURAK_CONFIG: DurakCustomConfig = {
  game_variant: 'podkidnoy_durak',
  game_mode: 'solo',
  players: {
    count: 2,
    names: ['Tu', 'AI-1'],
    human_players: ['Tu'],
    ai_difficulty: 'normal',
  },
  team_mode: {
    enabled: false,
    team_count: 2,
    team_size: 2,
    team_formation: 'opposite_seats',
    team_names: ['Komanda A', 'Komanda B'],
    team_members: {},
    shared_hand: false,
    allow_team_communication: false,
    team_score_shared: 'shared',
    team_win_condition: 'first_team_to_empty_all_hands',
    team_elimination: true,
    team_penalty: false,
  },
  pair_mode: {
    enabled: false,
    pair_count: 2,
    pair_formation: 'opposite_seats',
    pair_members: {},
    pair_shared_victory: 'shared',
    pair_attack_coordination: true,
    pair_defense_coordination: false,
    pair_transfer_allowed: false,
    pair_score_shared: true,
  },
  deck: {
    size: 36,
    ranks: [...STANDARD_RANKS_36],
    trump_rule: 'standard_bottom_card',
    first_attacker_rule: 'lowest_trump_holder',
  },
  hand: {
    starting_size: 6,
    max_size: 6,
  },
  attack: {
    max_cards_per_round: 6,
    first_round_max_cards: 5,
    limit_by_defender_hand: true,
    allow_same_rank_throw_in: true,
    throw_in_order: 'attacker_first_then_clockwise',
    allow_trump_throw_in: true,
    allow_pairs_attack: true,
    allow_multiple_suits_attack: true,
    allow_attack_after_transfer: true,
  },
  transfer: {
    enabled: false,
    only_before_defense: true,
    rank_rule: 'same_rank_any_suit',
    allow_trump_reveal_transfer: false,
    chain_limit: 'unlimited',
    require_enough_cards_for_next_defender: true,
    allow_transfer_to_any_player: 'next_player_only',
    transfer_back_to_attacker: false,
  },
  endgame: {
    winner_rule: 'both',
    draw_rule: 'draw',
    multi_round_game: false,
    score_system: false,
    elimination_mode: true,
    loser_penalty: false,
  },
  interface: {
    show_ai_hands: false,
    show_teammate_hand: false,
    show_discard_pile: true,
    show_card_count: true,
    suggest_best_move: true,
    explain_illegal_moves: true,
    auto_play_ai_turns: true,
    show_possible_moves: true,
    show_trump_card: true,
    show_team_score: true,
  },
  custom_rules: [],
  validated: true,
};

export interface ValidationSummary {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateGameSetupConfig(config: DurakCustomConfig): ValidationSummary {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Players count check
  if (config.players.count < 2 || config.players.count > 8) {
    errors.push(`Žaidėjų skaičius turi būti tarp 2 ir 8 (dabar: ${config.players.count}).`);
  }

  // 2. Deck capacity vs starting cards
  const totalStartingCards = config.players.count * config.hand.starting_size;
  if (totalStartingCards > config.deck.size) {
    errors.push(
      `Nepakanka kortų kaladėje (${config.deck.size}) išdalinti po ${config.hand.starting_size} kortas ${config.players.count} žaidėjams (reikia ${totalStartingCards}). Pasirinkite 52 kortų kaladę arba mažesnį pradinį rankos dydį.`
    );
  } else if (config.deck.size - totalStartingCards < 2) {
    warnings.push(
      `Po pradinio išdalinimo kaladėje liks tik ${config.deck.size - totalStartingCards} kortos (-ų). Žaidimas bus labai trumpas.`
    );
  }

  // 3. Variant vs transfer
  if (config.game_variant === 'perevodnoy_durak' && !config.transfer.enabled) {
    warnings.push('Pasirinktas „perevodnoy_durak“ variantas, bet perdavimo taisyklė (transfer.enabled) išjungta. Ji bus įjungta automatiškai.');
    config.transfer.enabled = true;
  }
  if (config.game_variant === 'podkidnoy_durak' && config.transfer.enabled) {
    warnings.push('Metamojo durniaus (podkidnoy_durak) variante perdavimas paprastai nenaudojamas. Jei norite perdavimo, rekomenduojamas custom_mix arba perevodnoy_durak.');
  }

  // 4. Team & Pair modes
  if (config.game_mode === 'teams' || config.team_mode.enabled) {
    const totalTeamSlots = config.team_mode.team_count * config.team_mode.team_size;
    if (totalTeamSlots !== config.players.count) {
      warnings.push(
        `Komandų dydis (${config.team_mode.team_count} komandos po ${config.team_mode.team_size}) neatitinka bendro žaidėjų skaičiaus (${config.players.count}).`
      );
    }
  }

  if (config.pair_mode.enabled && config.players.count % 2 !== 0) {
    errors.push(`Porų režimui (2v2) reikalingas lyginis žaidėjų skaičius (dabartinis: ${config.players.count}).`);
  }

  // 5. Custom rules compatibility check
  const customSet = new Set(config.custom_rules);

  if (customSet.has('no_trump_attack') && customSet.has('trump_hunter')) {
    warnings.push('„Draudžiama pulti koziriais“ ir „Kozirių medžiotojas“ prieštarauja viena kitai taktikoje.');
  }

  if (config.deck.trump_rule === 'no_trump') {
    if (customSet.has('no_trump_first_round') || customSet.has('no_trump_attack') || customSet.has('reverse_trump')) {
      warnings.push('Kozirių taisyklės (no_trump_attack ir kt.) neturi prasmės, kai žaidžiama be kozirių (no_trump).');
    }
  }

  if (!config.transfer.enabled) {
    if (customSet.has('trump_reveal_transfer') || customSet.has('king_no_transfer')) {
      warnings.push('Perdavimo namų taisyklės (trump_reveal_transfer / king_no_transfer) yra neaktyvios, nes perdavimas išjungtas.');
    }
  }

  if (customSet.has('no_help_from_others') && config.attack.allow_same_rank_throw_in) {
    warnings.push('„Tik puolėjas gali mesti“ (no_help_from_others) riboja kitų žaidėjų primetimą, nors bazinė taisyklė leidžia primetimus.');
  }

  if (customSet.has('blind_play') && config.interface.show_card_count) {
    warnings.push('„Aklas žaidimas“ (blind_play) paprastai slepia kortų skaičių ir atliekas.');
  }

  const isTeam = config.game_mode === 'teams' || config.team_mode.enabled || config.pair_mode.enabled;
  if (!isTeam) {
    if (
      customSet.has('team_shared_trump_knowledge') ||
      customSet.has('pair_sacrifice') ||
      customSet.has('team_attack_bonus') ||
      customSet.has('pair_sync_attack')
    ) {
      warnings.push('Komandinės namų taisyklės parinktos solo režime. Jos bus taikomos tik įjungus komandų arba porų režimą.');
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
