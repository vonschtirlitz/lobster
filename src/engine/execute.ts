import type { DrillSystem } from '../drill/types';
import type { Company, Figure, FormationState, Order, Segment, Timeline, Vec2 } from '../model/types';
import { guidePoint } from '../model/formation';
import { layout } from '../model/layout';
import { buildSegment } from './primitives';

const PATH_STEP = 0.25; // seconds between path samples

export interface ExecuteInput {
  company: Company;
  start: FormationState;
  orders: Order[];
}

/** The last segment starting at or before t (binary search on t0). */
function findSegment(segs: Segment[], t: number): Segment | undefined {
  let lo = 0;
  let hi = segs.length - 1;
  let found: Segment | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].t0 <= t) {
      found = segs[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export function execute(input: ExecuteInput[], d: DrillSystem): Timeline {
  const segments = new Map<string, Segment[]>();
  const starts = new Map<string, FormationState>();
  const companies = new Map<string, Company>();
  let duration = 0;

  for (const { company, start, orders } of input) {
    companies.set(company.id, company);
    starts.set(company.id, start);
    const segs: Segment[] = [];
    let t = 0;
    let state = start;
    for (const order of orders) {
      const seg = buildSegment(order, t, state, company, d);
      segs.push(seg);
      if (seg.error) break;
      t = seg.t1;
      state = seg.end;
    }
    segments.set(company.id, segs);
    duration = Math.max(duration, t);
  }

  const endLayouts = new Map<string, Figure[]>();
  const paths = new Map<string, Vec2[]>();

  const sampleCompany = (id: string, t: number): Figure[] => {
    const c = companies.get(id)!;
    const segs = segments.get(id)!;
    const seg = findSegment(segs, t);
    if (!seg) return layout(c, starts.get(id)!, d);
    const last = segs[segs.length - 1];
    if (seg === last && t >= seg.t1) {
      if (!endLayouts.has(id)) endLayouts.set(id, layout(c, seg.end, d));
      return endLayouts.get(id)!;
    }
    return seg.sample(t);
  };

  const tracePath = (id: string): Vec2[] => {
    const c = companies.get(id)!;
    const pts: Vec2[] = [guidePoint(c, starts.get(id)!, d)];
    for (const seg of segments.get(id)!) {
      if (seg.error) break;
      if (seg.stateAt) {
        for (let t = seg.t0 + PATH_STEP; t < seg.t1; t += PATH_STEP) pts.push(guidePoint(c, seg.stateAt(t), d));
      }
      pts.push(guidePoint(c, seg.end, d));
    }
    return pts;
  };

  return {
    duration,
    starts,
    segments,
    sample: (t) => new Map([...companies.keys()].map((id) => [id, sampleCompany(id, t)])),
    path: (id) => {
      if (!companies.has(id)) return [];
      if (!paths.has(id)) paths.set(id, tracePath(id));
      return paths.get(id)!;
    },
  };
}

/** Where the company stands after its last order that could be carried out. */
export function endState(tl: Timeline, companyId: string): FormationState | undefined {
  const segs = tl.segments.get(companyId);
  if (!segs || segs.length === 0) return tl.starts.get(companyId);
  return segs[segs.length - 1].end;
}

export const segmentAt = (tl: Timeline, companyId: string, t: number): Segment | undefined =>
  findSegment(tl.segments.get(companyId) ?? [], t);
