import { describe, expect, it } from 'vitest'

import { SPACE_SURFACE_ID } from '@/types'

import { combatTest } from '../utils/combat-test'

describe.forEachSide('LIGHTRAIL_ORDNANCE + LINKSHIP I', () => {
  it('linkship uses enhanced Space Dock SC from Lightrail Ordnance', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { CRUISER: 3 } },
      defender: {
        faction: 'RAL_NEL',
        units: {},
        placements: {
          [SPACE_SURFACE_ID]: { DESTROYER: 1, SPACE_DOCK: 1 },
        },
        abilities: { LIGHTRAIL_ORDNANCE: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    const pool = t.dicePool()

    // Lightrail Ordnance upgrades Space Dock SC to [5, 2]
    // Linkship reads that enhanced value
    expect(pool.defender.LINKSHIP).toHaveLength(1)
    expect(pool.defender).toContainDice('LINKSHIP', [5, 2])
  })
})
