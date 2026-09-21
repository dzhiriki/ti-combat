import { describe, expect, it } from 'vitest'

import { combatTest } from '../utils/combat-test'

// Il Na Viroset mech: participates in space combat as if it were a ship, +1
// per anomaly it is in or adjacent to. Mechs only join while the side has a
// ship fielded; `mechsOnGround` says how many stay on the planet (the rest
// are in the space area and keep the combat going after the fleet dies).
describe('TF_STARLANCER_XI', () => {
  it('mechs roll in space combat alongside ships', () => {
    const t = combatTest({
      system: 'TF',
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
      system: 'TF',
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

  it('mech sits in the assign-hits order at its worth slot by default', () => {
    // Sustain disabled so pure assignment order is observable: the fighter
    // (front of the worth-asc list) soaks before the mech.
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { FIGHTER: 1, CRUISER: 1, MECH: 1 },
        abilities: { SUSTAIN_DAMAGE: { isEnabled: false } },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.attacker.units.FIGHTER).toBeUndefined()
    expect(t.attacker.units.CRUISER).toHaveLength(1)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('dragging MECH to the front sacrifices mechs in space first', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { FIGHTER: 1, CRUISER: 1, MECH: 1 },
        abilities: {
          SUSTAIN_DAMAGE: { isEnabled: false },
          // MECH is a normal reorderable entry — front takes hits first
          UNIT_PRIORITY: {
            spaceUnitPriority: [['MECH'], ['FIGHTER'], ['CRUISER']],
          },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.FIGHTER).toHaveLength(1)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('with no ships fielded, the mechs stay on the ground — no space combat', () => {
    const t = combatTest({
      system: 'TF',
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

  it('combat ends when the last ship dies — ground mechs do not hold the space area', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          TF_STARLANCER_XI: { isEnabled: true, mechsOnGround: 1 },
        },
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

  it('space-area mechs keep the combat going after the last ship dies — and can win', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          // mechsOnGround defaults to 0 — the mech is in the space area.
          TF_STARLANCER_XI: { isEnabled: true, mechsOnGround: 0 },
          // Deterministic: no sustain, the cruiser soaks the hit.
          SUSTAIN_DAMAGE: { isEnabled: false },
          UNIT_PRIORITY: { spaceUnitPriority: [['CRUISER'], ['MECH']] },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: the cruiser dies, but the mech is IN the space area — the
    // combat continues.
    t.advanceRound({ attacker: 1, defender: 0 })
    expect(t.isFinished()).toBe(false)
    expect(t.attacker.units.MECH).toHaveLength(1)

    // Round 2: the mech kills the defender's cruiser and wins.
    t.advanceRound({ attacker: 0, defender: 1 })
    expect(t.state.winnerSide).toBe('attacker')
  })

  it('preserve strategies give up the space mechs first — the ground pool survives', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 2 },
        abilities: {
          TF_STARLANCER_XI: {
            isEnabled: true,
            mechsOnGround: 1,
            strategy: 'PRESERVE_SUSTAIN',
          },
          SUSTAIN_DAMAGE: { isEnabled: false },
          UNIT_PRIORITY: { spaceUnitPriority: [['CRUISER'], ['MECH']] },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // 2 hits: the cruiser dies, then a mech — attributed to the space pool
    // first. Nothing holds the space area any more, so the combat ends with
    // the ground mech alive.
    t.advanceRound({ attacker: 2, defender: 0 })

    expect(t.state.winnerSide).toBe('defender')
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('win-in-space gives up the ground mechs first — the fight goes on', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 2 },
        abilities: {
          // Same scenario as above under the default strategy: the dead
          // mech came from the ground pool, so a space mech still holds the
          // area and the combat continues.
          TF_STARLANCER_XI: { isEnabled: true, mechsOnGround: 1 },
          SUSTAIN_DAMAGE: { isEnabled: false },
          UNIT_PRIORITY: { spaceUnitPriority: [['CRUISER'], ['MECH']] },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2, defender: 0 })

    expect(t.isFinished()).toBe(false)
    expect(t.attacker.units.MECH).toHaveLength(1)
  })

  it('the no-sustain strategy keeps mechs from spending their sustain in space', () => {
    const t = combatTest({
      system: 'TF',
      mode: 'SPACE',
      attacker: {
        faction: 'IL_NA_VIROSET',
        units: { CRUISER: 1, MECH: 1 },
        abilities: {
          TF_STARLANCER_XI: {
            isEnabled: true,
            strategy: 'PRESERVE_NO_SUSTAIN',
          },
          // Mechs soak first so the hit would go to the mech either way.
          UNIT_PRIORITY: { spaceUnitPriority: [['MECH'], ['CRUISER']] },
        },
      },
      defender: { faction: 'AVARICE_REX', units: { CRUISER: 1 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // With sustain the mech would absorb the hit (damaged, alive); with the
    // no-sustain strategy it dies outright.
    t.advanceRound({ attacker: 1, defender: 0 })

    expect(t.attacker.units.MECH).toBeUndefined()
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })
})
