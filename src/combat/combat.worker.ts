import { prepareSimulationConfig } from '@/hooks/combat-setup'
import type { SimulationInput } from '@/hooks/combat-setup/types'
import type {
  GameSystem,
  UnitBaseType,
  UnitIdList,
  UnitSelection,
} from '@/types'
import {
  buildUnitStatsMap,
  getSimulationUnits,
} from '@/utils/get-simulation-units'

import type { DeclaredSubtype } from './abilities-engine/types'
import { CombatEngine } from './combat-engine'
import { CombatState } from './combat-state'
import type {
  SideAbilitiesConfig,
  SideStateData,
  UnitStatsEntry,
} from './combat-state/types'
import { makeVariantId } from './utils/unit-variant'

function buildSideState(
  system: GameSystem,
  faction: string,
  selections: Record<UnitBaseType, UnitSelection>,
  abilities: SideAbilitiesConfig,
  gen: { _nextCode?: number },
): SideStateData {
  const upgradedSet = new Set<UnitBaseType>()
  for (const [k, v] of Object.entries(selections)) {
    if (v.upgraded) upgradedSet.add(k as UnitBaseType)
  }
  const { units, unitType, unitState, unitStats } = getSimulationUnits(
    system,
    faction,
    selections,
    gen,
  )

  const baseUnitStats: Record<string, UnitStatsEntry> = {
    ...buildUnitStatsMap(system, faction, upgradedSet),
    ...unitStats,
  }

  // Register variant-key entries from declared subtypes as factory functions
  // so `resolveUnitStats` re-evaluates them lazily against the *current*
  // parent stats. Eager evaluation here would freeze the variant before
  // runtime mutators like Reveal Prototype's `modifyUnitType` upgrade the
  // base — Viscount on an upgraded Cruiser must reflect the upgrade, not
  // the unupgraded snapshot from config time. SETTINGS.subtypes is
  // re-derived by `prepareSimulationConfig` above.
  const settings = abilities['SETTINGS'] as
    | { subtypes?: DeclaredSubtype[] }
    | undefined
  for (const decl of settings?.subtypes ?? []) {
    const variantKey = makeVariantId(decl.unitType, [decl.name])
    if (baseUnitStats[variantKey]) continue
    baseUnitStats[variantKey] = decl.statsFactory
  }

  return {
    faction,
    participatingUnits: units,
    nonParticipatingUnits: '' as UnitIdList,
    unitType,
    unitState,
    unitStats: baseUnitStats,
    abilities,
    liveAbilities: {},
  }
}

self.onmessage = (e: MessageEvent<SimulationInput>) => {
  const {
    system,
    attackerFaction,
    defenderFaction,
    attackerSelections,
    defenderSelections,
    combatMode,
    abilities,
    precision,
  } = e.data

  const collapseThreshold =
    precision?.kind === 'limited' ? 10 ** -precision.digits : undefined

  const sideAbilities = prepareSimulationConfig(
    system,
    abilities,
    attackerFaction,
    defenderFaction,
    combatMode,
  )
  const gen: { _nextCode?: number } = {}
  const combatState = CombatState.forSimulation(
    buildSideState(
      system,
      attackerFaction,
      attackerSelections,
      abilities.attacker,
      gen,
    ),
    buildSideState(
      system,
      defenderFaction,
      defenderSelections,
      abilities.defender,
      gen,
    ),
    combatMode,
    {
      attacker: sideAbilities.attacker.registered,
      defender: sideAbilities.defender.registered,
    },
    {
      attacker: sideAbilities.attacker.unitAbilityKeys,
      defender: sideAbilities.defender.unitAbilityKeys,
    },
    {
      attacker: sideAbilities.attacker.factionOwnedKeys,
      defender: sideAbilities.defender.factionOwnedKeys,
    },
    gen._nextCode,
    collapseThreshold,
  )

  const engine = new CombatEngine({
    logStats: true,
  })
  console.time('Simulate')
  const outcomes = engine.simulate(combatState)
  console.timeEnd('Simulate')
  console.log('Outcomes', outcomes)

  self.postMessage(outcomes)
}
