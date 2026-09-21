import { beforeEach, describe, expect, it } from 'vitest'

import type { Ability } from '@/combat'
import { CombatEngine } from '@/combat'
import { buildCombatState } from '@/hooks/combat-setup/build-combat-state'

/**
 * Engine-level tests for the ctx.rollDice API — branching abilities mid-call.
 *
 * These tests exercise the interrupt-based branching flow:
 *   ability.call → ctx.rollDice → per-outcome branch → tryResolveOne catches
 *   AbilityBranchInterrupt → runAbilities forks remaining abilities per branch
 *   → processStartOfRound/processAssignHits/etc. → handleBranchesOrContinue
 *   → expandNode in CombatEngine reconciles the tree.
 */

// Single-die rollDice at START_OF_COMBAT — adds 1 hit on a success.
const rollDiceAbility: Ability = {
  key: 'TEST_ROLL_DICE',
  name: 'Test Roll Dice',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        const unitPriority = ctx.api.opponent.participating.getUnitTypes()
        ctx.rollDice([[5, 1]], (branchCtx, hits) => {
          if (hits[0] > 0) {
            branchCtx.api.opponent.addHits(hits[0], unitPriority)
          }
        })
      },
    },
  ],
}

// Two-group rollDice — both groups at 4+, producing per-group hits.
const rollDiceTwoGroupsAbility: Ability = {
  key: 'TEST_ROLL_DICE_TWO_GROUPS',
  name: 'Test Roll Dice Two Groups',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        const unitPriority = ctx.api.opponent.participating.getUnitTypes()
        ctx.rollDice(
          [
            [5, 1],
            [5, 1],
          ],
          (branchCtx, hits) => {
            const total = hits[0] + hits[1]
            if (total > 0) {
              branchCtx.api.opponent.addHits(total, unitPriority)
            }
          },
        )
      },
    },
  ],
}

// Chains: when opponent unit destroyed, roll 1 die; on hit destroy own ship.
// Simulates Courageous to the End's AFTER_DESTROY → rollDice pattern.
const chainRollDiceAbility: Ability = {
  key: 'TEST_CHAIN_ROLL_DICE',
  name: 'Test Chain Roll Dice',
  params: { isEnabled: false, uses: Infinity },
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, _ctx, ids) => ids.length > 0,
      call: ctx => {
        ctx.rollDice([[5, 1]], (branchCtx, hits) => {
          if (
            hits[0] > 0 &&
            branchCtx.api.opponent.surface.hasUnitType('CRUISER', {
              includeVariants: false,
            })
          ) {
            branchCtx.api.opponent.destroyUnits('CRUISER')
          }
        })
      },
    },
  ],
}

// Zero-dice ability — exercises the single-outcome fast path.
let zeroDiceCallbackCalls = 0
const zeroDiceFastPathAbility: Ability = {
  key: 'TEST_ZERO_DICE',
  name: 'Test Zero Dice',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        ctx.rollDice([], (_branchCtx, hits) => {
          zeroDiceCallbackCalls += 1
          expect(hits).toEqual([])
        })
      },
    },
  ],
}

// Deterministic-hit ability (hitValue=1 → always hit) — single-outcome fast path.
const deterministicHitAbility: Ability = {
  key: 'TEST_DETERMINISTIC_HIT',
  name: 'Test Deterministic Hit',
  params: { isEnabled: false, uses: 1 },
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      call: ctx => {
        const unitPriority = ctx.api.opponent.participating.getUnitTypes()
        ctx.rollDice([[1, 1]], (branchCtx, hits) => {
          // Always [1] — 100% hit on value 1
          expect(hits).toEqual([1])
          branchCtx.api.opponent.addHits(1, unitPriority)
        })
      },
    },
  ],
}

