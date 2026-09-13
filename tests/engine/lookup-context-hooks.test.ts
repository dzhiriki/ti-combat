import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

describe('declare hooks receive the lookup context', () => {
  it('declareSubtype, declareParamChange and onParamSet see ctx.this and ctx.abilities', () => {
    const seen: string[] = []
    const probe: Ability = {
      key: 'PROBE',
      name: 'Probe',
      params: { isEnabled: true, uses: Infinity, flag: false },
      headerUI: 'isEnabled',
      declareSubtype: (_params, ctx) => {
        seen.push(
          `subtype:${ctx.this.key}:${ctx.abilities.own.get('FACTION_AGENT').length > 0}`,
        )
        return []
      },
      declareParamChange: (_params, _settings, ctx) => {
        seen.push(
          `change:${ctx.this.key}:${ctx.abilities.opponent.all.length > 0}`,
        )
        return []
      },
      onParamSet: (params, key, _value, ctx) => {
        seen.push(`set:${key}:${ctx.this.key}`)
        return params
      },
      invoke: [
        {
          timing: 'PREPARE',
          call: ctx => {
            ctx.api.own.updateAbilityConfig({ flag: true })
          },
        },
      ],
    }

    buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: {
        faction: 'NOMAD',
        units: { CRUISER: 1 },
        abilities: { PROBE: true },
      },
      defender: { faction: 'NEUTRAL', units: { CRUISER: 1 } },
      customAbilities: [probe],
    })

    expect(seen).toContain('subtype:PROBE:true')
    expect(seen).toContain('change:PROBE:true')
    // The PREPARE update goes through the engine's invokeOnParamSet.
    expect(seen).toContain('set:flag:PROBE')
  })
})
