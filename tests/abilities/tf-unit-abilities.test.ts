import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF unit abilities', () => {
  it('Hel-Titan PDS participates in ground combat as a ground force', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { PDS: 1 },
        abilities: { TF_UPGRADE_HEL_TITAN: true },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // PDS fights as a ground force (combat 5) → rolls in the ground dice pool
    expect(t.dicePool().attacker).toContainDice('PDS', [5, 1])
  })

  it('Exotrireme self-destruct destroys up to 2 enemy ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1 },
        abilities: {
          TF_UPGRADE_EXOTRIREME: { isEnabled: true, selfDestruct: true },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('Radiant Aur mech repairs a damaged mech at the start of a ground round', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RADIANT_AUR',
        units: { MECH: 1 },
        abilities: { TF_STARLANCER_II: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 2 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })
    expect(t.attacker.units.MECH?.[0].isDamaged).toBe(true)

    t.advanceRound({ attacker: 0, defender: 0 })
    expect(t.attacker.units.MECH).toHaveLength(1)
    // Repaired at the start of round 2 → no longer damaged
    expect(t.attacker.units.MECH?.[0].isDamaged).toBeFalsy()
  })

  it('Radiant Aur mech repair is limited by its uses (1 token = 1 repair)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'RADIANT_AUR',
        units: { MECH: 1 },
        abilities: { TF_STARLANCER_II: { isEnabled: true, uses: 1 } },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })
    expect(t.attacker.units.MECH?.[0].isDamaged).toBe(true)

    // Round 2: the single use repairs the mech, then it takes a hit again.
    t.advanceRound({ attacker: 1, defender: 0 })
    expect(t.attacker.units.MECH?.[0].isDamaged).toBe(true)

    // Round 3: no uses left — the mech stays damaged.
    t.advanceRound({ attacker: 0, defender: 0 })
    expect(t.attacker.units.MECH?.[0].isDamaged).toBe(true)
  })
})
