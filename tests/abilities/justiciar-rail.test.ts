import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_UPGRADE_JUSTICIAR_RAIL', () => {
  it('routes its Space Cannon hits onto non-fighter ships first', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1, FIGHTER: 2 },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { TF_UPGRADE_JUSTICIAR_RAIL: true },
      },
    })

    // Defender's Justiciar Rail PDS fires Space Cannon; force 1 hit.
    t.advanceTo('AFB', { attacker: 1 })

    // Hit must land on the non-fighter cruiser, not a fighter.
    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })
})
