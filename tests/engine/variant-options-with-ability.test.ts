import { describe, expect, it } from 'vitest'

import type { Ability, SideStateData } from '@/combat'
import { resolveUnitOptions } from '@/combat/abilities-engine/unit-options'
import type { UnitStatsEntry } from '@/combat/combat-state/types'
import type { UnitIdList } from '@/types'

const exotrireme: Ability = {
  key: 'TEST_EXOTRIREME',
  name: 'Test Exotrireme',
  params: { isEnabled: true, uses: Infinity },
  invoke: [],
}

/** Side whose ships keep their native categories. */
function makeSide(unitStats: Record<string, UnitStatsEntry>): SideStateData {
  return {
    faction: 'ARBOREC',
    participatingUnits: '' as UnitIdList,
    nonParticipatingUnits: '' as UnitIdList,
    unitSurface: {},
    unitType: {},
    unitState: {},
    unitStats: unitStats as SideStateData['unitStats'],
    abilities: {},
    liveAbilities: {},
  }
}

const SPACE = { combatMode: 'SPACE', side: 'attacker' } as const

describe('getUnitVariantOptions — withAbility', () => {
  it('offers only the types whose stats carry the declaring ability', () => {
    const side = makeSide({
      CRUISER: {},
      DREADNOUGHT: { ABILITIES: [exotrireme] },
      FLAGSHIP: { ABILITIES: [exotrireme] },
    })

    const values = resolveUnitOptions(side, SPACE, {
      source: 'SHIPS',
      scope: 'type',
      filter: { withAbility: true },
      abilityKey: exotrireme.key,
    }).map(option => option.value)

    expect(values.toSorted()).toEqual(['DREADNOUGHT', 'FLAGSHIP'])
  })

  it('reads the stand-ins, which carry the declared changes', () => {
    const side = makeSide({ DREADNOUGHT: {} })
    side.optionMetadata = {
      model: makeSide({ DREADNOUGHT: { ABILITIES: [exotrireme] } }),
      subtypes: [],
    }

    const values = resolveUnitOptions(side, SPACE, {
      source: 'SHIPS',
      scope: 'type',
      filter: { withAbility: true },
      abilityKey: exotrireme.key,
    }).map(option => option.value)

    expect(values).toEqual(['DREADNOUGHT'])
  })

  it('prefers the holders reconcile lists as if the ability were on', () => {
    const side = makeSide({ DREADNOUGHT: {}, FLAGSHIP: {} })
    side.optionMetadata = {
      model: makeSide({ DREADNOUGHT: {}, FLAGSHIP: {} }),
      subtypes: [],
      abilityHolders: { [exotrireme.key]: ['FLAGSHIP'] },
    }

    const values = resolveUnitOptions(side, SPACE, {
      source: 'SHIPS',
      scope: 'type',
      filter: { withAbility: true },
      abilityKey: exotrireme.key,
    }).map(option => option.value)

    expect(values).toEqual(['FLAGSHIP'])
  })

  it('needs the key of the declaring ability', () => {
    const side = makeSide({})

    expect(() =>
      resolveUnitOptions(side, SPACE, {
        source: 'SHIPS',
        scope: 'type',
        filter: { withAbility: true },
      }),
    ).toThrow('filter.withAbility')
  })
})
