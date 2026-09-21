import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// Space Cannon Offense is fired by the defender, so no forEachSide.
describe('TF_UPGRADE_JUSTICIAR_RAIL + LIGHTRAIL_ORDNANCE', () => {
  it('only the PDS hits are forced onto non-fighters — dock hits assign normally', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 3, CRUISER: 2 },
      },
      defender: {
        faction: 'AVARICE_REX',
        // Justiciar Rail PDS: Space Cannon 5 (x1); Lightrail space dock:
        // Space Cannon 5 (x2).
        units: { PDS: 1, SPACE_DOCK: 1, CRUISER: 1 },
        abilities: {
          TF_UPGRADE_JUSTICIAR_RAIL: true,
          LIGHTRAIL_ORDNANCE: true,
        },
      },
    })

    // All 3 Space Cannon dice hit. The PDS hit must land on a cruiser;
    // the dock's 2 hits follow the default priority (fighters first).
    // A step-wide Graviton-style restriction would instead kill both
    // cruisers and one fighter.
    t.advanceTo('AFB', { attacker: 3 })

    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
  })

  it('with only the Justiciar Rail firing, its hit skips fighters', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 2, CRUISER: 1 },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { PDS: 1, CRUISER: 1 },
        abilities: { TF_UPGRADE_JUSTICIAR_RAIL: true },
      },
    })

    t.advanceTo('AFB', { attacker: 1 })

    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
  })
})
