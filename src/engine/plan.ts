import type { DrillSystem } from '../drill/types';
import type { Company, FormationState, Order } from '../model/types';

export const PLAN_UNAVAILABLE = 'Automatic orders not yet available';

/** Seam for the later plan → orders phase. */
export function plan(_from: FormationState, _to: FormationState, _c: Company, _d: DrillSystem): Order[] {
  return [];
}
