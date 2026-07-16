import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// Il Na Viroset mech: participates in space combat as if it were a ship, +1
// per anomaly it is in or adjacent to. The mechs fight from the ground: they
// only join while the side has ships, and they cannot hold the space area
// alone.
describe('TF_STARLANCER_XI', () => {
  it('mechs roll in space combat alongside ships', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    const pool = t.dicePool()
    expect(pool.attacker).toContainDice('MECH', [6, 1])
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('applies +1 per anomaly to the mech rolls only', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
        abilities: { TF_STARLANCER_XI: { isEnabled: true, anomalies: 2 } },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound()

    const pool = t.dicePool()
    // Mech [6,1] with +2 → hits on 4; the cruiser is untouched.
    expect(pool.attacker).toContainDice('MECH', [4, 1])
    expect(pool.attacker).toContainDice('CRUISER', [7, 1])
  })

  it('with no ships fielded, the mechs stay on the ground — no space combat', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
      defender: { faction: 'IL_NA_VIROSET', units: { MECH: 2 } },
    })

    t.advanceRound()

    // The defender never fields a space force: attacker takes the system,
    // and the mechs survive untouched on the ground.
    expect(t.state.winnerSide).toBe('attacker')
    expect(t.defender.units.MECH).toHaveLength(2)
  })

  it('combat ends when the last ship dies — surviving mechs do not hold the space area', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 3 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Attacker receives 2 hits: the mech sustains one, the cruiser dies to
    // the other. With no ships left the combat ends immediately — the
    // damaged mech survives on the ground instead of fighting round 2 alone.
    t.advanceRound({ attacker: 2, defender: 0 })

    expect(t.state.winnerSide).toBe('defender')
    expect(t.attacker.units.CRUISER).toBeUndefined()
    expect(t.attacker.units.MECH).toHaveLength(1)
  })
})
