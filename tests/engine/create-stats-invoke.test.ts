import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import type { UnitStats } from '@/types'
import { createStatsInvoke } from '@/utils/create-stats-invoke'
import { isStatsInvoke } from '@/utils/is-stats-invoke'

import { combatTest } from '../utils/combat-test'

const stats: UnitStats = {
  COST: 0,
  COMBAT: [4, 2],
  MOVE: 0,
  CAPACITY: null,
  UNIT_ABILITIES: { AFB: [5, 2] },
}

describe.forEachSide('createStatsInvoke', () => {
  it.each([0, 1])('applies native stats without spending uses (%i)', uses => {
    const upgrade: Ability = {
      key: 'TEST_STATS_UPGRADE',
      name: 'Test stats upgrade',
      params: { isEnabled: false, uses },
      headerUI: 'isEnabled',
      invoke: [createStatsInvoke('DREADNOUGHT', stats)],
    }
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DREADNOUGHT: 1, CRUISER: 1 },
        abilities: { TEST_STATS_UPGRADE: true },
      },
      defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
      customAbilities: [upgrade],
    })

    expect(t.state.attacker.unitStats.DREADNOUGHT).toMatchObject({
      ...stats,
      // Unspecified top-level stats remain unchanged.
      FLEET_POOL_COST: 1,
    })
    // Native stat updates replace UNIT_ABILITIES rather than deep-merging.
    expect(t.state.attacker.unitStats.DREADNOUGHT).toHaveProperty(
      'UNIT_ABILITIES',
      stats.UNIT_ABILITIES,
    )
    expect(t.state.attacker.unitStats.CRUISER).toMatchObject({ COMBAT: [7, 1] })
    expect(t.state.defender.unitStats.DREADNOUGHT).toMatchObject({
      COMBAT: [5, 1],
    })
    expect(t.state.attacker.abilities.TEST_STATS_UPGRADE.uses).toBe(uses)
    expect(stats).toEqual({
      COST: 0,
      COMBAT: [4, 2],
      MOVE: 0,
      CAPACITY: null,
      UNIT_ABILITIES: { AFB: [5, 2] },
    })
  })

  it('exposes only the declared stat block for inheritance', () => {
    const invoke = createStatsInvoke('DREADNOUGHT', stats)
    expect(isStatsInvoke(invoke)).toBe(true)
    expect(invoke.unitType).toBe('DREADNOUGHT')
    expect(invoke.stats).toBe(stats)
    expect(isStatsInvoke({ timing: 'PREPARE', call: () => {} })).toBe(false)
  })

  it('creates distinct invokes even when cards share a stat block', () => {
    expect(createStatsInvoke('DREADNOUGHT', stats)).not.toBe(
      createStatsInvoke('DREADNOUGHT', stats),
    )
  })
})
