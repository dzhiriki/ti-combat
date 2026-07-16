import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

describe('TF_CLEVER_GENOME', () => {
  it('copies Splitting Genome: places 2 fighters when the cruiser dies', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: {
          TF_CLEVER_GENOME: {
            isEnabled: true,
            genomeKey: 'TF_SPLITTING_GENOME',
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    // The lone cruiser died → the copied Splitting Genome places 2 fighters
    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(2)
    expect(t.abilityLog('TF_CLEVER_GENOME')).not.toHaveLength(0)
  })

  it('copies Mirror Genome: blocks opponent Space Cannon from PREPARE', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 2 },
        abilities: {
          TF_CLEVER_GENOME: { isEnabled: true, genomeKey: 'TF_MIRROR_GENOME' },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { PDS: 1, CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    expect(t.dicePool()?.defender?.PDS).toBeUndefined()
  })

  it('does nothing when no genome is selected', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'AVARICE_REX',
        units: { CRUISER: 1 },
        abilities: { TF_CLEVER_GENOME: { isEnabled: true } },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    // Cruiser died, but nothing was copied — no fighters appear
    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.abilityLog('TF_CLEVER_GENOME')).toHaveLength(0)
  })
})
