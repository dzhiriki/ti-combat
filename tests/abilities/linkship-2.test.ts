import { describe, expect, it } from 'vitest'

import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('LINKSHIP II', () => {
  it('allows all linkships to fire using the same structure', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 3, PDS: 1 },
        },
        upgrades: ['DESTROYER'],
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Linkship II: all 3 destroyers fire SC using the 1 PDS
    expect(pool.defender.LINKSHIP).toHaveLength(3)
    expect(pool.defender).toContainDice('LINKSHIP', [6, 1])
  })

  it('is capped by linkship count', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 1, PDS: 3 },
        },
        upgrades: ['DESTROYER'],
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // 1 linkship, 3 PDS structures → 1 SC dice group
    expect(pool.defender.LINKSHIP).toHaveLength(1)
  })

  it('reads structures directly from the space area', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 1, PDS: 1 },
        },
        upgrades: ['DESTROYER'],
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    expect(pool.defender.LINKSHIP).toHaveLength(1)
    expect(pool.defender).toContainDice('LINKSHIP', [6, 1])
  })

  it('uses best SC source among structures', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 1, SPACE_DOCK: 1 },
        },
        upgrades: ['DESTROYER'],
        abilities: { LIGHTRAIL_ORDNANCE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Linkship uses Space Dock's SC [5, 2] (better than PDS [6, 1])
    expect(pool.defender).toContainDice('LINKSHIP', [5, 2])
  })
})
