import { describe, expect, it } from 'vitest'

import type { UnitId, UnitIdList, UnitType } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { resolveVariantLimit } from './param-limit'

function makeSide(units: Record<UnitId, UnitType>): SideStateData {
  const ids = Object.keys(units) as UnitId[]
  const unitSurface = Object.fromEntries(
    ids.map(id => [id, 'space']),
  ) as SideStateData['unitSurface']
  return {
    faction: 'sol' as never,
    participatingUnits: ids.join('') as UnitIdList,
    nonParticipatingUnits: '' as UnitIdList,
    surfaceUnits: { space: ids.join('') as UnitIdList },
    unitSurface,
    unitType: units as Record<string, UnitType>,
    unitState: {},
    unitStats: {} as never,
    abilities: {},
    liveAbilities: {},
  }
}

describe('resolveVariantLimit', () => {
  it('UNIT_LIMIT returns the reinforcement cap for the base type', () => {
    const side = makeSide({})
    expect(resolveVariantLimit('UNIT_LIMIT', side, 'CRUISER' as UnitType)).toBe(
      8,
    )
    expect(
      resolveVariantLimit('UNIT_LIMIT', side, 'CRUISER:Cavalry' as UnitType),
    ).toBe(8)
    expect(
      resolveVariantLimit('UNIT_LIMIT', side, 'DREADNOUGHT' as UnitType),
    ).toBe(5)
  })

  it('IN_COMBAT pools counts across all variants sharing a base type', () => {
    const side = makeSide({
      ['a' as UnitId]: 'CRUISER' as UnitType,
      ['b' as UnitId]: 'CRUISER' as UnitType,
      ['c' as UnitId]: 'CRUISER:Cavalry' as UnitType,
      ['d' as UnitId]: 'DREADNOUGHT' as UnitType,
    })
    expect(resolveVariantLimit('IN_COMBAT', side, 'CRUISER' as UnitType)).toBe(
      3,
    )
    expect(
      resolveVariantLimit('IN_COMBAT', side, 'CRUISER:Cavalry' as UnitType),
    ).toBe(3)
    expect(
      resolveVariantLimit('IN_COMBAT', side, 'DREADNOUGHT' as UnitType),
    ).toBe(1)
    expect(resolveVariantLimit('IN_COMBAT', side, 'CARRIER' as UnitType)).toBe(
      0,
    )
  })

  it('IN_COMBAT counts both participating and non-participating units', () => {
    const side: SideStateData = {
      faction: 'sol' as never,
      participatingUnits: 'ab' as UnitIdList,
      nonParticipatingUnits: 'cd' as UnitIdList,
      surfaceUnits: { space: 'abcd' as UnitIdList },
      unitSurface: {
        a: 'space',
        b: 'space',
        c: 'space',
        d: 'space',
      } as unknown as SideStateData['unitSurface'],
      unitType: {
        a: 'CRUISER',
        b: 'CRUISER',
        c: 'CRUISER:Cavalry',
        d: 'CRUISER',
      } as unknown as Record<string, UnitType>,
      unitState: {},
      unitStats: {} as never,
      abilities: {},
      liveAbilities: {},
    }
    expect(resolveVariantLimit('IN_COMBAT', side, 'CRUISER' as UnitType)).toBe(
      4,
    )
  })

  it('EXTRA returns the reinforcement headroom for the base type', () => {
    const side = makeSide({
      ['a' as UnitId]: 'CRUISER' as UnitType,
      ['b' as UnitId]: 'CRUISER' as UnitType,
      ['c' as UnitId]: 'CRUISER:Cavalry' as UnitType,
      ['d' as UnitId]: 'DREADNOUGHT' as UnitType,
    })
    // 8 (UNIT_LIMITS.CRUISER) - 3 in combat = 5
    expect(resolveVariantLimit('EXTRA', side, 'CRUISER' as UnitType)).toBe(5)
    expect(
      resolveVariantLimit('EXTRA', side, 'CRUISER:Cavalry' as UnitType),
    ).toBe(5)
    // 5 (UNIT_LIMITS.DREADNOUGHT) - 1 = 4
    expect(resolveVariantLimit('EXTRA', side, 'DREADNOUGHT' as UnitType)).toBe(
      4,
    )
    // empty: full headroom
    expect(resolveVariantLimit('EXTRA', side, 'CARRIER' as UnitType)).toBe(4)
  })

  it('EXTRA never goes below zero when count meets or exceeds UNIT_LIMITS', () => {
    const side = makeSide({
      ['a' as UnitId]: 'DREADNOUGHT' as UnitType,
      ['b' as UnitId]: 'DREADNOUGHT' as UnitType,
      ['c' as UnitId]: 'DREADNOUGHT' as UnitType,
      ['d' as UnitId]: 'DREADNOUGHT' as UnitType,
      ['e' as UnitId]: 'DREADNOUGHT' as UnitType,
    })
    expect(resolveVariantLimit('EXTRA', side, 'DREADNOUGHT' as UnitType)).toBe(
      0,
    )
  })
})
