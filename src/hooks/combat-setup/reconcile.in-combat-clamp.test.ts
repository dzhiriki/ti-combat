import { describe, expect, it } from 'vitest'

import { declareParam } from '@/combat/abilities-engine/declare-param'
import type { RegisteredAbility } from '@/combat/abilities-engine/types'
import type { SideStateData } from '@/combat/combat-state/types'
import type { UnitBaseType, UnitIdList, UnitList, UnitType } from '@/types'

import { reconcileAbilitiesConfig } from './reconcile'

function makeSide(units: Record<string, UnitType>): SideStateData {
  return {
    faction: 'sol' as never,
    participatingUnits: Object.keys(units).join('') as UnitIdList,
    nonParticipatingUnits: '' as UnitIdList,
    surfaceUnits: { space: Object.keys(units).join('') as UnitIdList },
    unitSurface: Object.fromEntries(
      Object.keys(units).map(id => [id, 'space']),
    ) as SideStateData['unitSurface'],
    unitType: units as Record<string, UnitType>,
    unitState: {},
    unitStats: {} as never,
    abilities: {},
    liveAbilities: {},
  }
}

function makeAbility(): RegisteredAbility {
  return {
    key: 'TEST_LIMIT',
    slot: 'OTHER',
    name: 'Test Limit',
    params: {
      isEnabled: true,
      uses: Infinity,
      list: declareParam<UnitList<number, UnitBaseType>>({
        default: [],
        source: 'units',
        defaultItemValue: 0,
        sort: 'worth-asc',
        limit: 'IN_COMBAT',
        filter: { includeOnlyBaseTypes: true },
      }),
    },
    invoke: [],
  }
}

/** Minimal SETTINGS config that puts CRUISER in the `units` group. */
function makeSettingsConfig() {
  return {
    isEnabled: true,
    uses: Infinity,
    ships: ['CRUISER' as UnitBaseType],
    nonFighterShips: ['CRUISER' as UnitBaseType],
    groundForces: [] as UnitBaseType[],
    structures: [] as UnitBaseType[],
    units: ['CRUISER' as UnitBaseType],
    spaceCombatParticipating: ['CRUISER' as UnitBaseType],
    groundCombatParticipating: [] as UnitBaseType[],
    validTargetsSpaceCannonOffense: ['CRUISER' as UnitBaseType],
    validTargetsBombardment: [] as UnitBaseType[],
    validTargetsSpaceCannonDefense: [] as UnitBaseType[],
    validTargetsAntiFighterBarrage: [] as UnitBaseType[],
    subtypes: [],
  }
}

describe('reconcileAbilitiesConfig — IN_COMBAT clamps tuple values', () => {
  it('clamps when stored value exceeds unit count on side', () => {
    const ability = makeAbility()
    const config = {
      attacker: {
        SETTINGS: makeSettingsConfig(),
        TEST_LIMIT: { isEnabled: true, uses: Infinity, list: [['CRUISER', 5]] },
      },
      defender: { SETTINGS: makeSettingsConfig() },
    }
    const abilities = {
      attacker: [ability],
      defender: [] as RegisteredAbility[],
    }
    const state = {
      attacker: makeSide({
        a: 'CRUISER' as UnitType,
        b: 'CRUISER' as UnitType,
      }),
      defender: makeSide({}),
    }
    reconcileAbilitiesConfig(config, abilities, 'SPACE', undefined, state)
    const list = config.attacker.TEST_LIMIT.list as [string, number][]
    expect(list.find(([k]) => k === 'CRUISER')?.[1]).toBe(2)
  })

  it('does not clamp when stored value is at or below unit count', () => {
    const ability = makeAbility()
    const config = {
      attacker: {
        SETTINGS: makeSettingsConfig(),
        TEST_LIMIT: { isEnabled: true, uses: Infinity, list: [['CRUISER', 1]] },
      },
      defender: { SETTINGS: makeSettingsConfig() },
    }
    const abilities = {
      attacker: [ability],
      defender: [] as RegisteredAbility[],
    }
    const state = {
      attacker: makeSide({
        a: 'CRUISER' as UnitType,
        b: 'CRUISER' as UnitType,
      }),
      defender: makeSide({}),
    }
    reconcileAbilitiesConfig(config, abilities, 'SPACE', undefined, state)
    const list = config.attacker.TEST_LIMIT.list as [string, number][]
    expect(list.find(([k]) => k === 'CRUISER')?.[1]).toBe(1)
  })
})
