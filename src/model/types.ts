export type Vec2 = { x: number; y: number }; // world units = paces, y up
export type OrderSpacing = 'close' | 'open' | 'extended';
export type DressPoint = 'right' | 'left' | 'centre';
export type MenFacing = 'front' | 'right' | 'left' | 'about'; // relative to the block's front

export interface OfficerSpec {
  captain: boolean;
  lieutenant: boolean;
  ensign: boolean;
}

export interface NcoSpec {
  sergeants: number;
  corporals: number;
  drummer: boolean;
}

export interface Platoon {
  id: string;
  name: string;
  men: number; // sum across platoons should equal company.rankAndFile
}

export interface Company {
  id: string;
  name: string;
  rankAndFile: number;
  platoons: Platoon[]; // ordered right → left when in line
  officers: OfficerSpec;
  ncos: NcoSpec;
  colour: string;
}

/** One platoon standing as a rectangle of men. */
export interface Block {
  platoonId: string;
  anchor: Vec2; // centre of the block's front rank
  front: number; // radians
  files: number;
  ranks: number;
}

export interface FormationState {
  blocks: Block[]; // one per platoon, same order as company.platoons
  menFacing: MenFacing;
  order: OrderSpacing;
  dressBy: DressPoint;
}

export type FigureRole =
  | 'private'
  | 'corporal'
  | 'sergeant'
  | 'drummer'
  | 'captain'
  | 'lieutenant'
  | 'ensign';

export interface Figure {
  role: FigureRole;
  platoonId?: string;
  slot: string; // stable identity, e.g. "p1:f3:r2"
  pos: Vec2;
  facing: number;
}

export interface Order {
  id: string;
  kind: import('../drill/types').CommandKind;
  params: Record<string, unknown>;
}

export interface Segment {
  order: Order;
  t0: number;
  t1: number;
  start: FormationState;
  end: FormationState;
  sample(t: number): Figure[];
  stateAt?(t: number): FormationState; // rigid segments only; used to trace the path
  error?: string;
}

export interface Timeline {
  duration: number;
  starts: Map<string, FormationState>;
  segments: Map<string, Segment[]>;
  sample(t: number): Map<string, Figure[]>;
  path(companyId: string): Vec2[]; // centre of the front rank traced over time
}
