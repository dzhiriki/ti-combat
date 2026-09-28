import type { CombatMode, SideAbilitiesConfig } from '@/combat'
import type { Precision } from '@/hooks/use-settings'
import type {
  CombatSide,
  GameSystem,
  SurfaceDefinition,
  SurfaceId,
  SideUnitPlacements,
} from '@/types'

export interface SimulationInput {
  system: GameSystem
  attackerFaction: string
  defenderFaction: string
  surfaces: SurfaceDefinition[]
  /** The selected planet in GROUND mode; settings reconcile against it. */
  activeSurfaceId: SurfaceId
  /** GROUND mode: the planets fought over, in resolution order. Two or more
   *  run one ground combat per planet after a shared bombardment and
   *  commitment onto the first; otherwise `activeSurfaceId` is invaded. */
  invasionPlanets?: readonly SurfaceId[]
  attackerPlacements: SideUnitPlacements
  defenderPlacements: SideUnitPlacements
  combatMode: CombatMode
  abilities: Record<CombatSide, SideAbilitiesConfig>
  /** Optional. When omitted, the simulation runs at full precision (no
   *  tail collapsing). */
  precision?: Precision
}
