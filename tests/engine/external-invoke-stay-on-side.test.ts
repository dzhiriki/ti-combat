import { describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

/**
 * Engine test: external invokes fired by a non-owner side don't consume the
 * alternation slot. Custom abilities have `ownerFaction === undefined` (no
 * faction owns them), so any external invoke they declare is treated as
 * "cross-faction usage" by the engine.
 *
 * Setup: attacker enables A (external), B, C; defender enables D, E.
 * All five fire at PREPARE, which runs once during `forSimulation`.
 *
 * Expected order — A B D C E:
 *   1. attacker → A (external) — `ran-stay`, no alternation
 *   2. attacker → B — `ran`, switch to defender
 *   3. defender → D — `ran`, switch to attacker
 *   4. attacker → C — `ran`, switch to defender
 *   5. defender → E — `ran`, switch to attacker
 *   6. attacker skipped, defender skipped → loop exits
 */
describe('engine: external invoke does not consume alternation slot', () => {
  it('A external on attacker, B/C on attacker, D/E on defender → A B D C E', () => {
    const order: string[] = []

    const make = (key: string, external: boolean): Ability => ({
      key,
      name: key,
      params: { isEnabled: false, uses: 1 },
      headerUI: 'isEnabled',
      invoke: [
        {
          timing: 'PREPARE',
          ...(external ? { external: true } : {}),
          call: () => {
            order.push(key)
          },
        },
      ],
    })

    const A = make('A', true)
    const B = make('B', false)
    const C = make('C', false)
    const D = make('D', false)
    const E = make('E', false)

    buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: {
        faction: 'NEUTRAL',
        units: { CRUISER: 1 },
        abilities: { A: true, B: true, C: true },
      },
      defender: {
        faction: 'NEUTRAL',
        units: { CRUISER: 1 },
        abilities: { D: true, E: true },
      },
      customAbilities: [A, B, C, D, E],
    })

    expect(order).toEqual(['A', 'B', 'D', 'C', 'E'])
  })
})
