import type { Timeline } from '../model/types';
import { execute } from '../engine/execute';
import { getDrill } from '../drill/registry';
import type { Scene, Store } from './store';

export interface Replay {
  timeline(): Timeline;
  t(): number;
  playing(): boolean;
  speed(): number;
  play(): void;
  pause(): void;
  seek(t: number): void;
  setSpeed(x: number): void;
  stepTo(companyId: string, index: number): void;
  subscribe(fn: () => void): () => void;
}

type Raf = (cb: (ts: number) => void) => unknown;

export function createReplay(
  store: Store,
  raf: Raf = (cb) => requestAnimationFrame(cb),
): Replay {
  let scene: Scene | null = null;
  let tl: Timeline | null = null;
  let t = 0;
  let playing = false;
  let speed = 1;
  let last: number | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  const timeline = (): Timeline => {
    const s = store.get();
    if (s !== scene || !tl) {
      scene = s;
      tl = execute(
        s.companies.map((c) => ({ company: c, start: s.current[c.id], orders: s.orders[c.id] ?? [] })),
        getDrill(s.drillId),
      );
      t = Math.min(t, tl.duration);
    }
    return tl;
  };

  const tick = (ts: number) => {
    if (!playing) return;
    const dur = timeline().duration;
    if (last !== null) t = Math.min(dur, t + ((ts - last) / 1000) * speed);
    last = ts;
    if (t >= dur) playing = false;
    notify();
    if (playing) raf(tick);
  };

  store.subscribe(() => {
    timeline();
    notify();
  });

  return {
    timeline,
    t: () => {
      timeline();
      return t;
    },
    playing: () => playing,
    speed: () => speed,
    play() {
      if (playing) return;
      if (t >= timeline().duration) t = 0;
      playing = true;
      last = null;
      raf(tick);
      notify();
    },
    pause() {
      playing = false;
      notify();
    },
    seek(x) {
      t = Math.max(0, Math.min(timeline().duration, x));
      notify();
    },
    setSpeed(x) {
      speed = x;
      notify();
    },
    stepTo(companyId, index) {
      const seg = timeline().segments.get(companyId)?.[index];
      if (seg) this.seek(seg.t0);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
