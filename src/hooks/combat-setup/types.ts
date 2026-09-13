import type { CombatMode, SideAbilitiesConfig } from '@/combat'
import type { Precision } from '@/hooks/use-settings'
import type {
  CombatSide,
  GameSystem,
  UnitBaseType,
  UnitSelection,
} from '@/types'

export interface SimulationInput {
  system: GameSystem
  attackerFaction: string
  defenderFaction: string
  attackerSelections: Record<UnitBaseType, UnitSelection>
  defenderSelections: Record<UnitBaseType, UnitSelection>
  combatMode: CombatMode
  abilities: Record<CombatSide, SideAbilitiesConfig>
  /** Optional. When omitted, the simulation runs at full precision (no
   *  tail collapsing). */
  precision?: Precision
}
