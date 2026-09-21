import { describe, expect, it } from 'vitest'

import { pendingHits, unitCount } from '../utils/branches'
import { combatTest } from '../utils/combat-test'

describe('CROWN_OF_THALNOS + WAR_FUNDING', () => {
  // Per TI rules, rerolls compose sequentially: War Funding fires first
  // (modifier=0, no destroy), then Crown of Thalnos sees what's still
  // missing and may reroll those (with +1 and the destruction gamble for
  // selected units). The kernel's `decideRerolls` currently picks ONE
  // reroll decl per face class — once War Funding claims `definiteMiss`,
  // Crown can't chain on the dice that came back missing. These tests
  // encode the rules-correct expectations and are marked `it.fails(...)`
  // to document the kernel gap.

  it.fails('War Funding rerolls misses, then Crown rerolls remaining misses (destruction gamble)', () => {
    // ARBOREC FLAGSHIP [7,2]. Crown selects FLAGSHIP (Path 1, +1 with
    // destroy). War Funding own ALWAYS rerolls misses with mod=0.
    //
    // Sequential per-die journey:
    //   NH = natural hit         (face 7-10, 0.4)        → no reroll
    //   WH = WF rerolled to hit  (0.6 · 0.4 = 0.24)       → no Crown reroll
    //   CH = WF reroll missed, Crown rerolled to hit
    //                            (0.6 · 0.6 · 0.5 = 0.18)
    //   CM = WF reroll missed, Crown rerolled to miss
    //                            (0.6 · 0.6 · 0.5 = 0.18)
    // Per die: hit 0.82, miss 0.18.
    //
    // Joint over 2 dice:
    //   2 hits: 0.82²       = 0.6724
    //   1 hit:  2·0.82·0.18 = 0.2952
    //   0 hits: 0.18²       = 0.0324
    //
    // Destruction: Crown's destroy effect fires on units it rerolled
    // whose final unitHits=0. The only way for the FLAGSHIP to land at
    // 0 hits is both dice ending in CM — which means Crown rerolled
    // both. So P(destroyed) = 0.0324.
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FLAGSHIP: 1 },
        abilities: {
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: false,
            selectedUnitTypes: [['FLAGSHIP', true]],
          },
          WAR_FUNDING: {
            isEnabled: true,
            ownStrategyKind: 'ALWAYS',
            ownStrategyThreshold: 0,
            opponentStrategyKind: 'NEVER',
            opponentStrategyThreshold: 0,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(unitCount('attacker', 'FLAGSHIP'), [
      { value: 0, probability: 0.0324 },
      { value: 1, probability: 0.9676 },
    ])

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 2, probability: 0.6724 },
      { value: 1, probability: 0.2952 },
      { value: 0, probability: 0.0324 },
    ])
  })

  it.fails('War Funding rerolls misses, then Crown safe-mode rerolls misses on already-hit units', () => {
    // ARBOREC FLAGSHIP [7,2]. Crown in safe-mode (no selection); safe
    // predicate fires when unitHitsBeforeReroll>0 or hitValue<=2.
    // After War Funding's pass each die is in one of:
    //   NH = natural hit         (0.4)  → 1 hit
    //   WH = WF reroll → hit     (0.24) → 1 hit
    //   WM = WF reroll → miss    (0.36) → candidate for Crown safe
    //
    // Per-unit joint state after War Funding (2 dice):
    //   (hit, hit):  0.64² = 0.4096 → no Crown reroll, 2 hits.
    //   (hit, WM)·2: 2·0.64·0.36 = 0.4608 → Crown fires on the WM die
    //                (unitHitsBeforeReroll=1>0). +1 reroll hits at face
    //                ≥ 6 (prob 0.5).
    //                  WM → hit:  0.2304 → 2 hits
    //                  WM → miss: 0.2304 → 1 hit
    //   (WM, WM):    0.36² = 0.1296 → Crown safe predicate is false
    //                (unitHitsBeforeReroll=0, hitValue=7>2) → no Crown
    //                reroll → 0 hits.
    //
    // Aggregated:
    //   2 hits: 0.4096 + 0.2304 = 0.6400
    //   1 hit:  0.2304
    //   0 hits: 0.1296
    // FLAGSHIP always alive (safe-mode has no destroy effect).
    const t = combatTest({
      mode: 'SPACE',
      attacker: {
        faction: 'ARBOREC',
        units: { FLAGSHIP: 1 },
        abilities: {
          CROWN_OF_THALNOS: {
            isEnabled: true,
            safeReroll: true,
            selectedUnitTypes: [],
          },
          WAR_FUNDING: {
            isEnabled: true,
            ownStrategyKind: 'ALWAYS',
            ownStrategyThreshold: 0,
            opponentStrategyKind: 'NEVER',
            opponentStrategyThreshold: 0,
          },
        },
      },
      defender: { faction: 'ARBOREC', units: { CARRIER: 1 } },
    })

    const branches = t.advance()

    expect(branches).toHaveBranches(unitCount('attacker', 'FLAGSHIP'), [
      { value: 1, probability: 1 },
    ])

    expect(branches).toHaveBranches(pendingHits('defender'), [
      { value: 2, probability: 0.64 },
      { value: 1, probability: 0.2304 },
      { value: 0, probability: 0.1296 },
    ])
  })
})
