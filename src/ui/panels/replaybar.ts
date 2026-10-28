import type { Store } from '../../state/store';
import type { Replay } from '../../state/replay';
import { getDrill } from '../../drill/registry';
import { segmentAt } from '../../engine/execute';
import { h } from '../dom';
import { wordsFor } from './orders';

const SPEEDS = [0.5, 1, 2, 4];

const svg = (body: string) =>
  `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">${body}</svg>`;
const ICONS = {
  play: svg('<path d="M3 1.5v11l9-5.5z"/>'),
  pause: svg('<rect x="2.5" y="1.5" width="3" height="11"/><rect x="8.5" y="1.5" width="3" height="11"/>'),
  prev: svg('<rect x="1.5" y="1.5" width="2" height="11"/><path d="M12.5 1.5v11L4.5 7z"/>'),
  next: svg('<rect x="10.5" y="1.5" width="2" height="11"/><path d="M1.5 1.5v11L9.5 7z"/>'),
};

const clock = (s: number) => {
  const whole = Math.max(0, Math.round(s));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

export function mountReplayBar(el: HTMLElement, store: Store, replay: Replay) {
  const play = h('button', { type: 'button', 'aria-label': 'Play' });
  const prev = h('button', { type: 'button', 'aria-label': 'Previous order', title: 'Previous order' });
  const next = h('button', { type: 'button', 'aria-label': 'Next order', title: 'Next order' });
  prev.innerHTML = ICONS.prev;
  next.innerHTML = ICONS.next;
  const range = h('input', { type: 'range', min: '0', max: '0', step: '0.05', value: '0', 'aria-label': 'Replay time' });
  const ticks = h('div', { class: 'ticks', 'aria-hidden': 'true' });
  const time = h('span', { class: 'time' });
  const speed = h(
    'select',
    { 'aria-label': 'Replay speed' },
    ...SPEEDS.map((s) => h('option', { value: String(s), selected: s === 1 }, `${s}×`)),
  );
  const now = h('div', { class: 'note' });

  const boundaries = () => {
    const id = store.ui().selected[0];
    const segs = (id && replay.timeline().segments.get(id)) || [];
    const marks = segs.filter((s) => !s.error).flatMap((s) => [s.t0, s.t1]);
    return [0, ...marks, replay.timeline().duration].sort((a, b) => a - b);
  };

  play.addEventListener('click', () => (replay.playing() ? replay.pause() : replay.play()));
  prev.addEventListener('click', () => {
    replay.pause();
    const t = replay.t();
    replay.seek(boundaries().filter((b) => b < t - 0.01).pop() ?? 0);
  });
  next.addEventListener('click', () => {
    replay.pause();
    const t = replay.t();
    replay.seek(boundaries().find((b) => b > t + 0.01) ?? replay.timeline().duration);
  });
  range.addEventListener('input', () => {
    replay.pause();
    replay.seek(Number(range.value));
  });
  speed.addEventListener('change', () => replay.setSpeed(Number(speed.value)));

  window.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement | null;
    if (e.key !== ' ' || (target && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(target.tagName))) return;
    e.preventDefault();
    if (replay.playing()) replay.pause();
    else replay.play();
  });

  const update = () => {
    const tl = replay.timeline();
    const t = replay.t();
    range.max = String(tl.duration);
    range.value = String(t);
    play.innerHTML = replay.playing() ? ICONS.pause : ICONS.play;
    play.setAttribute('aria-label', replay.playing() ? 'Pause' : 'Play');
    time.textContent = `${clock(t)} / ${clock(tl.duration)}`;
    const id = store.ui().selected[0];
    const segs = (id && tl.segments.get(id)) || [];
    ticks.replaceChildren(
      ...segs
        .filter((s) => !s.error && tl.duration > 0)
        .map((s, i) => h('span', { style: `left:${(s.t0 / tl.duration) * 100}%` }, String(i + 1))),
    );
    const d = getDrill(store.get().drillId);
    const seg = id ? segmentAt(tl, id, t) : undefined;
    const idx = seg ? segs.indexOf(seg) : -1;
    now.textContent =
      tl.duration === 0
        ? 'Add orders to a company to replay them.'
        : seg && !seg.error && (replay.playing() || t > 0) && t < seg.t1
          ? `${idx + 1}. ${wordsFor(seg.order, d)}`
          : t >= tl.duration && t > 0
            ? 'Orders complete.'
            : '';
  };

  el.replaceChildren(h('div', { class: 'bar' }, prev, play, next, h('div', { class: 'track' }, ticks, range), time, speed), now);
  replay.subscribe(update);
  store.subscribe(update);
  update();
}
