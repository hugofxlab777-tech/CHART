export type GraphicsPreset = 'low' | 'medium' | 'high' | 'auto';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  effectivePreset: 'low' | 'medium' | 'high';
  maxDpr: number;
  shadowMapEnabled: boolean;
  shadowMapSize: number;
  anisotropy: number;
  particlesEnabled: boolean;
  reducedMotion: boolean;
}

const STORAGE_KEY = 'durak_royal_graphics_preset';

export class GraphicsQualityManager {
  private currentPreset: GraphicsPreset = 'auto';
  private effectivePreset: 'low' | 'medium' | 'high' = 'medium';
  private frameDeltas: number[] = [];
  private lastDownshiftTime = 0;
  private lastUpshiftTime = 0;
  private onSettingsChanged?: (settings: GraphicsSettings) => void;

  constructor() {
    this.loadSavedPreset();
  }

  private loadSavedPreset(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as GraphicsPreset | null;
      if (saved && ['low', 'medium', 'high', 'auto'].includes(saved)) {
        this.currentPreset = saved;
      }
    } catch {
      this.currentPreset = 'auto';
    }

    if (this.currentPreset === 'auto') {
      // Conservative start on mobile, medium on desktop
      const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || window.innerHeight < 500);
      this.effectivePreset = isMobile ? 'medium' : 'high';
    } else {
      this.effectivePreset = this.currentPreset;
    }
  }

  public setCallback(cb: (settings: GraphicsSettings) => void): void {
    this.onSettingsChanged = cb;
  }

  public getPreset(): GraphicsPreset {
    return this.currentPreset;
  }

  public setPreset(preset: GraphicsPreset): void {
    this.currentPreset = preset;
    try {
      localStorage.setItem(STORAGE_KEY, preset);
    } catch {
      // ignore quota or security error
    }

    if (preset === 'auto') {
      const isMobile = window.innerWidth < 768 || window.innerHeight < 500;
      this.effectivePreset = isMobile ? 'medium' : 'high';
    } else {
      this.effectivePreset = preset;
    }

    this.notifyChange();
  }

  public recordFrame(deltaSeconds: number): void {
    if (this.currentPreset !== 'auto') return;

    this.frameDeltas.push(deltaSeconds);
    if (this.frameDeltas.length > 180) {
      // Analyze ~3 seconds of frames
      const sum = this.frameDeltas.reduce((a, b) => a + b, 0);
      const avgDelta = sum / this.frameDeltas.length;
      const fps = 1 / Math.max(0.0001, avgDelta);
      this.frameDeltas = [];

      const now = performance.now();
      // Downshift hysteresis (require 5s cooldown)
      if (fps < 38 && this.effectivePreset !== 'low' && now - this.lastDownshiftTime > 5000) {
        this.effectivePreset = this.effectivePreset === 'high' ? 'medium' : 'low';
        this.lastDownshiftTime = now;
        this.notifyChange();
      } else if (fps > 56 && this.effectivePreset !== 'high' && now - this.lastUpshiftTime > 8000) {
        this.effectivePreset = this.effectivePreset === 'low' ? 'medium' : 'high';
        this.lastUpshiftTime = now;
        this.notifyChange();
      }
    }
  }

  public getSettings(): GraphicsSettings {
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || window.innerHeight < 500);

    let maxDpr = 1.0;
    let shadowMapEnabled = true;
    let shadowMapSize = 1024;
    let anisotropy = 2;
    let particlesEnabled = true;

    if (this.effectivePreset === 'low') {
      maxDpr = 1.0;
      shadowMapEnabled = false;
      shadowMapSize = 512;
      anisotropy = 1;
      particlesEnabled = false;
    } else if (this.effectivePreset === 'medium') {
      maxDpr = isMobile ? 1.25 : 1.5;
      shadowMapEnabled = true;
      shadowMapSize = isMobile ? 1024 : 1024;
      anisotropy = 2;
      particlesEnabled = true;
    } else {
      // high
      maxDpr = isMobile ? 1.5 : Math.min(window.devicePixelRatio || 1, 2.0);
      shadowMapEnabled = true;
      shadowMapSize = 2048;
      anisotropy = 8;
      particlesEnabled = true;
    }

    return {
      preset: this.currentPreset,
      effectivePreset: this.effectivePreset,
      maxDpr,
      shadowMapEnabled,
      shadowMapSize,
      anisotropy,
      particlesEnabled,
      reducedMotion: false,
    };
  }

  private notifyChange(): void {
    if (this.onSettingsChanged) {
      this.onSettingsChanged(this.getSettings());
    }
  }
}

