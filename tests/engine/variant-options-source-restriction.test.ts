import { describe, expect, it } from 'vitest'

import { type SideStateData } from '@/combat'
import { resolveUnitOptions } from '@/combat/abilities-engine/unit-options'

/** Minimal SideStateData where ships participate, including FIGHTER. */
function makeSide(): SideStateData {
  const ships = ['CRUISER', 'DESTROYER', 'FIGHTER']
  return {
    participatingUnits: [],
    nonParticipatingUnits: [],
    unitType: {},
    unitState: {},
    unitStats: {},
    abilities: {},
    unitCategoryOptions: {
      SHIPS: ships,
      GROUND_FORCES: [],
      STRUCTURES: [],
    },
    declaredSubtypes: [],
    liveAbilities: {},
  } as unknown as SideStateData
}

describe('getUnitVariantOptions — source restriction', () => {
  it('includes FIGHTER by default (no source constraint)', () => {
    const side = makeSide()
    const opts = resolveUnitOptions(
      side,
      { combatMode: 'SPACE', side: 'attacker' },
      { source: 'SHIPS', scope: 'type' },
    )
    const values = opts.map(o => o.value)
    expect(values).toContain('FIGHTER')
  })

  it('drops base types absent from the supplied sourceBaseTypes list', () => {
    const side = makeSide()
    const opts = resolveUnitOptions(
      side,
      { combatMode: 'SPACE', side: 'attacker' },
      {
        source: 'SHIPS',
        scope: 'type',
        filter: { include: ['CRUISER', 'DESTROYER'] },
      },
    )
    const values = opts.map(o => o.value)
    expect(values).toContain('CRUISER')
    expect(values).toContain('DESTROYER')
    expect(values).not.toContain('FIGHTER')
  })
})
