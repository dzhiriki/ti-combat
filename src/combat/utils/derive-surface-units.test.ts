import { describe, expect, test } from 'vitest'

import type { SurfaceId, UnitId, UnitIdList, UnitType } from '@/types'

import { CombatSideState } from '../combat-side-state/combat-side-state'
import type { SideStateData } from '../combat-state/types'
import { deriveSurfaceUnits } from './derive-surface-units'

const A = '\u{E001}' as UnitId
const B = '\u{E002}' as UnitId
const C = '\u{E003}' as UnitId
const D = '\u{E004}' as UnitId

const SPACE = 'space' as SurfaceId
const PLANET = 'planet-1' as SurfaceId

function buildSide(
  participating: UnitId[],
  nonParticipating: UnitId[],
  unitSurface: Record<string, SurfaceId>,
): SideStateData {
  const side: SideStateData = {
    faction: 'ARBOREC',
    participatingUnits: participating.join('') as UnitIdList,
    nonParticipatingUnits: nonParticipating.join('') as UnitIdList,
    surfaceUnits: {},
    unitSurface,
    unitType: Object.fromEntries(
      [...participating, ...nonParticipating].map(id => [id, 'CRUISER']),
    ) as Record<string, UnitType>,
    unitState: {},
    unitStats: {} as SideStateData['unitStats'],
    abilities: {},
    liveAbilities: {},
  }
  side.surfaceUnits = deriveSurfaceUnits(side, {
    [SPACE]: '' as UnitIdList,
    [PLANET]: '' as UnitIdList,
  })
  return side
}

describe('deriveSurfaceUnits', () => {
  test('groups both id lists by location and keeps empty surfaces', () => {
    const side = buildSide([A, B], [C], { [A]: SPACE, [B]: SPACE, [C]: SPACE })

    expect(side.surfaceUnits).toEqual({ [SPACE]: A + B + C, [PLANET]: '' })
  })

  test('skips ids without a location', () => {
    const side = buildSide([A, B], [], { [A]: PLANET })

    expect(side.surfaceUnits).toEqual({ [SPACE]: '', [PLANET]: A })
  })
})

describe('deriveSurfaceUnits memo in assignHits', () => {
  test('removes casualties from their own surface only', () => {
    const side = buildSide([A, B], [C, D], {
      [A]: SPACE,
      [B]: SPACE,
      [C]: PLANET,
      [D]: SPACE,
    })
    CombatSideState.addHits(side, 1)
    CombatSideState.assignHits(side)

    expect(side.surfaceUnits).toEqual({ [SPACE]: A + D, [PLANET]: C })
  })

  test('never reuses a memoized index across different locations', () => {
    const cache: SideStateData['_surfaceUnitsCache'] = []
    const inSpace = buildSide([A, B, C], [], {
      [A]: SPACE,
      [B]: SPACE,
      [C]: SPACE,
    })
    const onPlanet = buildSide([A, B, C], [], {
      [A]: PLANET,
      [B]: SPACE,
      [C]: SPACE,
    })
    inSpace._surfaceUnitsCache = cache
    onPlanet._surfaceUnitsCache = cache

    CombatSideState.addHits(inSpace, 1)
    CombatSideState.assignHits(inSpace)
    CombatSideState.addHits(onPlanet, 1)
    CombatSideState.assignHits(onPlanet)

    expect(inSpace.surfaceUnits).toEqual({ [SPACE]: A + B, [PLANET]: '' })
    expect(onPlanet.surfaceUnits).toEqual({ [SPACE]: B, [PLANET]: A })
  })
})
