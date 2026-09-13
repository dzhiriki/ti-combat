import type { CombatMode, SideAbilitiesConfig } from '@/combat'
import type { Precision } from '@/hooks/use-settings'
import type {
  CombatSide,
  GameSystem,
  SurfaceDefinition,
  SurfaceId,
  SurfaceUnitSelections,
} from '@/types'

export interface SimulationInput {
  system: GameSystem
  attackerFaction: string
  defenderFaction: string
  surfaces: SurfaceDefinition[]
  activeSurfaceId: SurfaceId
  attackerPlacements: SurfaceUnitSelections
  defenderPlacements: SurfaceUnitSelections
  combatMode: CombatMode
  abilities: Record<CombatSide, SideAbilitiesConfig>
  /** Optional. When omitted, the simulation runs at full precision (no
   *  tail collapsing). */
  precision?: Precision
}
