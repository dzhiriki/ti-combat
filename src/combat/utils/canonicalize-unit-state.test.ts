import { describe, expect, test } from 'vitest'

import type { UnitId, UnitIdList, UnitType } from '@/types'

import type { SideStateData } from '../combat-state/types'
import { canonicalizeUnitState } from './canonicalize-unit-state'

const A = '\u{E001}' as UnitId
const B = '\u{E002}' as UnitId
const C = '\u{E003}' as UnitId
const D = '\u{E004}' as UnitId

const T = 'DREADNOUGHT' as UnitType
const T2 = 'DREADNOUGHT:Cavalry' as UnitType

function buildSide(
  participating: UnitId[],
  unitType: Record<string, UnitType>,
  unitState: SideStateData['unitState'],
): SideStateData {
  return {
    faction: 'ARBOREC',
    participatingUnits: participating.join('') as UnitIdList,
    nonParticipatingUnits: '' as UnitIdList,
    surfaceUnits: { space: participating.join('') as UnitIdList },
    unitSurface: Object.fromEntries(
      participating.map(id => [id, 'space']),
    ) as SideStateData['unitSurface'],
    unitType,
    unitState,
    unitStats: {} as SideStateData['unitStats'],
    abilities: {},
    liveAbilities: {},
  }
}

describe('canonicalizeUnitState', () => {
  test('one damaged unit converges regardless of which ID was damaged', () => {
    const side1 = buildSide(
      [A, B, C],
      { [A]: T, [B]: T, [C]: T },
      { [B]: { isDamaged: true } },
    )
    const side2 = buildSide(
      [A, B, C],
      { [A]: T, [B]: T, [C]: T },
      { [C]: { isDamaged: true } },
    )

    canonicalizeUnitState(side1)
    canonicalizeUnitState(side2)

    expect(side1.unitState).toEqual(side2.unitState)
    expect(side1.unitState[A]).toEqual({ isDamaged: true })
    expect(side1.unitState[B]).toBeUndefined()
    expect(side1.unitState[C]).toBeUndefined()
  })

  test('damaged + sustained pair travels as a unit (object preserved through swap)', () => {
    const side = buildSide(
      [A, B, C],
      { [A]: T, [B]: T, [C]: T },
      {
        [B]: { isDamaged: true, usedSustainThisRound: true },
        [C]: { isDamaged: true },
      },
    )

    canonicalizeUnitState(side)

    expect(side.unitState[A]).toEqual({
      isDamaged: true,
      usedSustainThisRound: true,
    })
    expect(side.unitState[B]).toEqual({ isDamaged: true })
    expect(side.unitState[C]).toBeUndefined()
  })

  test('multiple variant keys canonicalize independently', () => {
    const side = buildSide(
      [A, B, C, D],
      { [A]: T, [B]: T, [C]: T2, [D]: T2 },
      { [B]: { isDamaged: true }, [C]: { isDamaged: true } },
    )

    canonicalizeUnitState(side)

    expect(side.unitState[A]).toEqual({ isDamaged: true })
    expect(side.unitState[B]).toBeUndefined()
    expect(side.unitState[C]).toEqual({ isDamaged: true })
    expect(side.unitState[D]).toBeUndefined()
  })

  test('all-clean pool is a no-op', () => {
    const side = buildSide([A, B], { [A]: T, [B]: T }, {})

    canonicalizeUnitState(side)

    expect(side.unitState[A]).toBeUndefined()
    expect(side.unitState[B]).toBeUndefined()
  })

  test('single-unit pool is a no-op', () => {
    const side = buildSide([A], { [A]: T }, { [A]: { isDamaged: true } })

    canonicalizeUnitState(side)

    expect(side.unitState[A]).toEqual({ isDamaged: true })
  })

  test('score-0 entries stay attached to their original IDs (smart canonicalize)', () => {
    const side = buildSide(
      [A, B],
      { [A]: T, [B]: T },
      { [A]: { isDamaged: false }, [B]: { isDamaged: false } },
    )

    canonicalizeUnitState(side)

    // Score-0 states are equivalent and aren't worth swapping. Keeping
    // them attached to their original IDs preserves mid-step identity
    // for abilities like Dynamo+MVS where the explicit `false` carries
    // intent that downstream readers (test snapshots, ability handlers)
    // shouldn't have moved out from under them.
    expect(side.unitState[A]).toEqual({ isDamaged: false })
    expect(side.unitState[B]).toEqual({ isDamaged: false })
  })

  test('non-participating units share the variant pool', () => {
    const side: SideStateData = {
      faction: 'ARBOREC',
      participatingUnits: [A].join('') as UnitIdList,
      nonParticipatingUnits: [B].join('') as UnitIdList,
      surfaceUnits: { space: [A, B].join('') as UnitIdList },
      unitSurface: {
        [A]: 'space',
        [B]: 'space',
      } as SideStateData['unitSurface'],
      unitType: { [A]: T, [B]: T },
      unitState: { [B]: { isDamaged: true } },
      unitStats: {} as SideStateData['unitStats'],
      abilities: {},
      liveAbilities: {},
    }

    canonicalizeUnitState(side)

    expect(side.unitState[A]).toEqual({ isDamaged: true })
    expect(side.unitState[B]).toBeUndefined()
  })
})
