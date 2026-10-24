export interface PeerMessage {
  type: 'join' | 'sync_state' | 'player_move' | 'chat';
  senderId: string;
  senderName: string;
  payload: any;
}

export class OnlineMultiplayerService {
  private roomId: string | null = null;
  private isHost: boolean = false;
  private messageListeners: ((msg: PeerMessage) => void)[] = [];

  constructor() {}

  public createRoom(roomName: string): string {
    this.roomId = roomName || 'durak-' + Math.random().toString(36).substring(2, 7);
    this.isHost = true;
    return this.roomId;
  }

  public joinRoom(roomName: string): boolean {
    this.roomId = roomName;
    this.isHost = false;
    return true;
  }

  public getRoomId(): string | null {
    return this.roomId;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public broadcast(type: PeerMessage['type'], payload: any, senderName: string = 'Žaidėjas'): void {
    const msg: PeerMessage = {
      type,
      senderId: this.isHost ? 'host' : 'peer',
      senderName,
      payload,
    };
    for (const listener of this.messageListeners) {
      listener(msg);
    }
  }

  public onMessage(listener: (msg: PeerMessage) => void): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
    };
  }
}

