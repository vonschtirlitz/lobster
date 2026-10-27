import './ui/styles.css';
import { createStore, defaultScene } from './state/store';
import { autosave, loadAutosave } from './state/persist';
import { createReplay } from './state/replay';
import { Camera } from './ui/canvas/camera';
import { drawScene, readPalette, sceneBounds, type Overlay } from './ui/canvas/render';
import { attachInteractions } from './ui/canvas/interact';

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
  if (dirty) {
    dirty = false;
    drawScene(ctx, cam, store, replay, palette, overlay);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
