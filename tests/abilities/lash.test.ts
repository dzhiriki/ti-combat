import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_LASH', () => {
  it('destroys an equal-or-lower-cost enemy unit when your unit is destroyed', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_LASH: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker's lone cruiser dies, defender takes no combat hits — so any
    // defender loss is Lash's doing.
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.abilityLog('TF_LASH')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER ?? []).toHaveLength(0)
    // Cruiser cost (2) ≤ destroyed cruiser cost (2) → one defender cruiser dies
    expect(t.defender.units.CRUISER).toHaveLength(1)
  })

  it('does not trigger on unchecked own unit types', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 1 },
        abilities: {
          TF_LASH: { isEnabled: true, spaceTriggers: [['FIGHTER', false]] },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { FIGHTER: 1, CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Only a fighter is lost — unchecked, so the card is kept.
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.abilityLog('TF_LASH')).toHaveLength(0)
    expect(t.defender.units.FIGHTER).toHaveLength(1)
    expect(t.state.attacker.abilities.TF_LASH.uses).toBe(1)
  })

  it('destroys the first checked type in the target priority order', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: {
          TF_LASH: {
            isEnabled: true,
            // Default worth-desc order would take the destroyer; prefer
            // fighters instead.
            spaceTargetPriority: [
              ['FIGHTER', true],
              ['DESTROYER', true],
            ],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { DESTROYER: 1, FIGHTER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.abilityLog('TF_LASH')).not.toHaveLength(0)
    expect(t.defender.units.FIGHTER).toHaveLength(1)
    expect(t.defender.units.DESTROYER).toHaveLength(1)
  })

  it('does not fire when no eligible (cheap enough) target exists', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 1 },
        abilities: { TF_LASH: true },
      },
      // War Sun (cost 12) is far more expensive than a fighter (0.5)
      defender: { faction: 'AVARICE_REX', units: { WAR_SUN: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.abilityLog('TF_LASH')).toHaveLength(0)
    expect(t.defender.units.WAR_SUN).toHaveLength(1)
  })

  it("cannot destroy a pricier flagship than Il Na Viroset's Enigma", () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        // Enigma costs 7 — cheaper than every standard 8-cost flagship
        units: { FLAGSHIP: 1 },
        abilities: { TF_LASH: true },
      },
      defender: { faction: 'AVARICE_REX', units: { FLAGSHIP: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // 2 hits: the Enigma sustains the first, dies to the second
    t.advanceRound({ attacker: 2, defender: 0 })

    expect(t.attacker.units.FLAGSHIP ?? []).toHaveLength(0)
    expect(t.abilityLog('TF_LASH')).toHaveLength(0)
    expect(t.defender.units.FLAGSHIP).toHaveLength(1)
  })

  it('destroys a Dawncrusher when a carrier of equal cost dies', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CARRIER: 1 },
        abilities: { TF_LASH: true },
      },
      defender: {
        faction: 'AVARICE_REX',
        units: { DREADNOUGHT: 1 },
        // Dawncrusher drops the dreadnought's cost from 4 to 3
        abilities: { TF_UPGRADE_DAWNCRUSHER: true },
      },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.attacker.units.CARRIER ?? []).toHaveLength(0)
    expect(t.abilityLog('TF_LASH')).not.toHaveLength(0)
    // Carrier cost (3) === Dawncrusher cost (3) → Lash destroys it outright,
    // sustain and Spark immunity notwithstanding
    expect(t.defender.units.DREADNOUGHT ?? []).toHaveLength(0)
  })
})
