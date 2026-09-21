import { describe, expect, it } from 'vitest'

import { createLookups } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'
import { getGameData } from '@/utils/get-game-data'

describe('RuntimeAbilityList.get(slot)', () => {
  it('lists the abilities registered on a side under a slot, memoized', () => {
    const state = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: { faction: 'NOMAD', units: { CRUISER: 1 } },
      defender: { faction: 'NEUTRAL', units: { CRUISER: 1 } },
    })
    const ctx = state.params.context('attacker')
    // Every faction's agents share one slot; the slot config decides where
    // each of them renders.
    const agents = ctx.abilities.own.get('FACTION_AGENT')
    const keys = agents.map(a => a.key)
    expect(keys).toContain('THUNDARIAN')
    expect(keys).toContain('TELLURIAN')
    expect(ctx.abilities.own.get('FACTION_AGENT')).toBe(agents)
    expect(ctx.abilities.own.all.length).toBeGreaterThan(agents.length)
    // Neutral holds no commanders (`neutral: false` in the slot config).
    expect(ctx.abilities.opponent.get('FACTION_COMMANDER')).toEqual([])
    // The list is one object per side: own on the attacker is the
    // opponent on the defender.
    expect(
      state.params.context('defender').abilities.opponent.get('FACTION_AGENT'),
    ).toBe(agents)
  })

  it('createLookups mirrors the registered slots without an engine', () => {
    const registered = {
      attacker: getGameData('TI4').getAvailableAbilities('attacker', 'NOMAD'),
      defender: getGameData('TI4').getAvailableAbilities('defender', 'NEUTRAL'),
    }
    const lookups = createLookups(registered)
    const agentKeys = lookups.attacker.own.get('FACTION_AGENT').map(a => a.key)
    expect(agentKeys).toContain('THUNDARIAN')
    // Nomad's own agent keeps the same slot as everyone else's; only its
    // rendered category differs.
    const thundarian = registered.attacker.find(r => r.key === 'THUNDARIAN')!
    expect(thundarian.slot).toBe('FACTION_AGENT')
    expect(thundarian.factionKey).toBe('NOMAD')
    expect(lookups.attacker.own.get('AGENT')).toEqual([])
    expect(lookups.defender.opponent).toBe(lookups.attacker.own)
  })
})
