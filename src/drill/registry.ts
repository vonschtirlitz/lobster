import type { DrillSystem } from './types';
import { gb1764 } from './gb1764';

export const DRILL_SYSTEMS: DrillSystem[] = [gb1764];

export function getDrill(id: string): DrillSystem {
  return DRILL_SYSTEMS.find((d) => d.id === id) ?? gb1764;
}
