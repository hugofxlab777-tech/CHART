export class DurakAudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext(): void {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playCardPlay(): void {
    this.playTone(320, 0.08, 'triangle', 0.15);
  }

  public playCardBeat(): void {
    this.playTone(480, 0.1, 'sine', 0.2);
  }

  public playCardTake(): void {
    this.playTone(200, 0.18, 'sawtooth', 0.12);
  }

  public playError(): void {
    this.playTone(160, 0.25, 'sawtooth', 0.25);
  }

  public playSuccess(): void {
    this.playArpeggio([523, 659, 784, 1046], 0.08);
  }

  private playTone(freq: number, duration: number, type: OscillatorType, volume: number): void {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  private playArpeggio(notes: number[], noteDuration: number): void {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      notes.forEach((freq, idx) => {
        const time = this.ctx!.currentTime + idx * noteDuration;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + noteDuration);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(time);
        osc.stop(time + noteDuration);
      });
    } catch {}
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