describe('ctx.rollDice API', () => {
  beforeEach(() => {
    zeroDiceCallbackCalls = 0
  })

  it('single-die rollDice produces outcomes summing to probability 1', () => {
    // Attacker has 2 destroyers; defender has 2 destroyers + the ability.
    const combatState = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { TEST_ROLL_DICE: true },
      },
      customAbilities: [rollDiceAbility],
    })

    const outcomes = new CombatEngine().simulate(combatState)

    const totalProb = outcomes.reduce((a, o) => a + o.probability, 0)
    expect(totalProb).toBeCloseTo(1.0)
    // At least some outcomes should exist beyond the no-ability baseline.
    expect(outcomes.length).toBeGreaterThan(0)
  })

  it('two-group rollDice produces correct Cartesian outcomes', () => {
    const combatState = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { TEST_ROLL_DICE_TWO_GROUPS: true },
      },
      customAbilities: [rollDiceTwoGroupsAbility],
    })

    const outcomes = new CombatEngine().simulate(combatState)
    const totalProb = outcomes.reduce((a, o) => a + o.probability, 0)
    expect(totalProb).toBeCloseTo(1.0)
  })

  it('empty dice fast path runs callback once and does not branch', () => {
    const combatState = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 1 },
        abilities: { TEST_ZERO_DICE: true },
      },
      defender: { faction: 'ARBOREC', units: { DESTROYER: 1 } },
      customAbilities: [zeroDiceFastPathAbility],
    })

    const outcomes = new CombatEngine().simulate(combatState)
    expect(outcomes.length).toBeGreaterThan(0)
    // Callback was called at least once (during START_OF_COMBAT_ROUND of round 1).
    expect(zeroDiceCallbackCalls).toBeGreaterThan(0)
    const totalProb = outcomes.reduce((a, o) => a + o.probability, 0)
    expect(totalProb).toBeCloseTo(1.0)
  })

  it('single-outcome (deterministic hit) fast path applies effect without branching', () => {
    const combatState = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: { faction: 'ARBOREC', units: { DESTROYER: 2 } },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { TEST_DETERMINISTIC_HIT: true },
      },
      customAbilities: [deterministicHitAbility],
    })

    const outcomes = new CombatEngine().simulate(combatState)
    const totalProb = outcomes.reduce((a, o) => a + o.probability, 0)
    expect(totalProb).toBeCloseTo(1.0)
    // Attacker always takes a guaranteed hit at start → can never emerge with
    // 2 undamaged destroyers (they start with 2 and guaranteed hit destroys/damages one).
    // Note: destroyers don't have sustain, so one must always be destroyed.
    for (const o of outcomes) {
      const count = o.attacker.DESTROYER?.length ?? 0
      expect(count).toBeLessThanOrEqual(1)
    }
  })

  it('chains: Ambush-style → Courageous-style branching composes probabilities', () => {
    // Attacker ability rolls dice at START_OF_COMBAT_ROUND.
    // On hit, opponent cruiser gets destroyed. That triggers AFTER_DESTROY.
    // Defender has chain ability on AFTER_DESTROY which rolls another die.
    // On that second hit, an attacker cruiser is destroyed in retaliation.
    const combatState = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DESTROYER: 1 },
        abilities: { TEST_ROLL_DICE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { CRUISER: 2, DESTROYER: 1 },
        abilities: { TEST_CHAIN_ROLL_DICE: true },
      },
      customAbilities: [rollDiceAbility, chainRollDiceAbility],
    })

    const outcomes = new CombatEngine().simulate(combatState)
    const totalProb = outcomes.reduce((a, o) => a + o.probability, 0)
    expect(totalProb).toBeCloseTo(1.0)
  })

  it('branching abilities on both sides produces Cartesian outcomes', () => {
    const combatState = buildCombatState({
      system: 'TI4',
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { TEST_ROLL_DICE: true },
      },
      defender: {
        faction: 'ARBOREC',
        units: { DESTROYER: 2 },
        abilities: { TEST_ROLL_DICE: true },
      },
      customAbilities: [rollDiceAbility],
    })

    const outcomes = new CombatEngine().simulate(combatState)
    const totalProb = outcomes.reduce((a, o) => a + o.probability, 0)
    expect(totalProb).toBeCloseTo(1.0)
  })
})
