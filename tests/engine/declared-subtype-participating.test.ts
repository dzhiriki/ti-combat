import { describe, expect, it } from 'vitest'

import { type Ability, declareParam, type SideStateData } from '@/combat'
import type { DeclaredSubtype } from '@/combat/abilities-engine/types'
import { CombatSideState } from '@/combat/combat-side-state/combat-side-state'
import { settings as settingsAbility } from '@/data/main'
import { reconcileAbilitiesConfig } from '@/hooks/combat-setup/reconcile'
import type { UnitList } from '@/types'

/** Build a minimal SideStateData with the supplied participating units and
 *  a SETTINGS abilities entry containing the supplied declared subtypes.
 *  Anything not exercised by the variant-options path is left empty. */
function makeSide(opts: {
  baseTypes: string[]
  subtypes: DeclaredSubtype[]
}): SideStateData {
  return {
    participatingUnits: [],
    nonParticipatingUnits: [],
    unitType: {},
    unitState: {},
    unitStats: {},
    abilities: {
      SETTINGS: {
        units: opts.baseTypes,
        spaceCombatParticipating: opts.baseTypes,
        groundCombatParticipating: opts.baseTypes,
        ships: opts.baseTypes,
        groundForces: opts.baseTypes,
        nonFighterShips: opts.baseTypes,
        structures: [],
        validTargetsSpaceCannonOffense: [],
        validTargetsBombardment: [],
        validTargetsSpaceCannonDefense: [],
        validTargetsAntiFighterBarrage: [],
        subtypes: opts.subtypes,
      },
    },
    liveAbilities: {},
  } as unknown as SideStateData
}

describe('getUnitVariantOptions — participating flag', () => {
  it('hides non-participating subtypes by default', () => {
    const side = makeSide({
      baseTypes: ['CRUISER', 'INFANTRY'],
      subtypes: [
        {
          name: 'Galvanized',
          unitType: 'CRUISER',
          participating: true,
          source: 'PRE_GALVANIZED',
        },
        {
          name: 'Galvanized',
          unitType: 'INFANTRY',
          participating: false,
          source: 'PRE_GALVANIZED',
        },
      ] as unknown as DeclaredSubtype[],
    })

    const opts = CombatSideState.getUnitVariantOptions(side, 'SPACE')

    const values = opts.map(o => o.value)
    expect(values).toContain('CRUISER:Galvanized')
    expect(values).not.toContain('INFANTRY:Galvanized')
  })

  it('includes non-participating subtypes when includeNonParticipating is true', () => {
    const side = makeSide({
      baseTypes: ['CRUISER', 'INFANTRY'],
      subtypes: [
        {
          name: 'Galvanized',
          unitType: 'CRUISER',
          participating: true,
          source: 'PRE_GALVANIZED',
        },
        {
          name: 'Galvanized',
          unitType: 'INFANTRY',
          participating: false,
          source: 'PRE_GALVANIZED',
        },
      ] as unknown as DeclaredSubtype[],
    })

    const opts = CombatSideState.getUnitVariantOptions(side, 'SPACE', {
      includeNonParticipating: true,
    })

    const values = opts.map(o => o.value)
    expect(values).toContain('CRUISER:Galvanized')
    expect(values).toContain('INFANTRY:Galvanized')
  })
})

describe('declareParam source — participating flag', () => {
  /** Inline declarer that registers Galvanized for both CRUISER and DESTROYER
   *  with explicit participating values, so this task does not depend on
   *  Task 4's pre-galvanized rewrite. */
  const declarer: Ability = {
    key: 'TEST_DECLARER',
    name: 'Test Declarer',
    params: { isEnabled: true, uses: Infinity },
    declareSubtype: () => [
      {
        name: 'Galvanized',
        unitType: 'CRUISER',
        participating: true,
        statsFactory: (stats: import('@/types').UnitStats) => stats,
      },
      {
        name: 'Galvanized',
        unitType: 'DESTROYER',
        participating: false,
        statsFactory: (stats: import('@/types').UnitStats) => stats,
      },
    ],
    invoke: [],
  } as unknown as Ability

  function buildConsumer(includeNonParticipating: boolean): Ability {
    return {
      key: 'TEST_CONSUMER',
      name: 'Test Consumer',
      params: {
        isEnabled: true,
        uses: Infinity,
        items: declareParam<UnitList<number>>({
          default: [] as UnitList<number>,
          defaultItemValue: 0,
          source: 'units',
          filter: { includeNonParticipating },
        }),
      },
      invoke: [],
    } as unknown as Ability
  }

  function runReconcile(consumer: Ability) {
    const config = {
      attacker: {
        SETTINGS: {},
        TEST_DECLARER: { isEnabled: true, uses: Infinity },
        TEST_CONSUMER: { isEnabled: true, uses: Infinity, items: [] },
      },
      defender: { SETTINGS: {} },
    }
    const abilities = {
      attacker: [settingsAbility, declarer, consumer] as Ability[],
      defender: [settingsAbility] as Ability[],
    }
    reconcileAbilitiesConfig(config, abilities, 'SPACE')
    return (config.attacker.TEST_CONSUMER.items as UnitList<number>).map(
      ([k]) => k,
    )
  }

  it('excludes non-participating subtypes by default', () => {
    const keys = runReconcile(buildConsumer(false))
    expect(keys).toContain('CRUISER:Galvanized')
    expect(keys).not.toContain('DESTROYER:Galvanized')
  })

  it('includes non-participating subtypes when includeNonParticipating is true', () => {
    const keys = runReconcile(buildConsumer(true))
    expect(keys).toContain('CRUISER:Galvanized')
    expect(keys).toContain('DESTROYER:Galvanized')
  })
})
