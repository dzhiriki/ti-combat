import {
  CombatState,
  extractDefaults,
  nextUnitIds,
  type RegisteredAbility,
  type SideAbilitiesConfig,
} from '@/combat'
import type {
  CombatMode,
  CombatStateData,
  SideStateData,
  UnitStatsEntry,
} from '@/combat/combat-state/types'
import { resolveUnitStats } from '@/combat/utils/resolve-unit-stats'
import { UNIT_TYPES } from '@/constants/units'
import type {
  CombatSide,
  SurfaceDefinition,
  SurfaceId,
  UnitBaseType,
  UnitIdList,
} from '@/types'
import {
  allowedSurfaceTypes,
  simplifiedSurfaceId,
} from '@/utils/surface-placements'

export interface DeclaredChangesSide {
  faction: string
  unitStats: Record<string, UnitStatsEntry>
  config: SideAbilitiesConfig
  abilities: readonly RegisteredAbility[]
}

/** The model setup reads: one stand-in unit of every type on every surface,
 *  after every active ability's `declareChanges`, kept where its type may
 *  stand — or, given `simplifiedPlanetId`, only where the simplified editor
 *  puts it. Each stand-in stands for all units of its type on its surface. */
export function applyDeclaredChanges(
  sides: Record<CombatSide, DeclaredChangesSide>,
  surfaces: readonly SurfaceDefinition[],
  combatMode: CombatMode,
  activeSurfaceId: SurfaceId,
  simplifiedPlanetId?: SurfaceId,
): Record<CombatSide, SideStateData> {
  const gen: { _nextCode?: number } = {}
  const standIns = (side: DeclaredChangesSide): SideStateData => {
    let units = ''
    const unitType: Record<string, UnitBaseType> = {}
    const unitSurface: Record<string, SurfaceId> = {}
    for (const surface of surfaces) {
      for (const type of UNIT_TYPES) {
        const [id] = nextUnitIds(1, gen)
        units += id
        unitType[id] = type
        unitSurface[id] = surface.id
      }
    }
    return {
      faction: side.faction,
      participatingUnits: units as UnitIdList,
      nonParticipatingUnits: '' as UnitIdList,
      unitSurface,
      unitType,
      unitState: {},
      unitStats: side.unitStats,
      abilities: { ...side.config },
      liveAbilities: {},
    }
  }
  const data: CombatStateData = {
    attacker: standIns(sides.attacker),
    defender: standIns(sides.defender),
    combatMode,
    surfaces: [...surfaces],
    activeSurfaceId,
    _nextCode: gen._nextCode,
  }
  // Setup applies what the panel shows as switched on.
  const active = (side: CombatSide) =>
    sides[side].abilities.filter(ability => {
      if (!ability.declareChanges) return false
      const params = {
        ...extractDefaults(ability),
        ...sides[side].config[ability.key],
      }
      return params.isEnabled && (!ability.headerUI || params[ability.headerUI])
    })
  const changing = {
    attacker: active('attacker'),
    defender: active('defender'),
  }
  if (changing.attacker.length || changing.defender.length) {
    const state = CombatState.fromDataStandalone(data, {
      attacker: [...sides.attacker.abilities],
      defender: [...sides.defender.abilities],
    })
    for (const side of ['attacker', 'defender'] as const) {
      const ctx = state.params.context(side)
      for (const ability of changing[side]) {
        ctx.upgradeForCall(ability)
        try {
          ctx.invokeChanges()
        } finally {
          ctx.resetAfterCall()
        }
      }
    }
  }

  for (const side of ['attacker', 'defender'] as const) {
    const sideData = data[side]
    const standsOn = new Map(
      UNIT_TYPES.map(type => {
        const stats = resolveUnitStats(sideData.unitStats, type)
        const allowed = allowedSurfaceTypes(type, stats)
        return [
          type as string,
          simplifiedPlanetId
            ? [simplifiedSurfaceId(simplifiedPlanetId, type, stats, combatMode)]
            : surfaces
                .filter(surface => allowed.includes(surface.type))
                .map(surface => surface.id),
        ]
      }),
    )
    sideData.participatingUnits = [
      ...sideData.participatingUnits,
      ...sideData.nonParticipatingUnits,
    ]
      .filter(id =>
        standsOn.get(sideData.unitType[id])!.includes(sideData.unitSurface[id]),
      )
      .join('') as UnitIdList
    sideData.nonParticipatingUnits = '' as UnitIdList
  }
  return { attacker: data.attacker, defender: data.defender }
}
