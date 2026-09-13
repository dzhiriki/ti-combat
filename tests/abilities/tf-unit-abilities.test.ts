import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF unit abilities', () => {
  it('Hel-Titan PDS participates in ground combat as a ground force', () => {
    const t = combatTest({
      system: 'TF',
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
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1 },
        abilities: {
          TF_UPGRADE_EXOTRIREME: { isEnabled: true, uses: 1 },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('Exotrireme self-destruct fires once per use after the same round', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 2, CRUISER: 1 },
        abilities: {
          TF_UPGRADE_EXOTRIREME: { isEnabled: true, uses: 2 },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 5 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    // Both dreadnoughts sacrifice, each destroying 2 cruisers (4 total)
    expect(t.attacker.units.DREADNOUGHT).toBeUndefined()
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('Exotrireme self-destruct is limited by its uses', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 2, CRUISER: 1 },
        abilities: {
          TF_UPGRADE_EXOTRIREME: { isEnabled: true, uses: 1 },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 5 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    // Only one dreadnought sacrifices — the second use isn't available
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })

  it('Exotrireme self-destruct honors a custom target priority order', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1 },
        abilities: {
          TF_UPGRADE_EXOTRIREME: {
            isEnabled: true,
            uses: 1,
            targetPriority: [
              ['DESTROYER', true],
              ['CARRIER', true],
            ],
          },
        },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { CARRIER: 1, DESTROYER: 2 },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    // Default worth-desc would take the carrier first; the custom order
    // spends both destroys on destroyers instead.
    expect(t.defender.units.DESTROYER).toBeUndefined()
    expect(t.defender.units.CARRIER).toHaveLength(1)
  })

  it('Exotrireme stat upgrade applies even with 0 uses (self-destruct off)', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1 },
        abilities: { TF_UPGRADE_EXOTRIREME: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    // Upgraded combat value (4) instead of the base dreadnought's 5
    expect(t.dicePool().attacker).toContainDice('DREADNOUGHT', [4, 1])

    // No sacrifice with the default uses: 0
    expect(t.attacker.units.DREADNOUGHT).toHaveLength(1)
    expect(t.defender.units.CRUISER).toHaveLength(3)
  })

  it('Radiant Aur mech repairs a damaged mech at the start of a ground round', () => {
    const t = combatTest({
      system: 'TF',
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

  it('Radiant Aur mech repair waits for the damaged-mech threshold', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: {
        faction: 'RADIANT_AUR',
        units: { MECH: 2 },
        abilities: {
          TF_STARLANCER_II: { isEnabled: true, uses: 2, repairWhen: 'ALL' },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    // Round 1: one mech sustains — not all mechs damaged yet.
    t.advanceRound({ attacker: 1, defender: 0 })
    expect(t.attacker.units.MECH?.filter(m => m.isDamaged)).toHaveLength(1)

    // Round 2 starts without a repair (1 of 2 damaged); the second mech
    // sustains during the round.
    t.advanceRound({ attacker: 1, defender: 0 })
    expect(t.attacker.units.MECH?.filter(m => m.isDamaged)).toHaveLength(2)
    expect(t.state.attacker.abilities.TF_STARLANCER_II.uses).toBe(2)

    // Round 3: both mechs damaged — the threshold is met, both repaired.
    t.advanceRound({ attacker: 0, defender: 0 })
    expect(t.attacker.units.MECH?.filter(m => m.isDamaged)).toHaveLength(0)
    expect(t.state.attacker.abilities.TF_STARLANCER_II.uses).toBe(1)
  })

  it('Radiant Aur mech repair threshold tracks LIVING mechs as they die', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'GROUND',
      attacker: {
        faction: 'RADIANT_AUR',
        units: { MECH: 2 },
        abilities: {
          TF_STARLANCER_II: { isEnabled: true, uses: 1, repairWhen: 'ALL' },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 4 } },
    })

    t.advanceTo('GROUND_COMBAT')
    // Round 1, 3 hits: both mechs sustain, the third hit kills one. The
    // survivor is damaged — and with one mech left, "all damaged" is met
    // (an absolute threshold of 2 would have gone stale here).
    t.advanceRound({ attacker: 3, defender: 0 })
    expect(t.attacker.units.MECH).toHaveLength(1)
    expect(t.attacker.units.MECH?.[0].isDamaged).toBe(true)

    // Round 2 starts with a repair.
    t.advanceRound({ attacker: 0, defender: 0 })
    expect(t.attacker.units.MECH?.[0].isDamaged).toBeFalsy()
    expect(t.state.attacker.abilities.TF_STARLANCER_II.uses).toBe(0)
  })

  it('Radiant Aur mech repair is limited by its uses (1 token = 1 repair)', () => {
    const t = combatTest({
      system: 'TF',
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
