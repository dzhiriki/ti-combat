import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'

import { combatTest } from '../utils/combat-test'

describe('SSRUU', () => {
  it('does nothing when agentKey is None', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 2 },
        abilities: {
          TELLURIAN: { isEnabled: true, uses: 1 },
          SSRUU: { isEnabled: true, agentKey: 'none' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })

    // Only Tellurian fires (1 hit cancelled → 1 cruiser destroyed)
    expect(t.abilityLog('SSRUU')).toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('Ssruu copy fires even when original Tellurian is not enabled', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 2 },
        abilities: {
          SSRUU: { isEnabled: true, agentKey: 'TELLURIAN' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })

    // Ssruu alone cancels 1 hit → 1 cruiser lost
    expect(t.abilityLog('SSRUU')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })

  it('Ssruu copy fires only once per combat (uses: 1)', () => {
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 4 },
        abilities: {
          SSRUU: { isEnabled: true, agentKey: 'TELLURIAN' },
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 4 } },
    })

    t.advanceTo('SPACE_COMBAT')
    // Round 1: Ssruu-Tellurian copy cancels 1 of 2 hits → 1 cruiser lost
    t.advanceRound({ attacker: 2 })
    expect(t.attacker.units.CRUISER).toHaveLength(3)

    // Round 2: Ssruu exhausted → no cancel, 2 hits land → 2 cruisers lost
    t.advanceRound({ attacker: 2 })
    expect(t.attacker.units.CRUISER).toHaveLength(1)

    expect(t.abilityLog('SSRUU')).toHaveLength(1)
    expect(t.state.attacker.abilities.SSRUU.uses).toBe(0)
  })

  it('re-resolves the copied agent when agentKey changes mid-combat', () => {
    // A helper that picks Tellurian for Ssruu at PREPARE, after Ssruu's own
    // invokes were built with agentKey 'none'.
    const picker: Ability = {
      key: 'PICK_TELLURIAN',
      name: 'Pick Tellurian',
      params: { isEnabled: true, uses: Infinity },
      headerUI: 'isEnabled',
      invoke: [
        {
          timing: 'PREPARE',
          call: ctx => {
            ctx.api.own.updateAbilityConfig('SSRUU', { agentKey: 'TELLURIAN' })
          },
        },
      ],
    }
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'YSSARIL_TRIBES',
        units: { CRUISER: 2 },
        abilities: {
          SSRUU: { isEnabled: true, agentKey: 'none' },
          PICK_TELLURIAN: true,
        },
      },
      defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
      customAbilities: [picker],
    })

    t.advanceTo('SPACE_COMBAT')
    t.advanceRound({ attacker: 2 })

    // The Tellurian copy cancels 1 hit → 1 cruiser lost
    expect(t.abilityLog('SSRUU')).not.toHaveLength(0)
    expect(t.attacker.units.CRUISER).toHaveLength(1)
  })
})
