import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF unit upgrades', () => {
  it('applies a non-mech upgrade to the unit stats (Hybrid Crystal Fighter)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FIGHTER: 1 },
        abilities: { TF_UPGRADE_HYBRID_CRYSTAL_FIGHTER: true },
      },
      defender: { faction: 'AVARICE_REX', units: { FIGHTER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Base fighter combat 9 → upgraded to 7
    expect(t.dicePool().attacker).toContainDice('FIGHTER', [7, 1])
  })

  it('Echo of Ascension adjusts the flagship relative to its faction stats', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { FLAGSHIP: 1 },
        abilities: { TF_UPGRADE_ECHO_OF_ASCENSION: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    // Scintillia base [9,2] → combat value -1 and +1 die → [8,3]
    expect(t.dicePool().attacker).toContainDice('FLAGSHIP', [8, 3])
  })

  it('grants Sustain Damage via the Advanced Carrier upgrade', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CARRIER: 1 },
        abilities: { TF_UPGRADE_ADVANCED_CARRIER: true },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1 })

    // Base carriers can't sustain; the upgrade lets it survive 1 hit as damaged
    expect(t.attacker.units.CARRIER).toHaveLength(1)
    expect(t.attacker.units.CARRIER?.[0].isDamaged).toBe(true)
  })

  it('stacks mech upgrades (Eidolon Landwaster +1 die, then Eidolon Terminus -1 combat)', () => {
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'AVARICE_REX',
        units: { MECH: 1 },
        abilities: {
          TF_UPGRADE_EIDOLON_LANDWASTER: true,
          TF_UPGRADE_EIDOLON_TERMINUS: true,
        },
      },
      defender: { faction: 'AVARICE_REX', units: { INFANTRY: 1 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound()

    // Delver mech base [6,1] → +1 die → [6,2] → -1 combat value → [5,2]
    expect(t.dicePool().attacker).toContainDice('MECH', [5, 2])
  })
})
