import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SettingsService } from './settings.service';

type Sound = 'tap' | 'flip' | 'reveal' | 'pencil' | 'load' | 'bang' | 'miss' | 'thud' | 'coin' | 'win' | 'lose';

/**
 * Sound effects synthesised with Web Audio (no audio files to ship or
 * license) plus haptic feedback on phones.
 */
@Injectable({ providedIn: 'root' })
export class FxService {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  constructor(private settings: SettingsService) {}

  play(sound: Sound): void {
    if (!this.settings.value().sound) return;
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (sound) {
      case 'tap': this.tone(ctx, t, 520, 0.05, 'square', 0.06); break;
      case 'flip':
        for (let i = 0; i < 6; i++) this.hiss(ctx, t + i * 0.2, 0.12, 2500, 0.18);
        break;
      case 'reveal':
        this.tone(ctx, t, 660, 0.12, 'triangle', 0.18);
        this.tone(ctx, t + 0.1, 990, 0.2, 'triangle', 0.18);
        break;
      case 'pencil':
        for (let i = 0; i < 3; i++) this.hiss(ctx, t + i * 0.09, 0.07, 5000, 0.12);
        break;
      case 'load':
        this.tone(ctx, t, 300, 0.05, 'square', 0.12);
        this.tone(ctx, t + 0.12, 420, 0.06, 'square', 0.12);
        break;
      case 'bang':
        this.hiss(ctx, t, 0.35, 900, 0.9);
        this.sweep(ctx, t, 160, 40, 0.3, 0.6);
        break;
      case 'miss': this.hiss(ctx, t, 0.25, 3500, 0.25); break;
      case 'thud': this.sweep(ctx, t, 120, 50, 0.2, 0.4); break;
      case 'coin':
        for (let i = 0; i < 5; i++) this.tone(ctx, t + i * 0.14, 1800 + (i % 2) * 400, 0.05, 'sine', 0.08);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(ctx, t + i * 0.13, f, 0.22, 'triangle', 0.2));
        break;
      case 'lose':
        [392, 330, 262].forEach((f, i) => this.tone(ctx, t + i * 0.2, f, 0.3, 'sawtooth', 0.08));
        break;
    }
  }

  vibrate(kind: 'light' | 'heavy' | 'success' | 'error' = 'light'): void {
    if (!this.settings.value().vibration) return;
    if (Capacitor.isNativePlatform()) {
      if (kind === 'success') Haptics.notification({ type: NotificationType.Success }).catch(() => {});
      else if (kind === 'error') Haptics.notification({ type: NotificationType.Error }).catch(() => {});
      else Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Light }).catch(() => {});
    } else if ('vibrate' in navigator) {
      navigator.vibrate(kind === 'heavy' ? 120 : kind === 'light' ? 15 : [30, 40, 30]);
    }
  }

  // ── synth helpers ──────────────────────────────────────────────────────────

  private audio(): AudioContext | null {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(ctx: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, vol: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private sweep(ctx: AudioContext, at: number, from: number, to: number, dur: number, vol: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + dur);
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private hiss(ctx: AudioContext, at: number, dur: number, cutoff: number, vol: number): void {
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(at, Math.random() * 0.5, dur + 0.05);
  }
}
