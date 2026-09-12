import { describe, expect, it } from 'vitest'

import { createLookups } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import { getAvailableAbilities } from '@/hooks/combat-setup/get-available-abilities'

describe('RuntimeAbilityList.get(slot)', () => {
  it('lists the abilities registered on a side under a slot, memoized', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: { faction: 'NOMAD', units: { CRUISER: 1 } },
      defender: { faction: 'NEUTRAL', units: { CRUISER: 1 } },
    })
    const ctx = state.params.context('attacker')
    const agents = ctx.abilities.own.get('AGENT')
    const keys = agents.map(a => a.key)
    expect(keys).toContain('THUNDARIAN')
    expect(keys).toContain('TELLURIAN')
    expect(ctx.abilities.own.get('AGENT')).toBe(agents)
    expect(ctx.abilities.own.all.length).toBeGreaterThan(agents.length)
    // Neutral holds no commanders (NEUTRAL_HIDDEN_SLOTS).
    expect(ctx.abilities.opponent.get('COMMANDER')).toEqual([])
    // The list is one object per side: own on the attacker is the
    // opponent on the defender.
    expect(
      state.params.context('defender').abilities.opponent.get('AGENT'),
    ).toBe(agents)
  })

  it('createLookups mirrors the registered slots without an engine', () => {
    const registered = {
      attacker: getAvailableAbilities('TI4', 'attacker', 'NOMAD'),
      defender: getAvailableAbilities('TI4', 'defender', 'NEUTRAL'),
    }
    const lookups = createLookups(registered)
    const agentKeys = lookups.attacker.own.get('AGENT').map(a => a.key)
    expect(agentKeys).toContain('THUNDARIAN')
    // First registration wins for duplicate keys, like the engine's dedup.
    const thundarianSlot = registered.attacker.find(
      r => r.ability.key === 'THUNDARIAN',
    )!.slot
    expect(thundarianSlot).toBe('AGENT')
    expect(lookups.attacker.own.get('FACTION_AGENT')).toEqual([])
    expect(lookups.defender.opponent).toBe(lookups.attacker.own)
  })
})
