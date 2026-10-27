import type { Block, Company, Figure, FigureRole, FormationState, Vec2 } from '../model/types';
import type { DrillSystem } from './types';
import { blocksInLine, flankPos, menFacingAngle } from '../model/layout';
import { add, fwd, lerp, right, scale } from '../model/vec';

// British 1764 Manual. Every number and word here is a placeholder until checked
// against the Manual and Cuthbertson.

const defaults: DrillSystem['defaults'] = {
  ranks: 3, // SOURCE NEEDED
  allowedRanks: [2, 3], // SOURCE NEEDED
  allowedOrders: ['close', 'open', 'extended'],
  fileInterval: { close: 0.75, open: 0.75, extended: 2 }, // SOURCE NEEDED
  rankDistance: { close: 1, open: 2, extended: 4 }, // SOURCE NEEDED
  defaultDress: 'right',
  platoonsPerCompany: 2, // SOURCE NEEDED
  steps: { ordinary: { pacesPerMinute: 60 }, quick: { pacesPerMinute: 120 } }, // SOURCE NEEDED
  beatSeconds: 1, // SOURCE NEEDED
};

/** A stretch of front rank that officers and NCOs are posted against. */
interface Frame {
  r: Vec2; // front-rank right flank
  l: Vec2; // front-rank left flank
  front: number;
  depth: number; // front rank to rear rank, paces
}

function blockFrame(b: Block, fi: number, rd: number): Frame {
  return { r: flankPos(b, 'right', fi), l: flankPos(b, 'left', fi), front: b.front, depth: Math.max(0, b.ranks - 1) * rd };
}

// SOURCE NEEDED: all posts below.
function postOfficersAndNcos(c: Company, s: FormationState): Figure[] {
  const blocks = s.blocks.filter((b) => b.files > 0);
  if (blocks.length === 0) return [];
  const fi = defaults.fileInterval[s.order];
  const rd = defaults.rankDistance[s.order];
  const frames = blocks.map((b) => blockFrame(b, fi, rd));
  const first = frames[0];
  const last = frames[frames.length - 1];
  const middle = frames[Math.floor((frames.length - 1) / 2)];
  const company: Frame = {
    r: first.r,
    l: last.l,
    front: first.front,
    depth: Math.max(...frames.map((f) => f.depth)),
  };
  const line = blocksInLine(s);
  const pick = (f: Frame) => (line ? company : f);

  const out: Figure[] = [];
  const put = (role: FigureRole, slot: string, frame: Frame, pos: Vec2) =>
    out.push({ role, slot, pos, facing: menFacingAngle(frame.front, s.menFacing) });
  const centre = (f: Frame) => lerp(f.r, f.l, 0.5);
  const behind = (f: Frame, p: Vec2, extra: number) => add(p, scale(fwd(f.front), -(f.depth + extra)));
  const ahead = (f: Frame, p: Vec2, k: number) => add(p, scale(fwd(f.front), k));

  if (c.officers.captain) put('captain', 'captain', pick(first), ahead(pick(first), pick(first).r, 1));
  if (c.officers.lieutenant) put('lieutenant', 'lieutenant', pick(last), ahead(pick(last), pick(last).l, 1));
  if (c.officers.ensign) put('ensign', 'ensign', pick(middle), behind(pick(middle), centre(pick(middle)), 2));

  const sgts = Math.max(0, c.ncos.sergeants);
  for (let i = 0; i < sgts; i++) {
    if (line) {
      put('sergeant', `sgt:${i}`, company, behind(company, lerp(company.r, company.l, (i + 1) / (sgts + 1)), 2));
    } else {
      const bi = i % frames.length;
      const n = Math.ceil((sgts - bi) / frames.length);
      const k = Math.floor(i / frames.length);
      const f = frames[bi];
      put('sergeant', `sgt:${i}`, f, behind(f, lerp(f.r, f.l, (k + 1) / (n + 1)), 2));
    }
  }

  const cpls = Math.max(0, c.ncos.corporals);
  for (let i = 0; i < cpls; i++) {
    const onRight = i % 2 === 0;
    const f = pick(onRight ? first : last);
    const out_ = Math.floor(i / 2) + 1;
    const side = scale(right(f.front), (onRight ? 1 : -1) * out_ * fi);
    put('corporal', `cpl:${i}`, f, behind(f, add(onRight ? f.r : f.l, side), 0));
  }

  if (c.ncos.drummer) put('drummer', 'drummer', pick(middle), behind(pick(middle), centre(pick(middle)), 3));
  return out;
}

const n = (p: Record<string, unknown>, k: string) => Number(p[k]);
const cap = (s: unknown) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

export const gb1764: DrillSystem = {
  id: 'gb-1764',
  name: '1764 Manual',
  defaults,
  // SOURCE NEEDED: words of command.
  commands: [
    {
      kind: 'march',
      words: 'March',
      params: [
        { key: 'paces', label: 'Paces', type: 'number', default: 10, min: 1 },
        { key: 'step', label: 'Step', type: 'choice', choices: ['ordinary', 'quick'], default: 'ordinary' },
      ],
      say: (p) => `${p.step === 'quick' ? 'Quick ' : ''}March — ${n(p, 'paces')} paces — Halt`,
    },
    {
      kind: 'face',
      words: 'Face',
      params: [
        { key: 'direction', label: 'To the', type: 'choice', choices: ['right', 'left', 'about', 'front'], default: 'right' },
      ],
      say: (p) =>
        p.direction === 'front' ? 'Front' : p.direction === 'about' ? 'To the Right about — Face' : `To the ${cap(p.direction)} — Face`,
    },
    {
      kind: 'wheel',
      words: 'Wheel',
      params: [
        { key: 'direction', label: 'To the', type: 'choice', choices: ['right', 'left'], default: 'right' },
        { key: 'degrees', label: 'Degrees', type: 'number', default: 90, min: 1, max: 360 },
        { key: 'by', label: 'By', type: 'choice', choices: ['company', 'platoons'], default: 'company' },
      ],
      say: (p) =>
        `${p.by === 'platoons' ? 'Platoons, to' : 'To'} the ${cap(p.direction)} — Wheel${n(p, 'degrees') !== 90 ? ` (${n(p, 'degrees')}°)` : ''} — Halt, Dress`,
    },
    {
      kind: 'spacing',
      words: 'Take order',
      params: [{ key: 'order', label: 'Order', type: 'choice', choices: ['close', 'open', 'extended'], default: 'open' }],
      say: (p) => `Rear ranks — take ${p.order} order — March`,
    },
    {
      kind: 'dress',
      words: 'Dress',
      params: [{ key: 'point', label: 'By the', type: 'choice', choices: ['right', 'centre', 'left'], default: 'right' }],
      say: (p) => `Dress by the ${p.point}`,
    },
    {
      kind: 'depth',
      words: 'Form deep',
      params: [{ key: 'ranks', label: 'Ranks', type: 'choice', choices: ['2', '3'], default: '3' }],
      say: (p) => `Form ${p.ranks} deep — March`,
    },
    {
      kind: 'wait',
      words: 'Mark time',
      params: [{ key: 'seconds', label: 'Seconds', type: 'number', default: 4, min: 0.5 }],
      say: (p) => `Mark time (${n(p, 'seconds')} s)`,
    },
  ],
  postOfficersAndNcos,
  terms: {
    rankAndFile: 'Rank and file',
    platoon: 'Platoon',
    files: 'files',
    ranks: 'ranks',
    order: 'Order',
    dress: 'Dress',
  },
};
