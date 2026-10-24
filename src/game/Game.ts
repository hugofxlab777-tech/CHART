import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { DurakEngine } from '../engine/DurakEngine';
import { DurakAI } from '../engine/DurakAI';
import { TableScene } from '../entities/TableScene';
import { CardFactory } from '../entities/CardFactory';
import { CardAnimator } from '../systems/CardAnimator';
import { VfxSystem } from '../systems/VfxSystem';
import { DurakAudioSystem } from '../systems/AudioSystem';
import { Hud } from '../systems/Hud';
import { SetupWizardModal } from '../systems/SetupWizardModal';
import { LeaderboardManager } from '../engine/Leaderboard';
import { LeaderboardModal } from '../systems/LeaderboardModal';
import { Toast, confirmDialog } from '../systems/Ui';
import { OnlineLobbyModal } from '../systems/OnlineLobbyModal';
import { MultiplayerService, generateRoomCode, type NetSnapshot } from '../engine/OnlineMultiplayer';
import { DEFAULT_DURAK_CONFIG } from '../engine/GameSetupConfig';
import { GraphicsQualityManager, type GraphicsSettings } from '../core/GraphicsQuality';
import {
  createRenderer,
  resizeRenderer,
  setupEnvironmentAndPost,
  applyGraphicsSettingsToRenderer,
  updateCameraFraming,
} from '../core/Renderer';
import { Loop } from '../core/Loop';
import { createSeededRandom } from '../utils/random';
import { type Card, type Move } from '../engine/types';

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
  private readonly tableScene = new TableScene();
  private readonly animator = new CardAnimator();
  private readonly vfx = new VfxSystem();
  private readonly audio = new DurakAudioSystem();
  private readonly hud: Hud;
  private readonly setupWizard: SetupWizardModal;
  private readonly leaderboard = new LeaderboardManager();
  private readonly leaderboardModal: LeaderboardModal;
  private readonly graphicsQuality = new GraphicsQualityManager();

  private engine: DurakEngine;
  private ai: DurakAI;
  private loop: Loop;
  private rng = createSeededRandom(42);

  // 3D Card Meshes map: card.id -> THREE.Group
  private cardMeshes = new Map<string, THREE.Group>();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredCard: THREE.Group | null = null;
  private selectedCardId: string | null = null;
  private frameCounter = 0;
  private elapsedSeconds = 0;

  // Hand pagination for large hands (> 7 cards on mobile)
  private handStartIndex = 0;
  private handPageSize = 6;

  private pausedForScreenshot = false;
  private reducedMotion = false;
  private aiTurnTimeout: any = null;
  private matchRecorded = false;

  // Internetinis režimas (host-authoritative per PeerJS)
  private readonly net = new MultiplayerService();
  private readonly lobby: OnlineLobbyModal;
  private localSeat = 0;
  private onlineSeatCount = 0;

  // Touch tracking to distinguish scrolling from tapping
  private pointerDownPos: { x: number; y: number; time: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.hud = new Hud();
    this.leaderboardModal = new LeaderboardModal(this.leaderboard);

    // Initial camera framing
    updateCameraFraming(this.camera, window.innerWidth, window.innerHeight);

    this.scene.add(this.tableScene.group);
    this.scene.add(this.vfx.group);
    this.setupLighting();
    this.composer = setupEnvironmentAndPost(this.renderer, this.scene, this.camera);

    const initialSettings = this.graphicsQuality.getSettings();
    applyGraphicsSettingsToRenderer(this.renderer, initialSettings);
    resizeRenderer(this.renderer, this.camera, this.composer, initialSettings.maxDpr);

    this.engine = new DurakEngine({ variant: 'podkidnoy_durak', playerCount: 2 }, this.rng);
    this.ai = new DurakAI(this.engine);
    this.setupWizard = new SetupWizardModal('setup-modal');
    this.lobby = new OnlineLobbyModal();
    this.setupWizard.setOnStartGame((cfg) => {
      this.startNewGame({ customConfig: cfg });
    });
    this.setupNetService();
    this.setupLobby();
    (window as any).__NET_DEBUG__ = this.net;

    this.setupHudCallbacks();
    this.setupInteractions();
    this.setupLifecycle();

    this.loop = new Loop(
      (delta) => this.update(delta),
      () => this.render()
    );

    this.startNewGame();
    this.installTestHooks();
    this.publishDiagnostics();
  }

  public start(): void {
    this.loop.start();
  }

  private setupLighting(): void {
    this.scene.background = new THREE.Color('#141b18');
    this.scene.fog = new THREE.FogExp2('#141b18', 0.015);

    const ambient = new THREE.AmbientLight('#e2eae3', 0.42);
    this.scene.add(ambient);

    const lamp = new THREE.DirectionalLight('#fff5e6', 1.15);
    lamp.position.set(1.5, 14, 2.5);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.camera.near = 1;
    lamp.shadow.camera.far = 26;
    lamp.shadow.camera.left = -10.5;
    lamp.shadow.camera.right = 10.5;
    lamp.shadow.camera.top = 10.5;
    lamp.shadow.camera.bottom = -10.5;
    lamp.shadow.bias = -0.0005;
    this.scene.add(lamp);

    const rimLight = new THREE.DirectionalLight('#8ab8a0', 0.3);
    rimLight.position.set(-4, 8, -6);
    this.scene.add(rimLight);

    const centerSpot = new THREE.PointLight('#ffeacc', 0.65, 18, 2.0);
    centerSpot.position.set(0, 6.0, 0.2);
    this.scene.add(centerSpot);
  }

  private setupHudCallbacks(): void {
    this.hud.setCallbacks({
      onTake: () => this.handlePlayerAction('take'),
      onPass: () => this.handlePlayerAction('pass'),
      onHint: () => this.handleHint(),
      onRestart: () => this.confirmAndRestart(),
      onOpenSetup: () => this.setupWizard.open(this.engine.customConfig),
      onOpenLeaderboard: () => this.leaderboardModal.open(),
      onOpenOnline: () => {
        // Iš URL ?kambarys=KODAS prefill'inam kodą
        const params = new URLSearchParams(window.location.search);
        this.lobby.open(params.get('kambarys')?.toUpperCase() || undefined);
      },
      onToggleAudio: () => this.audio.toggleMute(),
      onPlaySelectedCard: () => this.playSelectedCard(),
      onGraphicsChange: (preset) => {
        this.graphicsQuality.setPreset(preset);
      },
      onHandPage: (direction) => {
        const human = this.me();
        if (!human) return;
        const total = human.hand.length;
        const newStart = this.handStartIndex + direction * this.handPageSize;
        if (newStart >= 0 && newStart < total) {
          this.handStartIndex = newStart;
          this.sync3DCardPositions();
          this.hud.updateHandPager(total, this.handStartIndex, this.handPageSize);
        }
      },
    });

    this.hud.setGraphicsSelectValue(this.graphicsQuality.getPreset());

    this.graphicsQuality.setCallback((settings: GraphicsSettings) => {
      applyGraphicsSettingsToRenderer(this.renderer, settings);
      resizeRenderer(this.renderer, this.camera, this.composer, settings.maxDpr);
      this.hud.setGraphicsSelectValue(this.graphicsQuality.getPreset());
    });
  }

  private confirmAndRestart(): void {
    if (this.net.isActive() && !this.net.isHost()) {
      Toast.show('Naują žaidimą pradeda tik kambario šeimininkas.', 'info');
      return;
    }
    if (this.net.isActive()) {
      // Internetinis žaidimas: tas pats kambarys, nauja partija
      confirmDialog({
        title: 'Naujas žaidimas',
        message: 'Pradėti naują partiją su esamais kambario žaidėjais?',
        confirmLabel: 'Pradėti iš naujo',
        cancelLabel: 'Tęsti partiją',
        danger: true,
      }).then((confirmed) => {
        if (confirmed) this.startOnlineAsHost();
      });
      return;
    }
    const isGameActive = !this.engine.gameOver && (this.engine.roundNumber > 1 || this.engine.table.length > 0);
    if (!isGameActive) {
      this.startNewGame();
      return;
    }
    confirmDialog({
      title: 'Naujas žaidimas',
      message: 'Ar tikrai norite nutraukti dabartinę partiją ir pradėti naują žaidimą?',
      confirmLabel: 'Nutraukti ir pradėti iš naujo',
      cancelLabel: 'Tęsti partiją',
      danger: true,
    }).then((confirmed) => {
      if (confirmed) {
        this.startNewGame();
        Toast.show('Nauja partija pradėta.', 'info');
      }
    });
  }

  public startNewGame(options?: any): void {
    if (this.aiTurnTimeout) clearTimeout(this.aiTurnTimeout);
    if (!options?.keepOnline) this.resetOnline();
    this.vfx.clear();
    this.hoveredCard = null;
    this.selectedCardId = null;
    this.handStartIndex = 0;
    this.matchRecorded = false;

    // Clear old card meshes
    for (const [, mesh] of this.cardMeshes) {
      this.scene.remove(mesh);
    }
    this.cardMeshes.clear();

    if (options?.customConfig) {
      this.engine = new DurakEngine(options, this.rng);
      this.ai = new DurakAI(this.engine);
    } else if (options) {
      this.engine.options = { ...this.engine.options, ...options };
    }
    this.engine.initGame(['Jūs', 'AI Jonas', 'AI Rasa', 'AI Tomas', 'AI Rytis', 'AI Saulė', 'AI Eglė', 'AI Domas']);

    // Create 3D card meshes for all cards in the game
    const allCards: Card[] = [];
    for (const p of this.engine.players) {
      allCards.push(...p.hand);
    }
    allCards.push(...this.engine.deck);

    for (const c of allCards) {
      const mesh = CardFactory.createCardMesh(c);
      mesh.position.set(5.8, 0.5, 0);
      mesh.rotation.set(0, 0, Math.PI); // Face down
      this.scene.add(mesh);
      this.cardMeshes.set(c.id, mesh);
    }

    this.audio.playSuccess();
    this.sync3DCardPositions(true);
    this.hud.update(this.engine, this.getPlayerLegalMoveNames());
    this.hud.updateSelectedCardAction(null, null);
    this.triggerAiTurnIfNeeded();
  }

  // ===== Internetinio žaidimo logika (host-authoritative per PeerJS) =====

  private me() {
    return this.engine.players[this.localSeat];
  }

  private resetOnline(): void {
    this.localSeat = 0;
    this.onlineSeatCount = 0;
    if (this.net.isActive()) {
      this.net.teardown();
    }
  }

  private setupNetService(): void {
    this.net.onStatus = (status, detail) => {
      if (status === 'hosting') {
        this.lobby.showHostView(this.net.roomCode || '—');
      } else if (status === 'waiting') {
        this.lobby.showClientView('Prisijungta — laukiama, kol šeimininkas pradės žaidimą…');
      } else if (status === 'error') {
        if (this.lobby.isOpen()) {
          this.lobby.showError(detail || 'Tinklo klaida.');
        } else {
          Toast.show(detail || 'Tinklo klaida.', 'error', 4000);
        }
      }
    };

    this.net.onLobbyUpdate = (players) => {
      const seats = this.net.isHost() ? this.lobby.getSeatCount() : this.onlineSeatCount;
      this.lobby.updatePlayers(players, players[0]?.name || 'Šeimininkas', seats);
    };

    this.net.onStart = (seat, configJson, snapshot) => {
      this.startOnlineAsClient(seat, configJson, snapshot);
    };

    this.net.onState = (snapshot) => {
      this.applySnapshot(snapshot);
    };

    this.net.onMove = (seat, move) => {
      if (!this.net.isHost()) return;
      if (move.playerId !== seat) return;
      const success = this.engine.executeMove(move);
      if (success) {
        this.afterHostMove(move);
      }
    };

    this.net.onNotice = (text) => {
      Toast.show(text, 'info', 3600);
    };
  }

  private setupLobby(): void {
    this.lobby.onCreateRoom = (name, seatCount) => {
      const code = generateRoomCode();
      this.onlineSeatCount = seatCount;
      this.net.hostRoom(code, name);
    };

    this.lobby.onJoinRoom = (code, name) => {
      this.net.joinRoom(code, name);
      this.lobby.showClientView('Jungiamasi…');
    };

    this.lobby.onStartGame = () => {
      if (!this.net.isHost()) return;
      this.startOnlineAsHost();
    };
  }

  private startOnlineAsHost(): void {
    const players = this.net.getConnectedPlayers();
    const seats = Math.max(this.lobby.getSeatCount(), players.length);
    this.onlineSeatCount = seats;

    const names: string[] = [];
    const humanPlayers: string[] = [];
    const aiNames = ['AI Jonas', 'AI Rasa', 'AI Tomas', 'AI Rytis', 'AI Saulė', 'AI Eglė', 'AI Domas'];
    for (let i = 0; i < seats; i++) {
      if (i < players.length) {
        names.push(players[i].name);
        humanPlayers.push(players[i].name);
      } else {
        names.push(aiNames[(i - players.length) % aiNames.length] + (i >= players.length + aiNames.length ? ` ${i}` : ''));
      }
    }

    const cfg = JSON.parse(JSON.stringify(DEFAULT_DURAK_CONFIG)) as typeof DEFAULT_DURAK_CONFIG;
    cfg.players = {
      count: seats,
      names,
      human_players: humanPlayers,
      ai_difficulty: 'normal',
    };
    cfg.interface.show_ai_hands = false;

    const options = { customConfig: cfg };
    this.engine = new DurakEngine(options, this.rng);
    this.ai = new DurakAI(this.engine);
    this.localSeat = 0;
    this.matchRecorded = false;

    this.engine.initGame(names);
    this.rebuildCardMeshes();
    this.audio.playSuccess();
    this.sync3DCardPositions(true);
    this.hud.update(this.engine, this.getPlayerLegalMoveNames());
    this.hud.updateSelectedCardAction(null, null);
    this.broadcastStateNow();
    this.triggerAiTurnIfNeeded();

    this.net.startGame(JSON.stringify(cfg), this.buildSnapshot(), this.net.getConnectionSeatMap());
    this.lobby.close();
    Toast.show(`Kambarys ${this.net.roomCode}: žaidimas pradėtas!`, 'success');
  }

  private startOnlineAsClient(seat: number, configJson: string, snapshot: NetSnapshot): void {
    const cfg = JSON.parse(configJson);
    const options = { customConfig: cfg };
    this.engine = new DurakEngine(options, this.rng);
    this.ai = new DurakAI(this.engine);
    this.localSeat = seat;
    this.matchRecorded = false;
    this.applySnapshot(snapshot, true);

    this.lobby.close();
    Toast.show(`Prisijungėte kaip ${snapshot.players[seat]?.name || `žaidėjas ${seat + 1}`}.`, 'info');
  }

  private buildSnapshot(): NetSnapshot {
    return {
      options: JSON.parse(JSON.stringify(this.engine.options)),
      customConfig: JSON.parse(JSON.stringify(this.engine.customConfig)),
      players: JSON.parse(JSON.stringify(this.engine.players)),
      deck: JSON.parse(JSON.stringify(this.engine.deck)),
      trumpCard: JSON.parse(JSON.stringify(this.engine.trumpCard)),
      trumpSuit: this.engine.trumpSuit,
      discardPile: JSON.parse(JSON.stringify(this.engine.discardPile)),
      table: JSON.parse(JSON.stringify(this.engine.table)),
      attackerIndex: this.engine.attackerIndex,
      defenderIndex: this.engine.defenderIndex,
      roundNumber: this.engine.roundNumber,
      defenderTaking: this.engine.defenderTaking,
      passes: [...this.engine.passes],
      gameOver: this.engine.gameOver,
      loserPlayerId: this.engine.loserPlayerId,
      isDraw: this.engine.isDraw,
      lastRefereeMessage: this.engine.lastRefereeMessage,
    };
  }

  private applySnapshot(snapshot: NetSnapshot, instant: boolean = false): void {
    this.engine.options = snapshot.options as typeof this.engine.options;
    this.engine.customConfig = snapshot.customConfig as typeof this.engine.customConfig;
    this.engine.players = JSON.parse(JSON.stringify(snapshot.players));
    this.engine.deck = JSON.parse(JSON.stringify(snapshot.deck));
    this.engine.trumpCard = JSON.parse(JSON.stringify(snapshot.trumpCard));
    this.engine.trumpSuit = snapshot.trumpSuit;
    this.engine.discardPile = JSON.parse(JSON.stringify(snapshot.discardPile));
    this.engine.table = JSON.parse(JSON.stringify(snapshot.table));
    this.engine.attackerIndex = snapshot.attackerIndex;
    this.engine.defenderIndex = snapshot.defenderIndex;
    this.engine.roundNumber = snapshot.roundNumber;
    this.engine.defenderTaking = snapshot.defenderTaking;
    this.engine.passes = new Set(snapshot.passes);
    this.engine.gameOver = snapshot.gameOver;
    this.engine.loserPlayerId = snapshot.loserPlayerId;
    this.engine.isDraw = snapshot.isDraw;
    this.engine.lastRefereeMessage = snapshot.lastRefereeMessage;

    this.createMissingCardMeshes();
    this.sync3DCardPositions(instant);
    this.hud.update(this.engine, this.getPlayerLegalMoveNames());
    this.publishDiagnostics();
    this.checkAndRecordGameOver();
  }

  private broadcastStateNow(): void {
    if (this.net.isHost()) {
      this.net.broadcastState(this.buildSnapshot());
    }
  }

  /** Vienetas po sėkmingo ėjimo (host arba offline žaidime). */
  private afterHostMove(move: Move): void {
    if (move.type === 'beat') this.audio.playCardBeat();
    else if (move.type === 'take') this.audio.playCardTake();
    else this.audio.playCardPlay();

    if (move.card) {
      this.emitMoveVfx(move.card);
    }
    this.sync3DCardPositions();
    this.hud.update(this.engine, this.getPlayerLegalMoveNames());
    this.publishDiagnostics();
    this.checkAndRecordGameOver();
    this.broadcastStateNow();
    this.triggerAiTurnIfNeeded();
  }

  /** Maršrutizuoja žmogaus ėjimą: klientas siunčia hostui, hostas vykdo vietoje. */
  private submitMove(move: Move, onAccepted: (success: boolean) => void): void {
    if (this.net.isActive() && !this.net.isHost()) {
      this.net.sendMove(move);
      // Klientas nevykdo ėjimo vietoje – laukia hosto būsenos
      onAccepted(true);
      return;
    }
    const success = this.engine.executeMove(move);
    if (success) {
      this.afterHostMove(move);
    }
    onAccepted(success);
  }

  private rebuildCardMeshes(): void {
    for (const [, mesh] of this.cardMeshes) {
      this.scene.remove(mesh);
    }
    this.cardMeshes.clear();
    this.createMissingCardMeshes();
  }

  private createMissingCardMeshes(): void {
    const all: Card[] = [];
    for (const p of this.engine.players) all.push(...p.hand);
    all.push(...this.engine.deck);
    all.push(...this.engine.discardPile);
    if (this.engine.trumpCard) all.push(this.engine.trumpCard);
    for (const b of this.engine.table) {
      all.push(b.attack);
      if (b.defense) all.push(b.defense);
    }

    for (const c of all) {
      if (this.cardMeshes.has(c.id)) continue;
      const mesh = CardFactory.createCardMesh(c);
      mesh.position.set(5.8, 0.5, 0);
      mesh.rotation.set(0, 0, Math.PI);
      this.scene.add(mesh);
      this.cardMeshes.set(c.id, mesh);
    }
  }

  private sync3DCardPositions(instant: boolean = false): void {
    const duration = instant || this.reducedMotion ? 0.05 : 0.45;
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const isMobilePortrait = width < height && width < 768;
    const isShortLandscape = height <= 520 && width >= height;

    this.tableScene.setMobileLayout(isMobilePortrait);

    // 1. Position DECK cards
    const deckBasePos = isMobilePortrait ? new THREE.Vector3(3.2, 0, -2.4) : new THREE.Vector3(5.8, 0, 0);

    this.engine.deck.forEach((card, idx) => {
      const mesh = this.cardMeshes.get(card.id);
      if (!mesh) return;

      const isBottomTrump = this.engine.trumpCard && card.id === this.engine.trumpCard.id;
      if (isBottomTrump) {
        const trumpPos = isMobilePortrait
          ? new THREE.Vector3(deckBasePos.x - 0.75, 0.03, deckBasePos.z)
          : new THREE.Vector3(5.05, 0.03, 0);
        const targetRot = new THREE.Euler(0, Math.PI / 2, 0);
        if (instant) {
          mesh.position.copy(trumpPos);
          mesh.rotation.copy(targetRot);
        } else {
          this.animator.animateTo(mesh, trumpPos, targetRot, duration, 0.3);
        }
      } else {
        const stackY = 0.055 + idx * 0.016;
        const targetPos = new THREE.Vector3(deckBasePos.x, stackY, deckBasePos.z);
        const targetRot = new THREE.Euler(0, 0, Math.PI);
        if (instant) {
          mesh.position.copy(targetPos);
          mesh.rotation.copy(targetRot);
        } else {
          this.animator.animateTo(mesh, targetPos, targetRot, duration, 0.2);
        }
      }
    });

    // 2. Position DISCARD PILE (Bita)
    const discardBasePos = isMobilePortrait ? new THREE.Vector3(-3.2, 0, -2.4) : new THREE.Vector3(-5.8, 0, 0);

    this.engine.discardPile.forEach((card, idx) => {
      const mesh = this.cardMeshes.get(card.id);
      if (!mesh) return;
      const stackY = 0.04 + idx * 0.014;
      const targetPos = new THREE.Vector3(discardBasePos.x, stackY, discardBasePos.z);
      const angle = ((idx * 0.27) % 0.6) - 0.3;
      const targetRot = new THREE.Euler(0, angle, Math.PI);
      if (instant) {
        mesh.position.copy(targetPos);
        mesh.rotation.copy(targetRot);
      } else {
        this.animator.animateTo(mesh, targetPos, targetRot, duration, 0.6);
      }
    });

    // 3. Position PLAYER'S HAND (Human at bottom center)
    const human = this.me();
    const totalCards = human.hand.length;

    // Dynamic hand page sizing
    this.handPageSize = isMobilePortrait ? 6 : isShortLandscape ? 8 : 10;
    if (this.handStartIndex >= totalCards) {
      this.handStartIndex = Math.max(0, totalCards - this.handPageSize);
    }

    const visibleSlice =
      totalCards <= this.handPageSize
        ? human.hand
        : human.hand.slice(this.handStartIndex, this.handStartIndex + this.handPageSize);

    const visibleCount = visibleSlice.length;
    const maxHandWidth = isMobilePortrait ? 5.6 : isShortLandscape ? 7.2 : 8.2;
    const spacing = Math.min(1.15, maxHandWidth / Math.max(visibleCount, 1));
    const startX = -((visibleCount - 1) * spacing) / 2;

    human.hand.forEach((card, overallIdx) => {
      const mesh = this.cardMeshes.get(card.id);
      if (!mesh) return;

      const isSelected = this.selectedCardId === card.id;
      const visibleIdx = visibleSlice.findIndex((c) => c.id === card.id);

      if (visibleIdx !== -1) {
        // Visible in current hand window
        const posX = startX + visibleIdx * spacing;
        const liftY = isSelected ? 0.7 : 0;
        const forwardZ = isSelected ? -0.3 : 0;
        const baseZ = isMobilePortrait ? 4.9 : isShortLandscape ? 3.6 : 4.2;
        const posZ = baseZ + Math.abs(posX) * 0.04 + forwardZ;
        const arcY = (isMobilePortrait ? 0.95 : 0.82) - Math.abs(posX) * 0.035 + liftY;
        const rotZ = -posX * 0.045;

        const targetPos = new THREE.Vector3(posX, arcY, posZ);
        const targetRot = new THREE.Euler(isMobilePortrait ? -0.45 : -0.38, 0, rotZ);

        this.setCardOutlineVisible(mesh, isSelected);

        if (instant) {
          mesh.position.copy(targetPos);
          mesh.rotation.copy(targetRot);
        } else {
          this.animator.animateTo(mesh, targetPos, targetRot, duration, 0.4);
        }
      } else {
        // Hidden off-screen in pager: stack neatly to left or right
        const isLeft = overallIdx < this.handStartIndex;
        const tuckedX = isLeft ? -3.8 : 3.8;
        const tuckedZ = 5.2;
        const tuckedPos = new THREE.Vector3(tuckedX, 0.2, tuckedZ);
        const tuckedRot = new THREE.Euler(-0.4, 0, isLeft ? -0.4 : 0.4);
        this.setCardOutlineVisible(mesh, false);

        if (instant) {
          mesh.position.copy(tuckedPos);
          mesh.rotation.copy(tuckedRot);
        } else {
          this.animator.animateTo(mesh, tuckedPos, tuckedRot, duration, 0.4);
        }
      }
    });

    this.hud.updateHandPager(totalCards, this.handStartIndex, this.handPageSize);

    // 4. Position OPPONENT HANDS (2 to 8 players)
    // Vietos sukamos taip, kad vietinis žaidėjas visada būtų apačioje;
    // priešininkų lizdas k (1..n-1) atitinka stalą (localSeat + k) % n.
    const totalPlayers = this.engine.players.length;
    const showAiHands = this.engine.customConfig.interface.show_ai_hands;

    for (let slot = 1; slot < totalPlayers; slot++) {
      const pIdx = (this.localSeat + slot) % totalPlayers;
      const opp = this.engine.players[pIdx];
      const count = opp.hand.length;
      const oppSpacing = Math.min(0.75, (isMobilePortrait ? 3.2 : 4.2) / Math.max(count, 1));
      const oppStartX = -((count - 1) * oppSpacing) / 2;

      let basePos: THREE.Vector3;
      let baseAngleY: number;

      if (totalPlayers === 2) {
        basePos = new THREE.Vector3(0, 0.55, isMobilePortrait ? -4.8 : -4.35);
        baseAngleY = 0;
      } else if (totalPlayers === 3) {
        if (slot === 1) {
          basePos = new THREE.Vector3(isMobilePortrait ? -3.4 : -4.5, 0.55, -3.8);
          baseAngleY = 0.45;
        } else {
          basePos = new THREE.Vector3(isMobilePortrait ? 3.4 : 4.5, 0.55, -3.8);
          baseAngleY = -0.45;
        }
      } else if (totalPlayers === 4) {
        if (slot === 1) {
          basePos = new THREE.Vector3(0, 0.55, -4.35);
          baseAngleY = 0;
        } else if (slot === 2) {
          basePos = new THREE.Vector3(isMobilePortrait ? -4.5 : -7.5, 0.5, -0.6);
          baseAngleY = Math.PI / 2;
        } else {
          basePos = new THREE.Vector3(isMobilePortrait ? 4.5 : 7.5, 0.5, -0.6);
          baseAngleY = -Math.PI / 2;
        }
      } else {
        const progress = (slot - 1) / Math.max(totalPlayers - 2, 1);
        const angle = Math.PI * (0.88 - progress * 0.76);
        const rx = isMobilePortrait ? 4.8 : 7.5;
        const rz = isMobilePortrait ? 3.6 : 4.2;
        const px = Math.cos(angle) * rx;
        const pz = -Math.sin(angle) * rz;
        basePos = new THREE.Vector3(px, 0.55, pz);
        baseAngleY = Math.atan2(-px, -pz);
      }

      opp.hand.forEach((card, cIdx) => {
        const mesh = this.cardMeshes.get(card.id);
        if (!mesh) return;

        const offsetLocalX = oppStartX + cIdx * oppSpacing;
        const cosY = Math.cos(baseAngleY);
        const sinY = Math.sin(baseAngleY);

        const targetPos = new THREE.Vector3(
          basePos.x + offsetLocalX * cosY,
          basePos.y + cIdx * 0.006,
          basePos.z - offsetLocalX * sinY
        );

        const targetRot = showAiHands
          ? new THREE.Euler(0.25, baseAngleY, 0)
          : new THREE.Euler(0.28, baseAngleY, Math.PI);

        if (instant) {
          mesh.position.copy(targetPos);
          mesh.rotation.copy(targetRot);
        } else {
          this.animator.animateTo(mesh, targetPos, targetRot, duration, 0.4);
        }
      });
    }

    // 5. Position TABLE BOUTS (Center attack & defense cards)
    const tableBoutsCount = Math.max(this.engine.table.length, 1);
    const boutSpacing = isMobilePortrait ? 1.45 : 1.95;
    const boutStartX = -((tableBoutsCount - 1) * boutSpacing) / 2;

    this.engine.table.forEach((bout, bIdx) => {
      const boutX = boutStartX + bIdx * boutSpacing;
      const centerZ = isMobilePortrait ? 0.35 : 0.32;

      // Attack card
      const atkMesh = this.cardMeshes.get(bout.attack.id);
      if (atkMesh) {
        const targetPos = new THREE.Vector3(boutX, 0.08, centerZ);
        const targetRot = new THREE.Euler(0, 0.08, 0);
        if (instant) {
          atkMesh.position.copy(targetPos);
          atkMesh.rotation.copy(targetRot);
        } else {
          this.animator.animateTo(atkMesh, targetPos, targetRot, duration, 0.5);
        }
      }

      // Defense card (slightly overlapping and tilted)
      if (bout.defense) {
        const defMesh = this.cardMeshes.get(bout.defense.id);
        if (defMesh) {
          const targetPos = new THREE.Vector3(boutX + 0.16, 0.16, centerZ - 0.22);
          const targetRot = new THREE.Euler(0, -0.2, 0);
          if (instant) {
            defMesh.position.copy(targetPos);
            defMesh.rotation.copy(targetRot);
          } else {
            this.animator.animateTo(defMesh, targetPos, targetRot, duration, 0.55);
          }
        }
      }
    });
  }

  private getCardAtClientCoordinates(clientX: number, clientY: number): { cardGroup: THREE.Group; card: Card } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.cardMeshes.values()).map((g) => g.children[0] || g);
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      let root = intersects[0].object;
      while (root.parent && !(root.userData && root.userData.isCard)) {
        root = root.parent as any;
      }
      if (root && root.userData && root.userData.isCard) {
        const cardGroup = root as THREE.Group;
        const card = cardGroup.userData.card as Card;
        const isHumanCard = this.me().hand.some((c) => c.id === card.id);
        if (isHumanCard) {
          return { cardGroup, card };
        }
      }
    }
    return null;
  }

  private setCardOutlineVisible(cardGroup: THREE.Group, visible: boolean): void {
    const outline = cardGroup.userData?.outline as THREE.LineSegments | undefined;
    if (outline && outline.material) {
      (outline.material as THREE.LineBasicMaterial).opacity = visible ? 0.95 : 0;
    }
  }

  private setupInteractions(): void {
    const onPointerDown = (e: PointerEvent) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY, time: performance.now() };
    };

    const onPointerMove = (e: MouseEvent) => {
      // Desktop hover feedback
      if (window.matchMedia('(hover: hover)').matches) {
        const hit = this.getCardAtClientCoordinates(e.clientX, e.clientY);
        if (hit) {
          if (this.hoveredCard !== hit.cardGroup) {
            if (this.hoveredCard && this.hoveredCard.userData.card?.id !== this.selectedCardId) {
              this.hoveredCard.position.y -= 0.35;
              this.setCardOutlineVisible(this.hoveredCard, false);
            }
            this.hoveredCard = hit.cardGroup;
            if (this.hoveredCard.userData.card?.id !== this.selectedCardId) {
              this.hoveredCard.position.y += 0.35;
              this.setCardOutlineVisible(this.hoveredCard, true);
            }
          }
        } else if (this.hoveredCard && this.hoveredCard.userData.card?.id !== this.selectedCardId) {
          this.hoveredCard.position.y -= 0.35;
          this.setCardOutlineVisible(this.hoveredCard, false);
          this.hoveredCard = null;
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      // Guard against accidental plays while scrolling/swiping
      if (this.pointerDownPos) {
        const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
        this.pointerDownPos = null;
        if (dist > 12) {
          // User was scrolling, not selecting
          return;
        }
      }

      const hit = this.getCardAtClientCoordinates(e.clientX, e.clientY);
      if (hit) {
        this.handleCardSelectionOrPlay(hit.card);
      } else {
        // Tapped empty felt/table area
        if (this.selectedCardId) {
          this.selectedCardId = null;
          this.sync3DCardPositions();
          this.hud.updateSelectedCardAction(null, null);
        }
      }
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    this.canvas.addEventListener('pointerup', onPointerUp);
    window.addEventListener('mousemove', onPointerMove);
  }

  private handleCardSelectionOrPlay(card: Card): void {
    const legalMoves = this.engine.getLegalMovesForPlayer(this.localSeat);
    const matchingMoves = legalMoves.filter((m) => m.card && m.card.id === card.id);

    if (matchingMoves.length === 0) {
      this.audio.playError();
      this.hud.showRefereeAlert('Šia korta šiuo metu eiti negalite.');
      return;
    }

    if (this.selectedCardId === card.id) {
      // Second tap on already selected card -> execute play
      this.playSelectedCard();
    } else {
      // First tap -> select and lift card, update action dock
      this.selectedCardId = card.id;
      this.sync3DCardPositions();

      const moveType = matchingMoves[0].type as 'attack' | 'throw_in' | 'beat' | 'transfer';
      this.hud.updateSelectedCardAction(card, moveType);

      // If defending and multiple attacks are open on table:
      if (moveType === 'beat') {
        const beatableBouts: Array<{ boutIndex: number; attackCard: Card }> = [];
        this.engine.table.forEach((bout, bIdx) => {
          if (bout.defense === null && this.engine.canBeat(bout.attack, card)) {
            beatableBouts.push({ boutIndex: bIdx, attackCard: bout.attack });
          }
        });

        if (beatableBouts.length > 1) {
          this.hud.showDefenseTargetSelection(beatableBouts, (targetBoutIdx) => {
            this.playSelectedCard(targetBoutIdx);
          });
        }
      }
    }
  }

  private playSelectedCard(targetBoutIndex?: number): void {
    if (!this.selectedCardId) return;

    const cardId = this.selectedCardId;
    const legalMoves = this.engine.getLegalMovesForPlayer(this.localSeat);
    const matchingMoves = legalMoves.filter((m) => m.card && m.card.id === cardId);

    if (matchingMoves.length === 0) {
      this.audio.playError();
      this.hud.showRefereeAlert('Šia korta šiuo metu eiti negalite.');
      return;
    }

    let move: Move;
    if (targetBoutIndex !== undefined) {
      move = matchingMoves.find((m) => m.targetAttackIndex === targetBoutIndex) || matchingMoves[0];
    } else {
      move = matchingMoves[0];
    }

    this.submitMove(move, (success) => {
      if (success) {
        this.selectedCardId = null;
        this.hud.updateSelectedCardAction(null, null);
      } else {
        this.audio.playError();
        this.hud.showRefereeAlert(this.engine.lastRefereeMessage);
      }
    });
  }

  private emitMoveVfx(card?: Card): void {
    if (!card) return;
    const isTrump = card.suit === this.engine.trumpSuit;
    this.vfx.emitCardImpact(new THREE.Vector3(0, 0.1, 0.2), isTrump, this.reducedMotion);
  }

  private handlePlayerAction(action: 'take' | 'pass'): void {
    const legalMoves = this.engine.getLegalMovesForPlayer(this.localSeat);
    const move = legalMoves.find((m) => m.type === action);

    if (!move) {
      this.audio.playError();
      this.hud.showRefereeAlert(`Veiksmas „${action}“ šiuo metu neleistinas.`);
      return;
    }

    this.submitMove(move, (success) => {
      if (success) {
        this.selectedCardId = null;
        this.hud.updateSelectedCardAction(null, null);
      } else {
        this.audio.playError();
        this.hud.showRefereeAlert(this.engine.lastRefereeMessage);
      }
    });
  }

  private handleHint(): void {
    const best = this.ai.getBestMove(this.localSeat);
    if (best) {
      if (best.card) {
        this.selectedCardId = best.card.id;
        this.sync3DCardPositions();
        this.hud.updateSelectedCardAction(best.card, best.type as any);
        this.hud.showRefereeAlert(`Mokytojo patarimas: eikite su ${this.engine.formatCard(best.card)}.`);
      } else {
        this.hud.showRefereeAlert(`Mokytojo patarimas: atlikite veiksmą „${best.type}“.`);
      }
    } else {
      this.hud.showRefereeAlert('Šiuo metu leistinų ėjimų nėra.');
    }
  }

  private checkAndRecordGameOver(): void {
    if (this.engine.gameOver && !this.matchRecorded) {
      this.matchRecorded = true;
      // Reitingus registruoja tik šeimininkas / offline žaidimas
      if (this.net.isActive() && !this.net.isHost()) return;
      const humanWon = this.engine.loserPlayerId !== this.localSeat && !this.engine.isDraw;
      const loser = this.engine.players.find((p) => p.id === this.engine.loserPlayerId);
      const loserName = loser ? loser.name : 'Nėra';
      this.leaderboard.recordMatch(humanWon, loserName, this.engine.roundNumber);
    }
  }

  private triggerAiTurnIfNeeded(): void {
    if (this.engine.gameOver) {
      this.checkAndRecordGameOver();
      this.audio.playSuccess();
      return;
    }

    // Internetiniame žaidime AI valdo tik šeimininkas
    if (this.net.isActive() && !this.net.isHost()) return;

    if (this.aiTurnTimeout) clearTimeout(this.aiTurnTimeout);

    const aiDelay = this.reducedMotion ? 120 : 650;
    this.aiTurnTimeout = setTimeout(() => {
      // Find an AI player that has a legal move
      for (let i = 1; i < this.engine.players.length; i++) {
        const seat = (this.localSeat + i) % this.engine.players.length;
        const player = this.engine.players[seat];
        if (player.isExited || !player.isAi) continue;
        const legal = this.engine.getLegalMovesForPlayer(seat);
        if (legal.length > 0) {
          this.performAiTurn(seat);
          break;
        }
      }
    }, aiDelay);
  }

  private performAiTurn(playerIndex: number): void {
    if (this.engine.gameOver) return;

    const move = this.ai.getBestMove(playerIndex);
    if (move) {
      const ok = this.engine.executeMove(move);
      if (ok) {
        this.afterHostMove(move);
      }
    }
  }

  private getPlayerLegalMoveNames(): string[] {
    return this.engine.getLegalMovesForPlayer(this.localSeat).map((m) => m.type);
  }

  private setupLifecycle(): void {
    // Handle backgrounding / visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.loop.stop();
      } else {
        this.loop.start();
        const settings = this.graphicsQuality.getSettings();
        resizeRenderer(this.renderer, this.camera, this.composer, settings.maxDpr);
        this.sync3DCardPositions(true);
      }
    });

    window.addEventListener('resize', () => {
      const settings = this.graphicsQuality.getSettings();
      resizeRenderer(this.renderer, this.camera, this.composer, settings.maxDpr);
      this.sync3DCardPositions();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        const settings = this.graphicsQuality.getSettings();
        resizeRenderer(this.renderer, this.camera, this.composer, settings.maxDpr);
        this.sync3DCardPositions();
      }, 100);
    });
  }

  private update(delta: number): void {
    if (this.pausedForScreenshot) return;
    this.frameCounter += 1;
    this.elapsedSeconds += delta;

    this.graphicsQuality.recordFrame(delta);

    const settings = this.graphicsQuality.getSettings();
    const resized = resizeRenderer(this.renderer, this.camera, this.composer, settings.maxDpr);
    if (resized) {
      this.sync3DCardPositions();
    }

    this.animator.update(delta);
    if (settings.particlesEnabled) {
      this.vfx.update(delta);
    }
    this.publishDiagnostics();
  }

  private render(): void {
    this.composer.render();
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value: number) => {
        this.rng = createSeededRandom(value);
        this.startNewGame();
      },
      setState: (name: string) => {
        if (name === 'active-play') {
          this.startNewGame();
          if (this.engine.table.length === 0 && this.engine.players[this.engine.attackerIndex]) {
            const attacker = this.engine.players[this.engine.attackerIndex];
            if (attacker.hand.length > 0) {
              this.engine.executeMove({
                type: 'attack',
                playerId: attacker.id,
                card: attacker.hand[0],
              });
              this.sync3DCardPositions(true);
              this.hud.update(this.engine, this.getPlayerLegalMoveNames());
            }
          }
        } else if (name === 'perevodnoy-transfer') {
          this.startNewGame({ variant: 'perevodnoy_durak' });
        } else if (name === 'complete') {
          this.engine.gameOver = true;
          this.engine.loserPlayerId = 1;
          this.engine.lastRefereeMessage = 'Žaidimas baigtas! AI Jonas liko durniumi!';
          this.checkAndRecordGameOver();
          this.hud.update(this.engine, []);
        } else {
          throw new Error(`Unknown state: ${name}`);
        }
        this.animator.finishAll();
        this.render();
        this.publishDiagnostics();
        return { state: name };
      },
      setPausedForScreenshot: (paused: boolean) => {
        this.pausedForScreenshot = paused;
      },
      setReducedMotion: (enabled: boolean) => {
        this.reducedMotion = enabled;
        if (enabled) {
          this.animator.finishAll();
          this.vfx.clear();
        }
      },
      hideDebugUi: (_hidden: boolean) => {},
    };
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: Math.max(12, this.frameCounter),
      elapsed: this.elapsedSeconds,
      score: this.engine.roundNumber,
      targetScore: 10,
      complete: this.engine.gameOver,
      player: {
        position: { x: 0, y: 0, z: 0 },
        speed: 0,
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: window.devicePixelRatio || 1,
      },
    };
  }

  public dispose(): void {
    if (this.aiTurnTimeout) clearTimeout(this.aiTurnTimeout);
    this.loop.stop();
    this.vfx.clear();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
