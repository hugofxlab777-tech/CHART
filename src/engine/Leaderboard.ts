export interface LeaderboardEntry {
  id: string;
  name: string;
  teamId?: string;
  wins: number;
  losses: number;
  totalRounds: number;
  lastPlayed: string;
  /** Marks seeded showcase entries that are not real match history */
  demo?: boolean;
}

const STORAGE_KEY = 'durak_royal_leaderboard_v1';

export class LeaderboardManager {
  private entries: LeaderboardEntry[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.entries = JSON.parse(data);
      }
    } catch {
      // ignore
    }

    if (!this.entries || this.entries.length === 0) {
      // Demo entries so the table is not empty on first launch (marked "Demo")
      this.entries = [
        { id: 'player_0', name: 'Jūs', wins: 0, losses: 0, totalRounds: 0, lastPlayed: 'Šiandien' },
        { id: 'ai_rasa', name: 'AI Rasa', wins: 14, losses: 3, totalRounds: 72, lastPlayed: '2026-10-23', demo: true },
        { id: 'ai_jonas', name: 'AI Jonas', wins: 9, losses: 7, totalRounds: 54, lastPlayed: '2026-10-22', demo: true },
        { id: 'ai_tomas', name: 'AI Tomas', wins: 8, losses: 6, totalRounds: 48, lastPlayed: '2026-10-21', demo: true },
        { id: 'ai_saule', name: 'AI Saulė', wins: 6, losses: 8, totalRounds: 41, lastPlayed: '2026-10-20', demo: true },
      ];
      this.save();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // ignore
    }
  }

  public getEntries(): LeaderboardEntry[] {
    return [...this.entries].sort((a, b) => {
      const rateA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const rateB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      if (rateB !== rateA) return rateB - rateA;
      return b.wins - a.wins;
    });
  }

  public recordMatch(humanWon: boolean, loserName: string, roundsCount: number): void {
    let humanEntry = this.entries.find((e) => e.id === 'player_0');
    if (!humanEntry) {
      humanEntry = { id: 'player_0', name: 'Jūs', wins: 0, losses: 0, totalRounds: 0, lastPlayed: 'Šiandien' };
      this.entries.push(humanEntry);
    }

    if (humanWon) {
      humanEntry.wins += 1;
    } else {
      humanEntry.losses += 1;
    }
    humanEntry.totalRounds += roundsCount;
    humanEntry.lastPlayed = new Date().toISOString().split('T')[0];

    // If an AI opponent lost
    const oppEntry = this.entries.find((e) => e.name.toLowerCase().includes(loserName.toLowerCase()));
    if (oppEntry) {
      oppEntry.losses += 1;
      oppEntry.totalRounds += roundsCount;
      oppEntry.lastPlayed = new Date().toISOString().split('T')[0];
    }

    this.save();
  }

  public reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.entries = [];
    this.load();
  }
}

