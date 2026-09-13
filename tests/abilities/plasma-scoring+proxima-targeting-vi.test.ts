import { describe, expect, it } from 'vitest'

import { CombatEngine } from '@/combat'
import type { CombatStateConfig } from '@/hooks/combat-setup/build-combat-state'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

import { combatTest } from '../utils/combat-test'

function summarize(config: CombatStateConfig) {
  const state = buildCombatState(config)
  const outcomes = new CombatEngine().simulate(state)
  let a = 0
  let d = 0
  let dr = 0
  for (const o of outcomes) {
    if (o.winner === 'attacker') a += o.probability
    else if (o.winner === 'defender') d += o.probability
    else dr += o.probability
  }
  return { a, d, dr }
}

describe('PLASMA_SCORING + PROXIMA_TARGETING_VI', () => {
  it('Plasma adds the die on the opp-bomb but NOT on the self-bomb', () => {
    // Proxima emits two synthetic bombardment rolls per round, both under
    // the ability key `PROXIMA_TARGETING_VI`: first the self-bomb
    // (target=OWN, hits route back to the firing side), then the opp-bomb
    // (default routing). Plasma's intent is opponent-facing — granting
    // +1 die on the self-routed roll would self-inflict. The engine
    // suppresses ADD_DICE_COUNT on self-target rolls (mirroring the
    // reroll spec flip in apply-rerolls), so:
    //  - self-bomb pool stays at the synthetic base [8, 3]
    //  - opp-bomb pool grows to [8, 4] from Plasma
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
          PLASMA_SCORING: { isEnabled: true },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    // Proxima pushes two resolveSteps; pendingSteps execute LIFO, so the
    // opp-bomb (pushed second) runs first and the self-bomb (target=OWN,
    // pushed first) runs second. Both pools live under the `__custom`
    // source key (synthetic dice — no real unit type backing them).
    const oppBomb = t.dicePool(0)
    const selfBomb = t.dicePool(1)

    expect(oppBomb.hitSource).toBe('BOMBARDMENT')
    expect(selfBomb.hitSource).toBe('BOMBARDMENT')
    // Opp-bomb: routing lands hits on defender, Plasma fires → 4 dice.
    expect(oppBomb.attacker).toContainDice('__custom', [8, 4])
    // Self-bomb: routing lands hits on attacker (self-target), engine
    // suppresses Plasma's ADD_DICE_COUNT → synthetic 3-die pool.
    expect(selfBomb.attacker).toContainDice('__custom', [8, 3])
  })

  it('without Plasma, both Proxima rolls stay at the synthetic 3-die base', () => {
    // Control case: with no ADD_DICE_COUNT modifier in flight, both
    // Proxima rolls emit the same synthetic [8, 3] pool. Establishes the
    // baseline the previous test compares against.
    const t = combatTest({
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { INFANTRY: 3 } },
    })

    t.advanceTo('GROUND_COMBAT')
    t.advanceRound({ attacker: 0, defender: 0 })

    expect(t.dicePool(0).attacker).toContainDice('__custom', [8, 3])
    expect(t.dicePool(1).attacker).toContainDice('__custom', [8, 3])
  })

  it('symmetric LB/LB setup: per-round dice counts stay bounded (no accumulation)', () => {
    // Regression for the accumulation bug fixed by cloning the custom
    // collection at the `collectSideDice` boundary. Without the clone,
    // Plasma's in-place ADD_DICE_COUNT mutation survived engine cycle
    // re-expansions and the bomb pool grew 3 → 4 → 5 → ... unboundedly,
    // making win-rates drift to extreme values. The check here is that
    // the totals stay in a sane range — attacker keeps a small ordering
    // advantage from firing Proxima first (their self-bomb is resolved
    // before any Galvanized units die) but neither side runs away.
    const r = summarize({
      system: 'TI4',
      mode: 'GROUND',
      attacker: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
          PLASMA_SCORING: { isEnabled: true },
        },
      },
      defender: {
        faction: 'LAST_BASTION',
        units: { INFANTRY: 3 },
        abilities: {
          PROXIMA_TARGETING_VI: {
            isEnabled: true,
            resolveBombardment: true,
          },
          PLASMA_SCORING: { isEnabled: true },
        },
      },
    })
    expect(r.a + r.d + r.dr).toBeCloseTo(1, 10)
    expect(r.a).toBeGreaterThan(0.3)
    expect(r.a).toBeLessThan(0.6)
    expect(r.d).toBeGreaterThan(0.3)
    expect(r.d).toBeLessThan(0.6)
  })
})
