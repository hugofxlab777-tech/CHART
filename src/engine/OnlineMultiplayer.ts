import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { Card, Move, PlayerState, Suit, TableBout } from './types';

/**
 * Host-authoritative tinklas per PeerJS (WebRTC).
 * Šeimininkas (host) laiko visa žaidimo būsena ir po kiekvieno ėjimo
 * transliuoja pilną snapshot'ą. Klientai siunčia tik savo Move objektus.
 */

export interface NetSnapshot {
  options: unknown;
  customConfig: unknown;
  players: PlayerState[];
  deck: Card[];
  trumpCard: Card | null;
  trumpSuit: Suit;
  discardPile: Card[];
  table: TableBout[];
  attackerIndex: number;
  defenderIndex: number;
  roundNumber: number;
  defenderTaking: boolean;
  passes: number[];
  gameOver: boolean;
  loserPlayerId: number | null;
  isDraw: boolean;
  lastRefereeMessage: string;
}

export interface NetPlayerInfo {
  seat: number;
  name: string;
}

export type NetMessage =
  | { t: 'hello'; name: string }
  | { t: 'lobby'; players: NetPlayerInfo[]; hostName: string }
  | { t: 'start'; seat: number; configJson: string; snapshot: NetSnapshot }
  | { t: 'state'; snapshot: NetSnapshot }
  | { t: 'move'; move: Move }
  | { t: 'notice'; text: string }
  | { t: 'leave' };

export type NetStatus = 'offline' | 'connecting' | 'hosting' | 'waiting' | 'connected' | 'error';

const PEER_PREFIX = 'durak-chart-v1-';

// Keli STUN serveriai + kandidatų fondas — greitesniam ir patikimesniam ICE
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 8,
};

