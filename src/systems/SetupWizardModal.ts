import {
  type DurakCustomConfig,
  type GameVariantType,
  type GameModeType,
  type AiDifficulty,
  type TrumpRule,
  type FirstAttackerRule,
  type ThrowInOrder,
  AVAILABLE_CUSTOM_RULES,
  DEFAULT_DURAK_CONFIG,
  validateGameSetupConfig,
} from '../engine/GameSetupConfig';
import { STANDARD_RANKS_36, EXTENDED_RANKS_52 } from '../engine/types';
import { ModalManager, Toast } from './Ui';

export class SetupWizardModal {
  private container: HTMLElement;
  private currentConfig: DurakCustomConfig;
  private onStartGameCallback?: (config: DurakCustomConfig) => void;
  private activeTab: string = 'general';

  constructor(containerId: string = 'setup-modal') {
    let el = document.getElementById(containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = containerId;
      el.className = 'modal-overlay hidden';
      document.body.appendChild(el);
    }
    this.container = el;
    this.currentConfig = JSON.parse(JSON.stringify(DEFAULT_DURAK_CONFIG));
    this.render();
  }

  public setOnStartGame(callback: (config: DurakCustomConfig) => void): void {
    this.onStartGameCallback = callback;
  }

  public open(existingConfig?: DurakCustomConfig): void {
    if (existingConfig) {
      this.currentConfig = JSON.parse(JSON.stringify(existingConfig));
    }
    this.activeTab = 'general';
    this.render();
    ModalManager.open(this.container);
  }

  public close(): void {
    ModalManager.close(this.container);
  }

  public getConfig(): DurakCustomConfig {
    return this.currentConfig;
  }

