import { describe, expect, it } from 'vitest'

import { makeUnitLocator } from '@/combat'
import type { SurfaceId } from '@/types'

import { sortSurvivors } from './sort-survivors'

describe('sortSurvivors', () => {
  it('uses the selected surface priority when rendering survivors', () => {
    const p1 = 'planet-1' as SurfaceId
    const p2 = 'planet-2' as SurfaceId
    const side = { INFANTRY: [{}], MECH: [{}] }
    const priority = [
      makeUnitLocator('INFANTRY', p1),
      makeUnitLocator('MECH', p2),
      makeUnitLocator('MECH', p1),
      makeUnitLocator('INFANTRY', p2),
    ]
    expect(sortSurvivors(side, priority, p1).map(entry => entry.base)).toEqual([
      'MECH',
      'INFANTRY',
    ])
    expect(sortSurvivors(side, priority, p2).map(entry => entry.base)).toEqual([
      'INFANTRY',
      'MECH',
    ])
  })

  it('ranks a type by its first surface entry in the aggregate view', () => {
    const p1 = 'planet-1' as SurfaceId
    const p2 = 'planet-2' as SurfaceId
    const side = { INFANTRY: [{}], MECH: [{}] }
    const priority = [
      makeUnitLocator('INFANTRY', p1),
      makeUnitLocator('MECH', p1),
      makeUnitLocator('INFANTRY', p2),
    ]
    expect(sortSurvivors(side, priority).map(entry => entry.base)).toEqual([
      'MECH',
      'INFANTRY',
    ])
  })

  it('places a subtyped variant at its own priority slot, not its base type slot', () => {
    // 1 Cruiser, 1 Fighter, 1 Galvanized Fighter; priority: [F, Cr, F:Galvanized]
    const side = {
      CRUISER: [{}],
      FIGHTER: [{}, { subtypes: ['Galvanized'] }],
    }
    const priority = ['FIGHTER', 'CRUISER', 'FIGHTER:Galvanized']

    const result = sortSurvivors(side, priority)

    // Highest priority index renders first → F:Galvanized (idx 2),
    // Cr (idx 1), F (idx 0).
    expect(result.map(e => e.variantKey)).toEqual([
      'FIGHTER:Galvanized',
      'CRUISER',
      'FIGHTER',
    ])
  })

  it('falls back to base-type rank when the variant is not in the priority list', () => {
    const side = {
      FIGHTER: [{ subtypes: ['Galvanized'] }],
      CRUISER: [{}],
    }
    const priority = ['FIGHTER', 'CRUISER']

    const result = sortSurvivors(side, priority)

    // F:Galvanized falls back to FIGHTER's rank (0). Cr at rank 1
    // renders first.
    expect(result.map(e => e.variantKey)).toEqual([
      'CRUISER',
      'FIGHTER:Galvanized',
    ])
  })

  it('separates healthy and damaged counts per variant', () => {
    const side = {
      DREADNOUGHT: [{ isDamaged: true }, {}],
    }
    const result = sortSurvivors(side, ['DREADNOUGHT'])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      variantKey: 'DREADNOUGHT',
      healthy: 1,
      damaged: 1,
    })
  })

  it('puts entries with no priority match at the end', () => {
    const side = {
      MECH: [{}],
      INFANTRY: [{}],
    }
    const result = sortSurvivors(side, ['INFANTRY'])

    expect(result.map(e => e.variantKey)).toEqual(['INFANTRY', 'MECH'])
  })
})
