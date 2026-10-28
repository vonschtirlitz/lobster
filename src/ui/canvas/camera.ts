import type { Vec2 } from '../../model/types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MIN_ZOOM = 0.5; // px per pace
const MAX_ZOOM = 200;

/** World (paces, y up) ↔ screen (CSS px, y down). `centre` is the world point at the viewport centre. */
export class Camera {
  zoom = 8;
  centre: Vec2 = { x: 0, y: 0 };
  width = 1;
  height = 1;

  setViewport(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
  }

  worldToScreen(p: Vec2): Vec2 {
    return {
      x: this.width / 2 + (p.x - this.centre.x) * this.zoom,
      y: this.height / 2 - (p.y - this.centre.y) * this.zoom,
    };
  }

  screenToWorld(p: Vec2): Vec2 {
    return {
      x: this.centre.x + (p.x - this.width / 2) / this.zoom,
      y: this.centre.y - (p.y - this.height / 2) / this.zoom,
    };
  }

  pan(dxPx: number, dyPx: number) {
    this.centre = { x: this.centre.x - dxPx / this.zoom, y: this.centre.y + dyPx / this.zoom };
  }

  zoomAt(screenPt: Vec2, factor: number) {
    const before = this.screenToWorld(screenPt);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    const after = this.screenToWorld(screenPt);
    this.centre = { x: this.centre.x + before.x - after.x, y: this.centre.y + before.y - after.y };
  }

  fit(b: Bounds, marginPx = 40) {
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    const zx = (this.width - 2 * marginPx) / w;
    const zy = (this.height - 2 * marginPx) / h;
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(zx, zy)));
    this.centre = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }
}
