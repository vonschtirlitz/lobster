import type { Company, DressPoint, Figure, FormationState, OrderSpacing } from '../model/types';

export type CommandKind = 'march' | 'face' | 'wheel' | 'spacing' | 'dress' | 'depth' | 'wait';

export interface ParamDef {
  key: string;
  label: string;
  type: 'number' | 'choice';
  choices?: string[];
  default: number | string;
  min?: number;
  max?: number;
}

export interface CommandDef {
  kind: CommandKind;
  words: string;
  params: ParamDef[];
}

export interface DrillSystem {
  id: string;
  name: string;
  defaults: {
    ranks: number;
    allowedRanks: number[];
    allowedOrders: OrderSpacing[];
    fileInterval: Record<OrderSpacing, number>; // paces between file centres
    rankDistance: Record<OrderSpacing, number>; // paces between ranks
    defaultDress: DressPoint;
    platoonsPerCompany: number;
    steps: Record<string, { pacesPerMinute: number }>;
    beatSeconds: number;
  };
  commands: CommandDef[];
  postOfficersAndNcos(company: Company, s: FormationState): Figure[];
  terms: Record<string, string>;
}
