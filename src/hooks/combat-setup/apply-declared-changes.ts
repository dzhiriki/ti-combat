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
import type {
  CombatSide,
  SurfaceDefinition,
  SurfaceId,
  UnitId,
  UnitIdList,
  UnitType,
} from '@/types'

/** The units a side fields in setup. */
export type FieldedUnits = Pick<
  SideStateData,
  'participatingUnits' | 'nonParticipatingUnits' | 'unitSurface' | 'unitType'
>

export interface DeclaredChangesSide {
  faction: string
  unitStats: Record<string, UnitStatsEntry>
  config: SideAbilitiesConfig
  abilities: readonly RegisteredAbility[]
  /** Omitted when only the changed stats are read (placement). */
  units?: FieldedUnits
}

interface DeclaredUnit {
  type: UnitType
  surface: SurfaceId
}

/** Whether the panel shows `ability` as switched on in `config`. */
export function isSwitchedOn(
  ability: RegisteredAbility,
  config: SideAbilitiesConfig,
): boolean {
  const params = { ...extractDefaults(ability), ...config[ability.key] }
  return Boolean(
    params.isEnabled && (!ability.headerUI || params[ability.headerUI]),
  )
}

const SIDES = ['attacker', 'defender'] as const

function unitIds(units: FieldedUnits): UnitId[] {
  return [
    ...units.participatingUnits,
    ...units.nonParticipatingUnits,
  ] as UnitId[]
}

/** The model setup reads: each side's fielded units, plus the units active
 *  abilities may place, after every active ability's `declareChanges`.
 *
 *  Changes run in passes, each on a fresh model holding the units earlier
 *  passes placed, until a pass places nothing new. A change therefore sees
 *  units placed by abilities registered after it, or by the opponent's. */
export function applyDeclaredChanges(
  sides: Record<CombatSide, DeclaredChangesSide>,
  surfaces: readonly SurfaceDefinition[],
  combatMode: CombatMode,
  activeSurfaceId: SurfaceId,
): Record<CombatSide, SideStateData> {
  // Setup applies what the panel shows as switched on.
  const changing = {
    attacker: activeChanges(sides.attacker),
    defender: activeChanges(sides.defender),
  }
  // Placed units take codes after every fielded unit.
  let firstCode: number | undefined
  for (const side of SIDES) {
    const units = sides[side].units
    if (!units) continue
    for (const id of unitIds(units)) {
      firstCode = Math.max(firstCode ?? 0, id.charCodeAt(0) + 1)
    }
  }

  const declared: Record<CombatSide, DeclaredUnit[]> = {
    attacker: [],
    defender: [],
  }
  for (;;) {
    const data = buildModel(
      sides,
      declared,
      surfaces,
      combatMode,
      activeSurfaceId,
      firstCode,
    )
    if (!changing.attacker.length && !changing.defender.length)
      return { attacker: data.attacker, defender: data.defender }

    const seeded = {
      attacker: new Set(unitIds(data.attacker)),
      defender: new Set(unitIds(data.defender)),
    }
    const state = CombatState.fromDataStandalone(data, {
      attacker: [...sides.attacker.abilities],
      defender: [...sides.defender.abilities],
    })
    for (const side of SIDES) {
      const ctx = state.params.context(side)
      for (const ability of changing[side]) {
        ctx.upgradeForCall(ability)
        ctx.declaringChanges = true
        try {
          ctx.invokeChanges()
        } finally {
          ctx.declaringChanges = undefined
          ctx.resetAfterCall()
        }
      }
    }

    let placed = false
    for (const side of SIDES) {
      const sideData = data[side]
      for (const id of unitIds(sideData)) {
        if (seeded[side].has(id)) continue
        declared[side].push({
          type: sideData.unitType[id],
          surface: sideData.unitSurface[id],
        })
        placed = true
      }
    }
    if (!placed) return { attacker: data.attacker, defender: data.defender }
  }
}

function activeChanges(side: DeclaredChangesSide): RegisteredAbility[] {
  return side.abilities.filter(
    ability => ability.declareChanges && isSwitchedOn(ability, side.config),
  )
}

function buildModel(
  sides: Record<CombatSide, DeclaredChangesSide>,
  declared: Record<CombatSide, readonly DeclaredUnit[]>,
  surfaces: readonly SurfaceDefinition[],
  combatMode: CombatMode,
  activeSurfaceId: SurfaceId,
  firstCode: number | undefined,
): CombatStateData {
  const gen: { _nextCode?: number } = { _nextCode: firstCode }
  const model = (side: CombatSide): SideStateData => {
    const input = sides[side]
    const fielded = input.units
    let units = fielded ? unitIds(fielded).join('') : ''
    const unitType: Record<string, UnitType> = { ...fielded?.unitType }
    const unitSurface: Record<string, SurfaceId> = { ...fielded?.unitSurface }
    for (const unit of declared[side]) {
      const [id] = nextUnitIds(1, gen)
      units += id
      unitType[id] = unit.type
      unitSurface[id] = unit.surface
    }
    return {
      faction: input.faction,
      participatingUnits: units as UnitIdList,
      nonParticipatingUnits: '' as UnitIdList,
      unitSurface,
      unitType,
      unitState: {},
      unitStats: input.unitStats,
      abilities: { ...input.config },
      liveAbilities: {},
    }
  }
  return {
    attacker: model('attacker'),
    defender: model('defender'),
    combatMode,
    surfaces: [...surfaces],
    activeSurfaceId,
    _nextCode: gen._nextCode,
  }
}