  private render(): void {
    const val = validateGameSetupConfig(this.currentConfig);
    this.currentConfig.validated = val.valid;

    this.container.innerHTML = `
      <div class="modal-card modal-setup">
        <div class="modal-header">
          <div class="setup-header-title">
            <span class="setup-icon">⚙️</span>
            <div>
              <h3>Durak (Durnius) Konfigūratorius</h3>
              <p class="setup-subtitle">DURAK_CUSTOM_GAME_SETUP v1.2 • Teisėjo taisyklės ir nustatymai</p>
            </div>
          </div>
          <button id="btn-close-setup" class="btn-close" aria-label="Uždaryti">×</button>
        </div>

        <!-- Navigation Tabs -->
        <nav class="setup-tabs" role="tablist">
          <button class="setup-tab-btn ${this.activeTab === 'general' ? 'active' : ''}" data-tab="general">1. Bendra & Žaidėjai</button>
          <button class="setup-tab-btn ${this.activeTab === 'teams' ? 'active' : ''}" data-tab="teams">2. Komandos & Poros</button>
          <button class="setup-tab-btn ${this.activeTab === 'rules' ? 'active' : ''}" data-tab="rules">3. Kaladė & Ataka</button>
          <button class="setup-tab-btn ${this.activeTab === 'transfer' ? 'active' : ''}" data-tab="transfer">4. Perdavimas & Pabaiga</button>
          <button class="setup-tab-btn ${this.activeTab === 'custom' ? 'active' : ''}" data-tab="custom">5. Namų taisyklės (${this.currentConfig.custom_rules.length})</button>
          <button class="setup-tab-btn ${this.activeTab === 'interface' ? 'active' : ''}" data-tab="interface">6. Sąsaja (UI)</button>
          <button class="setup-tab-btn ${this.activeTab === 'json' ? 'active' : ''}" data-tab="json">7. Config JSON & Startas</button>
        </nav>

        <!-- Warnings & Errors Banner -->
        ${this.renderValidationBanner(val)}

        <!-- Tab Body Content -->
        <div class="modal-body setup-body">
          ${this.renderActiveTabContent()}
        </div>

        <!-- Footer Actions -->
        <div class="modal-footer setup-footer">
          <button id="btn-reset-setup" class="btn-action btn-secondary">🔄 Numatytieji</button>
          <div class="footer-right-buttons">
            <button id="btn-cancel-setup" class="btn-action btn-outline">Atšaukti</button>
            <button id="btn-start-configured-game" class="btn-action btn-gold ${!val.valid ? 'disabled' : ''}">
              🚀 Pradedam žaidimą?
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderValidationBanner(val: { valid: boolean; warnings: string[]; errors: string[] }): string {
    if (val.errors.length === 0 && val.warnings.length === 0) {
      return '';
    }

    let html = '<div class="setup-validation-box">';
    for (const err of val.errors) {
      html += `<div class="val-item val-error">❌ ${err}</div>`;
    }
    for (const warn of val.warnings) {
      html += `<div class="val-item val-warning">⚠️ ${warn}</div>`;
    }
    html += '</div>';
    return html;
  }

  private renderActiveTabContent(): string {
    switch (this.activeTab) {
      case 'general':
        return this.renderGeneralTab();
      case 'teams':
        return this.renderTeamsTab();
      case 'rules':
        return this.renderRulesTab();
      case 'transfer':
        return this.renderTransferTab();
      case 'custom':
        return this.renderCustomRulesTab();
      case 'interface':
        return this.renderInterfaceTab();
      case 'json':
        return this.renderJsonTab();
      default:
        return '';
    }
  }

  private renderGeneralTab(): string {
    const cfg = this.currentConfig;
    return `
      <div class="setup-form-grid">
        <div class="form-group">
          <label>Žaidimo variantas (game_variant):</label>
          <select id="cfg-variant" class="setup-select">
            <option value="podkidnoy_durak" ${cfg.game_variant === 'podkidnoy_durak' ? 'selected' : ''}>podkidnoy_durak (Metamas)</option>
            <option value="perevodnoy_durak" ${cfg.game_variant === 'perevodnoy_durak' ? 'selected' : ''}>perevodnoy_durak (Perduodamasis)</option>
            <option value="custom_mix" ${cfg.game_variant === 'custom_mix' ? 'selected' : ''}>custom_mix (Mišrus)</option>
          </select>
        </div>

        <div class="form-group">
          <label>Žaidimo režimas (game_mode):</label>
          <select id="cfg-mode" class="setup-select">
            <option value="solo" ${cfg.game_mode === 'solo' ? 'selected' : ''}>solo (Kiekvienas už save)</option>
            <option value="teams" ${cfg.game_mode === 'teams' ? 'selected' : ''}>teams (Komandinis)</option>
            <option value="mixed" ${cfg.game_mode === 'mixed' ? 'selected' : ''}>mixed (Solo + Komandinis)</option>
          </select>
        </div>

        <div class="form-group">
          <label>Žaidėjų skaičius (player_count: 2–8):</label>
          <input type="range" id="cfg-player-count" min="2" max="8" value="${cfg.players.count}" class="setup-range" />
          <span class="range-display"><strong id="player-count-display">${cfg.players.count}</strong> žaidėjai (-ų)</span>
        </div>

        <div class="form-group">
          <label>AI Sunkumas (ai_difficulty):</label>
          <select id="cfg-ai-diff" class="setup-select">
            <option value="easy" ${cfg.players.ai_difficulty === 'easy' ? 'selected' : ''}>Lengvas (easy)</option>
            <option value="normal" ${cfg.players.ai_difficulty === 'normal' ? 'selected' : ''}>Normalus (normal)</option>
            <option value="hard" ${cfg.players.ai_difficulty === 'hard' ? 'selected' : ''}>Sunkus (hard)</option>
            <option value="insane" ${cfg.players.ai_difficulty === 'insane' ? 'selected' : ''}>Ekstremalus (insane)</option>
          </select>
        </div>
      </div>

      <div class="setup-sub-section">
        <h4>Žaidėjų vardai ir valdymas (Žmogus / AI):</h4>
        <div class="players-editor-list">
          ${Array.from({ length: cfg.players.count })
            .map((_, idx) => {
              const name = cfg.players.names[idx] || (idx === 0 ? 'Tu' : `AI-${idx}`);
              const isHuman = cfg.players.human_players.includes(name) || (cfg.players.human_players.length === 0 && idx === 0);
              return `
                <div class="player-row">
                  <span class="player-num">#${idx + 1}</span>
                  <input type="text" class="player-name-input" data-index="${idx}" value="${name}" />
                  <label class="toggle-chip ${isHuman ? 'active' : ''}">
                    <input type="checkbox" class="player-human-checkbox" data-index="${idx}" ${isHuman ? 'checked' : ''} />
                    ${isHuman ? '👤 Žmogus' : '🤖 AI Botas'}
                  </label>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  private renderTeamsTab(): string {
    const tm = this.currentConfig.team_mode;
    const pm = this.currentConfig.pair_mode;

    return `
      <div class="setup-sub-section">
        <div class="section-toggle-header">
          <h4>👥 Komandinis režimas (team_mode)</h4>
          <label class="switch">
            <input type="checkbox" id="cfg-team-enabled" ${tm.enabled ? 'checked' : ''} />
            <span class="slider round"></span>
          </label>
        </div>

        <div class="setup-form-grid ${!tm.enabled ? 'disabled-opacity' : ''}">
          <div class="form-group">
            <label>Komandų skaičius (2–4):</label>
            <input type="number" id="cfg-team-count" min="2" max="4" value="${tm.team_count}" class="setup-input" ${!tm.enabled ? 'disabled' : ''} />
          </div>
          <div class="form-group">
            <label>Žaidėjų komandoje (2–4):</label>
            <input type="number" id="cfg-team-size" min="2" max="4" value="${tm.team_size}" class="setup-input" ${!tm.enabled ? 'disabled' : ''} />
          </div>
          <div class="form-group">
            <label>Komandų formavimas:</label>
            <select id="cfg-team-formation" class="setup-select" ${!tm.enabled ? 'disabled' : ''}>
              <option value="opposite_seats" ${tm.team_formation === 'opposite_seats' ? 'selected' : ''}>Priešais sėdintys (opposite)</option>
              <option value="adjacent_seats" ${tm.team_formation === 'adjacent_seats' ? 'selected' : ''}>Šalia sėdintys (adjacent)</option>
              <option value="random_assignment" ${tm.team_formation === 'random_assignment' ? 'selected' : ''}>Atsitiktinis (random)</option>
              <option value="player_choice" ${tm.team_formation === 'player_choice' ? 'selected' : ''}>Pasirinktinis</option>
            </select>
          </div>
          <div class="form-group">
            <label>Pergalės sąlyga:</label>
            <select id="cfg-team-win-cond" class="setup-select" ${!tm.enabled ? 'disabled' : ''}>
              <option value="first_team_to_empty_all_hands" ${tm.team_win_condition === 'first_team_to_empty_all_hands' ? 'selected' : ''}>Pirma be kortų komanda laimi</option>
              <option value="last_team_with_cards_loses" ${tm.team_win_condition === 'last_team_with_cards_loses' ? 'selected' : ''}>Paskutinė su kortomis pralaimi</option>
            </select>
          </div>
        </div>

        <div class="toggle-chips-row ${!tm.enabled ? 'disabled-opacity' : ''}">
          <label class="toggle-chip ${tm.shared_hand ? 'active' : ''}">
            <input type="checkbox" id="cfg-shared-hand" ${tm.shared_hand ? 'checked' : ''} ${!tm.enabled ? 'disabled' : ''} />
            Mato komandos draugo kortas
          </label>
          <label class="toggle-chip ${tm.allow_team_communication ? 'active' : ''}">
            <input type="checkbox" id="cfg-team-comm" ${tm.allow_team_communication ? 'checked' : ''} ${!tm.enabled ? 'disabled' : ''} />
            Leidžiamas komandos bendravimas (hints)
          </label>
          <label class="toggle-chip ${tm.team_elimination ? 'active' : ''}">
            <input type="checkbox" id="cfg-team-elim" ${tm.team_elimination ? 'checked' : ''} ${!tm.enabled ? 'disabled' : ''} />
            Komanda iškrenta išmetus kortas
          </label>
        </div>
      </div>

      <div class="setup-sub-section">
        <div class="section-toggle-header">
          <h4>🤝 Porų režimas (pair_mode 2v2)</h4>
          <label class="switch">
            <input type="checkbox" id="cfg-pair-enabled" ${pm.enabled ? 'checked' : ''} />
            <span class="slider round"></span>
          </label>
        </div>

        <div class="toggle-chips-row ${!pm.enabled ? 'disabled-opacity' : ''}">
          <label class="toggle-chip ${pm.pair_attack_coordination ? 'active' : ''}">
            <input type="checkbox" id="cfg-pair-attack" ${pm.pair_attack_coordination ? 'checked' : ''} ${!pm.enabled ? 'disabled' : ''} />
            Poros atakos koordinacija
          </label>
          <label class="toggle-chip ${pm.pair_defense_coordination ? 'active' : ''}">
            <input type="checkbox" id="cfg-pair-defense" ${pm.pair_defense_coordination ? 'checked' : ''} ${!pm.enabled ? 'disabled' : ''} />
            Poros ginybos pagalba
          </label>
          <label class="toggle-chip ${pm.pair_transfer_allowed ? 'active' : ''}">
            <input type="checkbox" id="cfg-pair-transfer" ${pm.pair_transfer_allowed ? 'checked' : ''} ${!pm.enabled ? 'disabled' : ''} />
            Perdavimas porininko naudai
          </label>
        </div>
      </div>
    `;
  }

  private renderRulesTab(): string {
    const d = this.currentConfig.deck;
    const h = this.currentConfig.hand;
    const a = this.currentConfig.attack;

    return `
      <div class="setup-form-grid">
        <div class="form-group">
          <label>Kaladės dydis (deck_size):</label>
          <select id="cfg-deck-size" class="setup-select">
            <option value="36" ${d.size === 36 ? 'selected' : ''}>36 kortos (6-A)</option>
            <option value="52" ${d.size === 52 ? 'selected' : ''}>52 kortos (2-A)</option>
          </select>
        </div>

        <div class="form-group">
          <label>Kozirio taisyklė (trump_rule):</label>
          <select id="cfg-trump-rule" class="setup-select">
            <option value="standard_bottom_card" ${d.trump_rule === 'standard_bottom_card' ? 'selected' : ''}>Standartinė apatinė korta</option>
            <option value="random" ${d.trump_rule === 'random' ? 'selected' : ''}>Atsitiktinis koziris</option>
            <option value="no_trump" ${d.trump_rule === 'no_trump' ? 'selected' : ''}>Be kozirių (no_trump)</option>
            <option value="rotating_suit" ${d.trump_rule === 'rotating_suit' ? 'selected' : ''}>Rotuojantis koziris kas raundą</option>
          </select>
        </div>

        <div class="form-group">
          <label>Pradinis kortų skaičius rankoje (4–8):</label>
          <input type="number" id="cfg-starting-hand" min="4" max="8" value="${h.starting_size}" class="setup-input" />
        </div>

        <div class="form-group">
          <label>Rankos papildymo limitas (4–8):</label>
          <input type="number" id="cfg-max-hand" min="4" max="8" value="${h.max_size}" class="setup-input" />
        </div>

        <div class="form-group">
          <label>Kas puola pirmas?</label>
          <select id="cfg-first-attacker" class="setup-select">
            <option value="lowest_trump_holder" ${d.first_attacker_rule === 'lowest_trump_holder' ? 'selected' : ''}>Mažiausio kozirio turėtojas</option>
            <option value="random" ${d.first_attacker_rule === 'random' ? 'selected' : ''}>Atsitiktinis žaidėjas</option>
          </select>
        </div>

        <div class="form-group">
          <label>Max kortų raunde (1–12):</label>
          <input type="number" id="cfg-max-cards" min="1" max="12" value="${a.max_cards_per_round}" class="setup-input" />
        </div>

        <div class="form-group">
          <label>Max kortų 1-ajame raunde (1–12):</label>
          <input type="number" id="cfg-first-max-cards" min="1" max="12" value="${a.first_round_max_cards}" class="setup-input" />
        </div>

        <div class="form-group">
          <label>Primetimo tvarka (throw_in_order):</label>
          <select id="cfg-throw-order" class="setup-select">
            <option value="attacker_first_then_clockwise" ${a.throw_in_order === 'attacker_first_then_clockwise' ? 'selected' : ''}>Puolėjas pirmas, po to pagal laikrodžio rodyklę</option>
            <option value="free_for_all" ${a.throw_in_order === 'free_for_all' ? 'selected' : ''}>Kas pirmas spėja (free_for_all)</option>
            <option value="only_attacker" ${a.throw_in_order === 'only_attacker' ? 'selected' : ''}>Tik pagrindinis puolėjas</option>
          </select>
        </div>
      </div>

      <div class="toggle-chips-row">
        <label class="toggle-chip ${a.limit_by_defender_hand ? 'active' : ''}">
          <input type="checkbox" id="cfg-limit-defender" ${a.limit_by_defender_hand ? 'checked' : ''} />
          Mesti ne daugiau nei gynėjas turi kortų
        </label>
        <label class="toggle-chip ${a.allow_same_rank_throw_in ? 'active' : ''}">
          <input type="checkbox" id="cfg-allow-same-rank" ${a.allow_same_rank_throw_in ? 'checked' : ''} />
          Leisti primesti to paties rango kortas
        </label>
        <label class="toggle-chip ${a.allow_trump_throw_in ? 'active' : ''}">
          <input type="checkbox" id="cfg-allow-trump-throw" ${a.allow_trump_throw_in ? 'checked' : ''} />
          Leisti primesti kozirius
        </label>
        <label class="toggle-chip ${a.allow_pairs_attack ? 'active' : ''}">
          <input type="checkbox" id="cfg-allow-pairs" ${a.allow_pairs_attack ? 'checked' : ''} />
          Leisti pulti poromis
        </label>
      </div>
    `;
  }

  private renderTransferTab(): string {
    const t = this.currentConfig.transfer;
    const eg = this.currentConfig.endgame;

    return `
      <div class="setup-sub-section">
        <div class="section-toggle-header">
          <h4>🔄 Perdavimo taisyklės (perevodnoy durak)</h4>
          <label class="switch">
            <input type="checkbox" id="cfg-transfer-enabled" ${t.enabled ? 'checked' : ''} />
            <span class="slider round"></span>
          </label>
        </div>

        <div class="setup-form-grid ${!t.enabled ? 'disabled-opacity' : ''}">
          <div class="form-group">
            <label>Kokia korta galima perduoti?</label>
            <select id="cfg-transfer-rank-rule" class="setup-select" ${!t.enabled ? 'disabled' : ''}>
              <option value="same_rank_any_suit" ${t.rank_rule === 'same_rank_any_suit' ? 'selected' : ''}>To paties rango bet kokia spalva</option>
              <option value="same_rank_trump_only" ${t.rank_rule === 'same_rank_trump_only' ? 'selected' : ''}>Tik to paties rango koziris</option>
            </select>
          </div>
          <div class="form-group">
            <label>Kam perduodama ataka?</label>
            <select id="cfg-transfer-target" class="setup-select" ${!t.enabled ? 'disabled' : ''}>
              <option value="next_player_only" ${t.allow_transfer_to_any_player === 'next_player_only' ? 'selected' : ''}>Tik sekančiam žaidėjui</option>
              <option value="any_player" ${t.allow_transfer_to_any_player === 'any_player' ? 'selected' : ''}>Bet kuriam žaidėjui</option>
            </select>
          </div>
        </div>

        <div class="toggle-chips-row ${!t.enabled ? 'disabled-opacity' : ''}">
          <label class="toggle-chip ${t.only_before_defense ? 'active' : ''}">
            <input type="checkbox" id="cfg-transfer-before-def" ${t.only_before_defense ? 'checked' : ''} ${!t.enabled ? 'disabled' : ''} />
            Perduoti galima tik prieš pradedant gintis
          </label>
          <label class="toggle-chip ${t.allow_trump_reveal_transfer ? 'active' : ''}">
            <input type="checkbox" id="cfg-trump-reveal-trans" ${t.allow_trump_reveal_transfer ? 'checked' : ''} ${!t.enabled ? 'disabled' : ''} />
            Kozirio parodymo perdavimas (lieka rankoje)
          </label>
          <label class="toggle-chip ${t.require_enough_cards_for_next_defender ? 'active' : ''}">
            <input type="checkbox" id="cfg-enough-cards-trans" ${t.require_enough_cards_for_next_defender ? 'checked' : ''} ${!t.enabled ? 'disabled' : ''} />
            Drausti, jei sekantis neturi pakankamai kortų
          </label>
        </div>
      </div>

      <div class="setup-sub-section">
        <h4>🏁 Pabaigos ir laimėtojo taisyklės (endgame)</h4>
        <div class="setup-form-grid">
          <div class="form-group">
            <label>Kas laimi / nustatoma pabaiga?</label>
            <select id="cfg-winner-rule" class="setup-select">
              <option value="both" ${eg.winner_rule === 'both' ? 'selected' : ''}>Pirmas be kortų laimi, paskutinis – durnius</option>
              <option value="first_to_empty_hand_wins" ${eg.winner_rule === 'first_to_empty_hand_wins' ? 'selected' : ''}>Tik pirmas be kortų laimi</option>
              <option value="last_player_is_durnius" ${eg.winner_rule === 'last_player_is_durnius' ? 'selected' : ''}>Tik paskutinis yra durnius</option>
            </select>
          </div>
          <div class="form-group">
            <label>Lygiųjų taisyklė:</label>
            <select id="cfg-draw-rule" class="setup-select">
              <option value="draw" ${eg.draw_rule === 'draw' ? 'selected' : ''}>Lygiosios (nėra durniaus)</option>
              <option value="last_to_take_cards_is_durnius" ${eg.draw_rule === 'last_to_take_cards_is_durnius' ? 'selected' : ''}>Paskutinis ėmęs kortas lieka durniumi</option>
            </select>
          </div>
        </div>
        <div class="toggle-chips-row">
          <label class="toggle-chip ${eg.elimination_mode ? 'active' : ''}">
            <input type="checkbox" id="cfg-elimination" ${eg.elimination_mode ? 'checked' : ''} />
            Žaidėjai be kortų iškrenta iš karto
          </label>
          <label class="toggle-chip ${eg.score_system ? 'active' : ''}">
            <input type="checkbox" id="cfg-score-system" ${eg.score_system ? 'checked' : ''} />
            Taškų skaičiavimo sistema
          </label>
        </div>
      </div>
    `;
  }

  private renderCustomRulesTab(): string {
    const currentRules = new Set(this.currentConfig.custom_rules);

    return `
      <div class="custom-rules-panel">
        <p class="section-lead">Pasirinkite namų taisykles (iš viso 36). Pasirinktos taisyklės bus patikrintos dėl suderinamumo:</p>
        <div class="custom-rules-grid">
          ${AVAILABLE_CUSTOM_RULES.map((rule) => {
            const isChecked = currentRules.has(rule.id);
            return `
              <div class="custom-rule-card ${isChecked ? 'selected' : ''}" data-rule-id="${rule.id}">
                <div class="rule-card-header">
                  <span class="rule-type-badge type-${rule.type}">${rule.type}</span>
                  <input type="checkbox" class="rule-checkbox" data-rule-id="${rule.id}" ${isChecked ? 'checked' : ''} />
                </div>
                <strong class="rule-card-name">${rule.name}</strong>
                ${rule.description ? `<p class="rule-card-desc">${rule.description}</p>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  private renderInterfaceTab(): string {
    const ui = this.currentConfig.interface;
    const savedPreset = typeof localStorage !== 'undefined' ? localStorage.getItem('durak_royal_graphics_preset') || 'auto' : 'auto';
    return `
      <p class="section-lead">Valdykite, kokie elementai ir pagalbininkai matomi ekrane:</p>
      <div class="toggle-chips-grid">
        <label class="toggle-chip ${ui.show_card_count ? 'active' : ''}">
          <input type="checkbox" id="cfg-ui-card-count" ${ui.show_card_count ? 'checked' : ''} />
          Rodyti kaladės ir rankų kortų skaičių
        </label>
        <label class="toggle-chip ${ui.show_discard_pile ? 'active' : ''}">
          <input type="checkbox" id="cfg-ui-discard" ${ui.show_discard_pile ? 'checked' : ''} />
          Rodyti atliekų krūvą (Bita)
        </label>
        <label class="toggle-chip ${ui.show_trump_card ? 'active' : ''}">
          <input type="checkbox" id="cfg-ui-trump" ${ui.show_trump_card ? 'checked' : ''} />
          Rodyti kozirio kortą po kalade
        </label>
        <label class="toggle-chip ${ui.suggest_best_move ? 'active' : ''}">
          <input type="checkbox" id="cfg-ui-suggest" ${ui.suggest_best_move ? 'checked' : ''} />
          Mokytojo patarimai (💡)
        </label>
        <label class="toggle-chip ${ui.explain_illegal_moves ? 'active' : ''}">
          <input type="checkbox" id="cfg-ui-explain" ${ui.explain_illegal_moves ? 'checked' : ''} />
          Teisėjo paaiškinimai po neleistino ėjimo
        </label>
        <label class="toggle-chip ${ui.auto_play_ai_turns ? 'active' : ''}">
          <input type="checkbox" id="cfg-ui-autoplay" ${ui.auto_play_ai_turns ? 'checked' : ''} />
          Automatiniai AI ėjimai
        </label>
        <label class="toggle-chip ${ui.show_ai_hands ? 'active' : ''}">
          <input type="checkbox" id="cfg-ui-ai-hands" ${ui.show_ai_hands ? 'checked' : ''} />
          Rodyti atverstas AI oponentų kortas (Debug)
        </label>
        <label class="toggle-chip ${ui.show_teammate_hand ? 'active' : ''}">
          <input type="checkbox" id="cfg-ui-teammate-hand" ${ui.show_teammate_hand ? 'checked' : ''} />
          Rodyti komandos draugo kortas
        </label>
        <div class="form-group" style="margin-top: 10px; grid-column: 1 / -1;">
          <label for="cfg-ui-graphics">🎨 3D Grafikos kokybė:</label>
          <select id="cfg-ui-graphics" class="setup-select">
            <option value="auto" ${savedPreset === 'auto' ? 'selected' : ''}>Auto (Adaptyvus našumas)</option>
            <option value="high" ${savedPreset === 'high' ? 'selected' : ''}>Aukšta (Pilni šešėliai, 2048px, VFX)</option>
            <option value="medium" ${savedPreset === 'medium' ? 'selected' : ''}>Vidutinė (1024px šešėliai, subalansuota)</option>
            <option value="low" ${savedPreset === 'low' ? 'selected' : ''}>Žema (Be šešėlių, maksimalus našumas)</option>
          </select>
        </div>
      </div>
    `;
  }

  private renderJsonTab(): string {
    const val = validateGameSetupConfig(this.currentConfig);
    this.currentConfig.validated = val.valid;
    const jsonStr = JSON.stringify(this.currentConfig, null, 2);

    return `
      <div class="json-tab-container">
        <div class="json-header-toolbar">
          <span>Galutinis DURAK_CUSTOM_GAME_SETUP JSON konfigūracijos objektas:</span>
          <button id="btn-copy-config-json" class="btn-action btn-sm">📋 Kopijuoti JSON</button>
        </div>
        <textarea id="setup-json-editor" class="setup-json-textarea" rows="18">${jsonStr}</textarea>
      </div>
    `;
  }

  private bindEvents(): void {
    // Tab switching
    this.container.querySelectorAll('.setup-tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab;
        if (tab) {
          this.activeTab = tab;
          this.render();
        }
      });
    });

    // Close buttons
    document.getElementById('btn-close-setup')?.addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-setup')?.addEventListener('click', () => this.close());

    // Reset default
    document.getElementById('btn-reset-setup')?.addEventListener('click', () => {
      this.currentConfig = JSON.parse(JSON.stringify(DEFAULT_DURAK_CONFIG));
      this.render();
    });

    // Start game button
    document.getElementById('btn-start-configured-game')?.addEventListener('click', () => {
      const val = validateGameSetupConfig(this.currentConfig);
      if (!val.valid) {
        Toast.show('Yra nesuderinamų klaidų nustatymuose. Ištaisykite jas prieš pradėdami.', 'error');
        return;
      }
      this.currentConfig.validated = true;
      this.close();
      this.onStartGameCallback?.(this.currentConfig);
    });

    // General inputs
    const variantSelect = document.getElementById('cfg-variant') as HTMLSelectElement;
    variantSelect?.addEventListener('change', () => {
      this.currentConfig.game_variant = variantSelect.value as GameVariantType;
      if (this.currentConfig.game_variant === 'perevodnoy_durak') {
        this.currentConfig.transfer.enabled = true;
      }
      this.render();
    });

    const modeSelect = document.getElementById('cfg-mode') as HTMLSelectElement;
    modeSelect?.addEventListener('change', () => {
      this.currentConfig.game_mode = modeSelect.value as GameModeType;
      if (this.currentConfig.game_mode === 'teams') {
        this.currentConfig.team_mode.enabled = true;
      }
      this.render();
    });

    const playerCountRange = document.getElementById('cfg-player-count') as HTMLInputElement;
    playerCountRange?.addEventListener('input', () => {
      const count = parseInt(playerCountRange.value, 10);
      this.currentConfig.players.count = count;
      // Adjust names array
      while (this.currentConfig.players.names.length < count) {
        const idx = this.currentConfig.players.names.length;
        this.currentConfig.players.names.push(`AI-${idx}`);
      }
      const display = document.getElementById('player-count-display');
      if (display) display.innerText = `${count}`;
      this.render();
    });

    const aiDiffSelect = document.getElementById('cfg-ai-diff') as HTMLSelectElement;
    aiDiffSelect?.addEventListener('change', () => {
      this.currentConfig.players.ai_difficulty = aiDiffSelect.value as AiDifficulty;
    });

    // Player row inputs
    this.container.querySelectorAll('.player-name-input').forEach((input) => {
      input.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.index || '0', 10);
        this.currentConfig.players.names[idx] = (e.target as HTMLInputElement).value.trim();
      });
    });

    this.container.querySelectorAll('.player-human-checkbox').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const idx = parseInt((e.target as HTMLElement).dataset.index || '0', 10);
        const name = this.currentConfig.players.names[idx];
        const isHuman = (e.target as HTMLInputElement).checked;
        if (isHuman) {
          if (!this.currentConfig.players.human_players.includes(name)) {
            this.currentConfig.players.human_players.push(name);
          }
        } else {
          this.currentConfig.players.human_players = this.currentConfig.players.human_players.filter((n) => n !== name);
        }
        this.render();
      });
    });

    // Team mode toggle
    const teamEnabled = document.getElementById('cfg-team-enabled') as HTMLInputElement;
    teamEnabled?.addEventListener('change', () => {
      this.currentConfig.team_mode.enabled = teamEnabled.checked;
      this.render();
    });

    // Pair mode toggle
    const pairEnabled = document.getElementById('cfg-pair-enabled') as HTMLInputElement;
    pairEnabled?.addEventListener('change', () => {
      this.currentConfig.pair_mode.enabled = pairEnabled.checked;
      this.render();
    });

    // Rules Tab events
    const deckSelect = document.getElementById('cfg-deck-size') as HTMLSelectElement;
    deckSelect?.addEventListener('change', () => {
      const size = parseInt(deckSelect.value, 10) as 36 | 52;
      this.currentConfig.deck.size = size;
      this.currentConfig.deck.ranks = size === 52 ? [...EXTENDED_RANKS_52] : [...STANDARD_RANKS_36];
      this.render();
    });

    const trumpRuleSelect = document.getElementById('cfg-trump-rule') as HTMLSelectElement;
    trumpRuleSelect?.addEventListener('change', () => {
      this.currentConfig.deck.trump_rule = trumpRuleSelect.value as TrumpRule;
      this.render();
    });

    const startHandInput = document.getElementById('cfg-starting-hand') as HTMLInputElement;
    startHandInput?.addEventListener('change', () => {
      this.currentConfig.hand.starting_size = parseInt(startHandInput.value, 10);
      this.render();
    });

    const maxHandInput = document.getElementById('cfg-max-hand') as HTMLInputElement;
    maxHandInput?.addEventListener('change', () => {
      this.currentConfig.hand.max_size = parseInt(maxHandInput.value, 10);
    });

    const firstAttackerSelect = document.getElementById('cfg-first-attacker') as HTMLSelectElement;
    firstAttackerSelect?.addEventListener('change', () => {
      this.currentConfig.deck.first_attacker_rule = firstAttackerSelect.value as FirstAttackerRule;
    });

    const maxCardsInput = document.getElementById('cfg-max-cards') as HTMLInputElement;
    maxCardsInput?.addEventListener('change', () => {
      this.currentConfig.attack.max_cards_per_round = parseInt(maxCardsInput.value, 10);
    });

    const firstMaxCardsInput = document.getElementById('cfg-first-max-cards') as HTMLInputElement;
    firstMaxCardsInput?.addEventListener('change', () => {
      this.currentConfig.attack.first_round_max_cards = parseInt(firstMaxCardsInput.value, 10);
    });

    const throwOrderSelect = document.getElementById('cfg-throw-order') as HTMLSelectElement;
    throwOrderSelect?.addEventListener('change', () => {
      this.currentConfig.attack.throw_in_order = throwOrderSelect.value as ThrowInOrder;
    });

    // Transfer toggle
    const transferEnabled = document.getElementById('cfg-transfer-enabled') as HTMLInputElement;
    transferEnabled?.addEventListener('change', () => {
      this.currentConfig.transfer.enabled = transferEnabled.checked;
      this.render();
    });

    // Custom Rules selection
    this.container.querySelectorAll('.rule-checkbox').forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const id = (e.target as HTMLElement).dataset.ruleId;
        if (!id) return;
        const checked = (e.target as HTMLInputElement).checked;
        if (checked) {
          if (!this.currentConfig.custom_rules.includes(id)) {
            this.currentConfig.custom_rules.push(id);
          }
        } else {
          this.currentConfig.custom_rules = this.currentConfig.custom_rules.filter((r) => r !== id);
        }
        this.render();
      });
    });

    // JSON tab copy & edit
    document.getElementById('btn-copy-config-json')?.addEventListener('click', async () => {
      const code = (document.getElementById('setup-json-editor') as HTMLTextAreaElement)?.value;
      if (!code) return;
      try {
        await navigator.clipboard.writeText(code);
        Toast.show('Nustatymų JSON nukopijuotas į iškarpinę.', 'success');
      } catch {
        Toast.show('Nepavyko nukopijuoti į iškarpinę.', 'error');
      }
    });

    const jsonEditor = document.getElementById('setup-json-editor') as HTMLTextAreaElement;
    jsonEditor?.addEventListener('blur', () => {
      try {
        const parsed = JSON.parse(jsonEditor.value);
        this.currentConfig = parsed;
        this.render();
      } catch {
        // syntax error, ignore until valid
      }
    });

    // Interface Tab events
    const graphicsSelect = document.getElementById('cfg-ui-graphics') as HTMLSelectElement;
    graphicsSelect?.addEventListener('change', () => {
      try {
        localStorage.setItem('durak_royal_graphics_preset', graphicsSelect.value);
        window.dispatchEvent(new Event('storage'));
      } catch {}
    });

    const bindUiCheck = (id: string, prop: keyof typeof this.currentConfig.interface) => {
      const el = document.getElementById(id) as HTMLInputElement;
      el?.addEventListener('change', () => {
        (this.currentConfig.interface as any)[prop] = el.checked;
        this.render();
      });
    };

    bindUiCheck('cfg-ui-card-count', 'show_card_count');
    bindUiCheck('cfg-ui-discard', 'show_discard_pile');
    bindUiCheck('cfg-ui-trump', 'show_trump_card');
    bindUiCheck('cfg-ui-suggest', 'suggest_best_move');
    bindUiCheck('cfg-ui-explain', 'explain_illegal_moves');
    bindUiCheck('cfg-ui-autoplay', 'auto_play_ai_turns');
    bindUiCheck('cfg-ui-ai-hands', 'show_ai_hands');
    bindUiCheck('cfg-ui-teammate-hand', 'show_teammate_hand');
  }
}