export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export class MultiplayerService {
  private peer: Peer | null = null;
  private conns = new Map<number, DataConnection>();
  private hostConn: DataConnection | null = null;
  private mySeat = 0;
  private playerName = 'Žaidėjas';

  public roomCode: string | null = null;
  public role: 'none' | 'host' | 'client' = 'none';

  // Callbacks (Game/lobby jas perrašo)
  public onLobbyUpdate: ((players: NetPlayerInfo[]) => void) | null = null;
  public onStart: ((seat: number, configJson: string, snapshot: NetSnapshot) => void) | null = null;
  public onState: ((snapshot: NetSnapshot) => void) | null = null;
  public onMove: ((seat: number, move: Move) => void) | null = null;
  public onStatus: ((status: NetStatus, detail?: string) => void) | null = null;
  public onNotice: ((text: string) => void) | null = null;

  public getMySeat(): number {
    return this.mySeat;
  }

  public isActive(): boolean {
    return this.role !== 'none';
  }

  public isHost(): boolean {
    return this.role === 'host';
  }

  private dbg(...args: unknown[]): void {
    console.log('[Net]', ...args);
  }

  public hostRoom(code: string, playerName: string): void {
    this.teardown();
    this.role = 'host';
    this.roomCode = code;
    this.playerName = playerName;
    this.mySeat = 0;
    this.onStatus?.('connecting');

    this.peer = new Peer(PEER_PREFIX + code, { config: ICE_CONFIG });
    this.dbg('host: kuriu peer', PEER_PREFIX + code);
    this.peer.on('open', () => {
      this.dbg('host: peer open');
      this.onStatus?.('hosting');
    });
    this.peer.on('disconnected', () => this.dbg('host: peer disconnected from signaling'));
    this.peer.on('error', (err: Error & { type?: string }) => {
      this.dbg('host: peer error', err.type, err.message);
      const detail =
        err.type === 'unavailable-id'
          ? 'Kambarys su šiuo kodu jau veikia. Pabandykite kitą kodą.'
          : `Tinklo klaida: ${err.message || err.type}`;
      this.onStatus?.('error', detail);
    });
    this.peer.on('connection', (conn) => {
      this.dbg('host: gaunamas prisijungimas');
      this.registerGuest(conn);
    });
  }

  public joinRoom(code: string, playerName: string): void {
    this.teardown();
    this.role = 'client';
    this.roomCode = code;
    this.playerName = playerName;
    this.onStatus?.('connecting');

    this.peer = new Peer({ config: ICE_CONFIG });
    this.peer.on('open', () => {
      this.dbg('client: peer open, jungiuosi į', PEER_PREFIX + code);
      this.connectToHostWithRetry(code, playerName);
    });
    this.peer.on('disconnected', () => this.dbg('client: peer disconnected'));
    this.peer.on('error', (err: Error & { type?: string }) => {
      this.dbg('client: peer error', err.type, err.message);
      const detail =
        err.type === 'peer-unavailable'
          ? 'Kambarys nerastas. Patikrinkite kodą.'
          : `Tinklo klaida: ${err.message || err.type}`;
      this.onStatus?.('error', detail);
    });
  }

  private connectToHostWithRetry(code: string, playerName: string, attempt: number = 1): void {
    const conn = this.peer!.connect(PEER_PREFIX + code, { reliable: true });
    this.hostConn = conn;
    let opened = false;

    conn.on('open', () => {
      opened = true;
      this.dbg('client: conn open (bandymas ' + attempt + ')');
      this.sendToHost({ t: 'hello', name: playerName });
      this.onStatus?.('waiting');
    });
    conn.on('data', (raw) => this.handleClientData(raw as NetMessage));
    conn.on('close', () => {
      this.dbg('client: conn close');
      if (this.role === 'client' && opened) this.onStatus?.('error', 'Ryšys su šeimininku nutrūko.');
    });
    conn.on('error', (err) => this.dbg('client: conn error', String(err)));

    // ICE kartais užstringa — po 10 s bandome ryšį iš naujo
    setTimeout(() => {
      if (!opened && this.role === 'client' && attempt < 3) {
        this.dbg('client: conn neatšilo, bandau dar kartą (', attempt, ')');
        try {
          conn.close();
        } catch {
          /* ignore */
        }
        this.connectToHostWithRetry(code, playerName, attempt + 1);
      }
    }, 10000);
  }

  public startGame(
    configJson: string,
    snapshot: NetSnapshot,
    seatAssignments: Map<DataConnection, number>
  ): void {
    for (const [conn, seat] of seatAssignments) {
      conn.send({ t: 'start', seat, configJson, snapshot } as NetMessage);
    }
  }

  public broadcastState(snapshot: NetSnapshot): void {
    const msg: NetMessage = { t: 'state', snapshot };
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  public sendMove(move: Move): void {
    this.sendToHost({ t: 'move', move });
  }

  public broadcastNotice(text: string): void {
    const msg: NetMessage = { t: 'notice', text };
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  public broadcastLobby(players: NetPlayerInfo[], hostName: string): void {
    const msg: NetMessage = { t: 'lobby', players, hostName };
    for (const conn of this.conns.values()) {
      if (conn.open) conn.send(msg);
    }
  }

  public teardown(): void {
    for (const conn of this.conns.values()) {
      try {
        conn.send({ t: 'leave' } as NetMessage);
        conn.close();
      } catch {
        /* ignore */
      }
    }
    if (this.hostConn) {
      try {
        this.hostConn.close();
      } catch {
        /* ignore */
      }
      this.hostConn = null;
    }
    this.conns.clear();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        /* ignore */
      }
      this.peer = null;
    }
    this.role = 'none';
    this.roomCode = null;
    this.mySeat = 0;
  }

  // --- Host pusė ---

  private registerGuest(conn: DataConnection): void {
    conn.on('data', (raw) => this.handleHostData(conn, raw as NetMessage));
    conn.on('close', () => this.dropGuest(conn));
    conn.on('error', () => this.dropGuest(conn));
  }

  private handleHostData(conn: DataConnection, msg: NetMessage): void {
    if (msg.t === 'hello') {
      const seat = this.conns.size + 1;
      this.conns.set(seat, conn);
      (conn as DataConnection & { _seat?: number })._seat = seat;
      this.onLobbyUpdate?.(this.getConnectedPlayers());
    } else if (msg.t === 'move') {
      const seat = (conn as DataConnection & { _seat?: number })._seat;
      if (seat !== undefined) this.onMove?.(seat, msg.move);
    }
  }

  private dropGuest(conn: DataConnection): void {
    const seat = (conn as DataConnection & { _seat?: number })._seat;
    if (seat === undefined) return;
    this.conns.delete(seat);
    this.onNotice?.(`Žaidėjas (vieta ${seat}) atsijungė ir pakeistas AI.`);
  }

  public getConnectedPlayers(): NetPlayerInfo[] {
    const players: NetPlayerInfo[] = [{ seat: 0, name: this.playerName }];
    for (const [seat] of this.conns) players.push({ seat, name: `Žaidėjas ${seat + 1}` });
    return players.sort((a, b) => a.seat - b.seat);
  }

  public getConnectionSeatMap(): Map<DataConnection, number> {
    const map = new Map<DataConnection, number>();
    for (const [seat, conn] of this.conns) map.set(conn, seat);
    return map;
  }

  // --- Client pusė ---

  private sendToHost(msg: NetMessage): void {
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  private handleClientData(msg: NetMessage): void {
    if (msg.t === 'lobby') {
      this.onLobbyUpdate?.(msg.players);
    } else if (msg.t === 'start') {
      this.mySeat = msg.seat;
      this.onStart?.(msg.seat, msg.configJson, msg.snapshot);
    } else if (msg.t === 'state') {
      this.onState?.(msg.snapshot);
    } else if (msg.t === 'notice') {
      this.onNotice?.(msg.text);
    } else if (msg.t === 'leave') {
      this.onStatus?.('error', 'Šeimininkas paliko kambarį.');
    }
  }
}
