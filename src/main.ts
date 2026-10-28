import './ui/styles.css';
import { createStore, defaultScene } from './state/store';
import { autosave, loadAutosave } from './state/persist';
import { createReplay } from './state/replay';
import { Camera } from './ui/canvas/camera';
import { drawScene, readPalette, sceneBounds, type Overlay } from './ui/canvas/render';
import { attachInteractions } from './ui/canvas/interact';
import { mountToolbar } from './ui/panels/toolbar';
import { mountSetup } from './ui/panels/setup';
import { mountOrders } from './ui/panels/orders';
import { mountReplayBar } from './ui/panels/replaybar';
import { h } from './ui/dom';

const store = createStore(loadAutosave() ?? defaultScene());
autosave(store);
const replay = createReplay(store);

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const field = document.getElementById('field')!;
const ctx = canvas.getContext('2d')!;
const cam = new Camera();
const overlay: Overlay = { previews: [] };
let palette = readPalette(document.documentElement);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  palette = readPalette(document.documentElement);
  invalidate();
});

let dirty = true;
export function invalidate() {
  dirty = true;
}

function resize() {
  const r = field.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cam.setViewport(r.width, r.height);
  invalidate();
}
new ResizeObserver(resize).observe(field);
resize();
cam.fit(sceneBounds(store));

store.subscribe(invalidate);
attachInteractions(canvas, cam, store, overlay, invalidate);
replay.subscribe(invalidate);

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    cam.zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, Math.exp(-e.deltaY * 0.0015));
    invalidate();
  },
  { passive: false },
);

function frame() {
  try {
    if (dirty) {
      dirty = false;
      drawScene(ctx, cam, store, replay, palette, overlay);
    }
  } finally {
    requestAnimationFrame(frame);
  }
}
requestAnimationFrame(frame);

function fit() {
  cam.fit(sceneBounds(store));
  invalidate();
}

function showError(message: string) {
  field.querySelector('.toast')?.remove();
  const toast = h(
    'div',
    { class: 'toast', role: 'alert' },
    h('span', {}, message),
    h('button', { type: 'button', on: { click: () => toast.remove() } }, 'Dismiss'),
  );
  field.append(toast);
}

mountToolbar(document.getElementById('toolbar')!, store, fit, showError);
mountSetup(document.getElementById('setup')!, store);
mountOrders(document.getElementById('orders')!, store, replay);
mountReplayBar(document.getElementById('replay')!, store, replay);
