# Ability Testing Guide

## Test Framework

- **Vitest 4** with globals enabled (`describe`, `it`, `expect` auto-available)
- Custom matchers and `forEachSide` helpers loaded automatically via setup files
- Run tests: `npm run test:run` (single run) or `npm run test` (watch mode)

## File Naming

- Single ability: `ability-name.test.ts` (kebab-case of the ability key)
- Multiple abilities: names joined with `+`, sorted alphabetically. Example: `bunker+plasma-scoring.test.ts`
- Exceptions: `assimilator-z` and `technological-singularity` always come first in both filename and describe block, in that order. Example: `assimilator-z+technological-singularity+fourth-moon.test.ts`
- Nekro unit abilities (`NEKRO_UNIT_*`): use the unit name (kebab-case) in both filename and describe block, not the ability key. Drop version numbers (I/II) from filenames. Example: `technological-singularity+spec-ops.test.ts` with `describe('TECHNOLOGICAL_SINGULARITY + SPEC_OPS', ...)` for `NEKRO_UNIT_FEDERATION_OF_SOL_INFANTRY`
- Tests about Nekro having other factions' technologies (via `NEKRO_UNIT_*` or `NEKRO_FLAGSHIP_*`) always include `technological-singularity` in the filename, whether the ability is pre-enabled in config or dynamically enabled/disabled by TS
- All test files go in `tests/abilities/`
- Each test file must contain exactly ONE `describe` block (either `describe()` or `describe.forEachSide()`)
- Never include `ABILITY_ORDER` in test filenames, even if the test configures it to control resolution order

## Imports

Every test file needs at minimum:

```typescript
import { describe, expect, it } from 'vitest'
import { combatTest } from '../utils/combat-test'
```

## The `combatTest()` Factory

Creates a `CombatTest` instance from a config object. The constructor automatically runs `PREPARE` timings.

```typescript
const t = combatTest({
  system?: 'TI4' | 'TF', // defaults from first non-neutral faction
  mode: 'SPACE' | 'GROUND',
  attacker: {
    faction: FactionKey,          // e.g. 'ARBOREC', 'SARDAKK_NORR'
    units: { CRUISER: 2 },        // unit type -> count
    upgrades?: ['CRUISER'],       // unit types to use UPGRADED stats
    abilities?: {                 // ability configs
      ABILITY_KEY: true,          // shorthand: sets { isEnabled: true }
      ABILITY_KEY: { ... },       // explicit params
    },
  },
  defender: { /* same structure */ },
})
```

`combatTest` infers the system only as a test-authoring convenience (all-neutral
setups default to TI4). For Neutral vs Neutral in Twilight's Fall, pass
`system: 'TF'`. Direct `buildCombatState` callers must always pass
`system`; both factions must belong to that system.

### Ability params shorthand

- `ABILITY_KEY: true` expands to `{ isEnabled: true }`
- `ABILITY_KEY: { isEnabled: true, strategy: 'BEST' }` passes params directly

## CombatTest API Reference

### State Access

| Property     | Returns           | Description                                  |
| ------------ | ----------------- | -------------------------------------------- |
| `t.state`    | `CombatStateData` | Full combat state                            |
| `t.attacker` | `SideView`        | Attacker's reconstructed units and side data |
| `t.defender` | `SideView`        | Defender's reconstructed units and side data |
| `t.log`      | `LogEntry[]`      | All accumulated log entries                  |

`SideView` reconstructs units into `Partial<Record<UnitBaseType, TestUnit[]>>` where each `TestUnit` has `isDamaged`, `subtypes?`, etc.

### Phase Control

| Method                     | Description                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t.advanceTo(meta, hits?)` | Advance until just **before** `meta` executes. `meta` is a whole MetaPhase (`'SPACE_COMBAT'`, `'AFB'`, `'GROUND_COMBAT'`, `'COMPLETE'`, …), never a micro-phase. Picks outcome matching `hits` (default 0) |
| `t.advanceRound(hits?)`    | Process one full combat round from current position through END                                                                                                                                            |
| `t.step(round?)`           | Single advance step, returns all `StateWithProbability[]` outcomes                                                                                                                                         |

### HitsSpec

The `hits` parameter accepts `HitsSpec`:

```typescript
type HitsSpec = number | { attacker?: number; defender?: number }
```

- `number` — match total hits across both sides
- `{ attacker?: n, defender?: n }` — match per-side hits received (missing side defaults to 0)

**Important:** `{ attacker: 1 }` means attacker **receives** 1 hit (from defender dice). To produce N hits on a side, the opposing side needs enough dice-producing units.

### Log Query Methods

| Method                    | Description                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `t.abilityLog(key)`       | Log entries where path includes `key`                                                                     |
| `t.abilityLog(key, side)` | Same, filtered by combat side                                                                             |
| `t.dicePool(index?)`      | DICE_POOL entry at `index` (`.at()` semantics, default `-1` = last): `{ attacker, defender, hitSource? }` |

For phase system, ability timings, unit stats, factions, and ability keys — see `docs/overview.md`.

## Custom Matcher: `toContainDice`

```typescript
// Single dice group
expect(dicePool).toContainDice(unitType, [hitValue, diceCount])

// Multiple dice groups (variadic)
expect(dicePool).toContainDice(
  unitType,
  [hitValue, diceCount],
  [hitValue, diceCount],
)
```

Checks that the dice pool for `unitType` contains dice groups matching the given `[hitValue, diceCount]` pairs. Accepts one or more dice group arguments. Auto-loaded via setup file — no explicit import needed.

## Custom Matcher: `toHaveBranches`

Asserts the exact probability distribution over the branches returned by `t.advance()` (or `t.step()`). Use it when you need to verify the full set of outcomes and their probabilities, not just a single picked outcome.

```typescript
expect(branches).toHaveBranches(extractor, specs)
```

- `extractor: (branch: StateWithProbability) => X` — derives the value you want to group branches by (e.g. surviving unit count, pending hits).
- `specs: { value: X; probability: number; predicate? }[]` — for each spec, the matcher sums the probability of all branches whose extracted `value` equals `spec.value` (compared structurally, element-wise for arrays) and an optional `predicate` holds, then asserts that total equals `spec.probability` (within `1e-9`).

Branch extractors live in `tests/utils/branches.ts` and are curried so they drop straight into the matcher:

| Helper                        | Per-branch value                                                  |
| ----------------------------- | ----------------------------------------------------------------- |
| `pendingHits(side)`           | total pending hits on `side`                                      |
| `unitCount(side, baseType)`   | surviving units of `baseType` (incl. subtypes) on `side`          |
| `currentUses(side, key)`      | effective `uses` of ability `key` on `side` (live overlay → base) |
| `liveUses(branch, side, key)` | live-overlay `uses` only, or `undefined` if untouched             |
| `all(...extractors)`          | tuple of the given extractors' values — group by a composite key  |

`branchesByHit(branches, side, amount)` and `sumProb(branches)` are also available for manual filtering/aggregation.

```typescript
import { all, pendingHits, unitCount } from '../utils/branches'

const branches = t.advance()

// Group each branch by [attacker cruisers alive, defender pending hits]:
expect(branches).toHaveBranches(
  all(unitCount('attacker', 'CRUISER'), pendingHits('defender')),
  [
    { value: [1, 1], probability: 0.7 },
    { value: [0, 0], probability: 0.3 },
  ],
)
```

The matcher is auto-loaded via setup file (no explicit import); the `branches` helpers must be imported from `../utils/branches`.

## Side-Reversal Testing (`forEachSide`)

`describe.forEachSide` and `it.forEachSide` run tests twice — once normally, once with attacker/defender swapped. This verifies abilities work identically regardless of which side they're assigned to.

```typescript
// Runs every `it` inside twice (normal + reversed)
describe.forEachSide('ABILITY_NAME', () => {
  it('test one', () => { ... })
  it('test two', () => { ... })
})

// Or per-test
it.forEachSide('adds infantry at end of round', () => { ... })
```

Labels in test output: `"ABILITY_NAME > test"` and `"[reversed] ABILITY_NAME > test"`.

### How it works

In reversed mode, `combatTest()` swaps `config.attacker` and `config.defender` before building state. The `CombatTest` instance then transparently maps all accessors:

- `t.attacker` / `t.defender` — read from the swapped internal side
- `t.state` — returns state with swapped `attacker`/`defender` and `abilities`
- `advanceTo` / `advanceRound` — swap HitsSpec keys before outcome selection
- `abilityLog(key, side)` — map the `side` parameter
- `dicePool()` — swap keys in returned object

The test body is 100% identical in both runs.

### When to use `forEachSide`

Use `describe.forEachSide` for abilities that are **symmetric** — they work the same regardless of which side has them (e.g., sustain damage, direct hit, combat modifiers).

Use plain `describe` for abilities tied to a specific side:

- **Bombardment** abilities (attacker-only phase): Blitz, X-89 Bacterial Weapon
- **Space Cannon Defense** abilities (defender-only phase): Custodia Vigilia, Lightrail Ordnance
- **Side-restricted abilities**: Claire Gibson (`side: 'defender'`), Magen Defense Grid (`side: 'defender'`)
- **Tests that depend on alternation order**: attacker abilities resolve before defender abilities in START_OF_COMBAT

## Test Patterns by Ability Type

### 1. Dice Modifier (hit value changes, extra dice)

Advance to combat START, run a round, then check the logged dice pool.

```typescript
it('modifies combat dice', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'ARBOREC',
      units: { CRUISER: 1 },
      abilities: { MY_ABILITY: true },
    },
    defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
  })

  t.advanceTo('SPACE_COMBAT')
  t.advanceRound()
  const pool = t.dicePool()

  // Cruiser base combat: [7, 1] -> modified to [6, 1]
  expect(pool.attacker).toContainDice('CRUISER', [6, 1])
})
```

For unit ability dice (bombardment/space cannon/AFB), advance to the right point and check dicePool:

```typescript
// Bombardment dice
t.advanceTo('SPACE_CANNON_DEFENSE') // stops before SCD (after bombardment and commit)
const pool = t.dicePool()
expect(pool.attacker).toContainDice('DREADNOUGHT', [5, 1])

// Space cannon offense dice
t.advanceTo('AFB') // stops after SCO processed
const pool = t.dicePool()
expect(pool.defender).toContainDice('PDS', [6, 1])
```

### 2. Sustain Damage / Hit Absorption

Advance to combat, run a round with hits, check `isDamaged` and unit survival.

```typescript
it('absorbs a hit via sustain', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: { faction: 'ARBOREC', units: { CRUISER: 2 } },
    defender: { faction: 'ARBOREC', units: { DREADNOUGHT: 1 } },
  })

  t.advanceTo('SPACE_COMBAT')
  t.advanceRound({ defender: 1 })

  expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)
  expect(t.defender.units.DREADNOUGHT).toHaveLength(1)
})
```

### 3. Unit Destruction (START_OF_COMBAT abilities)

Advance past the ability timing and verify unit counts.

```typescript
it('destroys a unit at start of combat', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'ARBOREC',
      units: { CRUISER: 3 },
      abilities: { ASSAULT_CANNON: true },
    },
    defender: { faction: 'ARBOREC', units: { CRUISER: 3 } },
  })

  // Stop before AFB — START_OF_COMBAT abilities (Assault Cannon) have already fired
  t.advanceTo('AFB')

  expect(t.attacker.units.CRUISER).toHaveLength(3)
  expect(t.defender.units.CRUISER).toHaveLength(2)
})
```

### 4. Ability Disabling (losing unit abilities)

Advance through combat and verify that the disabled ability doesn't trigger.

```typescript
it('disables opponent sustain', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'MENTAK_COALITION',
      units: { FLAGSHIP: 1, CRUISER: 1 },
    },
    defender: {
      faction: 'ARBOREC',
      units: { DREADNOUGHT: 1, FIGHTER: 1 },
    },
  })

  t.advanceTo('SPACE_COMBAT')
  t.advanceRound({ defender: 1 })

  // Dreadnought can't sustain (disabled by Mentak flagship)
  expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()
})
```

### 5. Ability Completely Disabling a Phase

Advance past the phase and check the logged dice pool.

```typescript
it('disables space cannon entirely', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'ARBOREC',
      units: { CRUISER: 2 },
      abilities: { SOLAR_FLARE: true },
    },
    defender: { faction: 'ARBOREC', units: { PDS: 1, CRUISER: 1 } },
  })

  t.advanceTo('AFB') // past SCO
  const pool = t.dicePool()

  // PDS absent from defender dice pool
  expect(pool.defender.PDS).toBeUndefined()
})
```

### 6. Subtypes (Cavalry-style abilities)

Advance through combat and verify via abilityLog and dice pool.

```typescript
it('creates subtype and modifies dice', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'BARONY_OF_LETNEV',
      units: { CRUISER: 2 },
      abilities: { CAVALRY: { isEnabled: true, unitType: 'CRUISER' } },
    },
    defender: { faction: 'ARBOREC', units: { CRUISER: 1 } },
  })

  t.advanceTo('SPACE_COMBAT')
  t.advanceRound()

  // Verify ability fired
  expect(t.abilityLog('CAVALRY')).not.toHaveLength(0)

  // Check dice pool from log
  const pool = t.dicePool()
  // Cavalry Cruiser gets Nomad flagship stats: [7, 2]
  expect(pool.attacker).toContainDice('CRUISER', [7, 2])
})
```

### 7. Hit Reduction (cancel hits)

Use `advanceRound` with hits and verify ability fired + unit survival.

```typescript
it('cancels hits', () => {
  const t = combatTest({
    mode: 'SPACE',
    attacker: {
      faction: 'ARBOREC',
      units: { CRUISER: 3 },
      abilities: { SHIELDS_HOLDING: { uses: 1 } },
    },
    defender: { faction: 'ARBOREC', units: { CRUISER: 2 } },
  })

  t.advanceTo('SPACE_COMBAT')
  // 3 hits received, Shields Holding cancels 2 → 1 effective hit
  t.advanceRound({ attacker: 3 })

  expect(t.abilityLog('SHIELDS_HOLDING')).not.toHaveLength(0)
  expect(t.attacker.units.CRUISER).toHaveLength(2)
})
```

### 8. END_OF_COMBAT_ROUND Tests

Use `advanceRound` which processes through END.

```typescript
it('adds infantry at end of round', () => {
  const t = combatTest({
    mode: 'GROUND',
    attacker: {
      faction: 'YIN_BROTHERHOOD',
      units: { MECH: 1 },
    },
    defender: { faction: 'ARBOREC', units: { INFANTRY: 1 } },
  })

  t.advanceTo('GROUND_COMBAT')
  t.advanceRound()

  // Ability fires at END_OF_COMBAT_ROUND
  expect(t.attacker.units.INFANTRY).toHaveLength(2)
})
```

### 9. Multi-Round Tests

Call `advanceRound` multiple times.

```typescript
t.advanceTo('SPACE_COMBAT')
t.advanceRound({ defender: 1 }) // round 1
t.advanceRound({ defender: 1 }) // round 2
```

## Common Assertions

```typescript
// Unit count
expect(t.attacker.units.CRUISER).toHaveLength(3)

// Unit destroyed (type gone)
expect(t.defender.units.FIGHTER).toBeUndefined()

// Unit damaged (sustain used)
expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBe(true)

// Unit NOT damaged (sustain didn't fire)
expect(t.defender.units.DREADNOUGHT![0].isDamaged).toBeFalsy()

// Dice value check
const pool = t.dicePool()
expect(pool.attacker).toContainDice('CRUISER', [7, 1])

// No dice for a unit type
expect(pool.defender.PDS).toBeUndefined()

// Ability fired (don't assert exact count)
expect(t.abilityLog('MY_ABILITY')).not.toHaveLength(0)

// Ability did not fire
expect(t.abilityLog('MY_ABILITY')).toHaveLength(0)

// Ability uses remaining
expect(t.state.attacker.abilities.ABILITY_KEY.uses).toBe(1)
```

## Faction-Ability Correctness

Never put a faction-specific ability on a side that uses a different faction. Each side's `faction` must own every faction-specific ability in its `abilities` block. Check `docs/abilities-list.md` for ownership. Exceptions (valid on any faction's side):

- **Non-faction technologies** (e.g. PLASMA_SCORING, GRAVITON_LASER_SYSTEM, DURANIUM_ARMOR, etc.) — faction technologies (e.g. NON_EUCLIDEAN_SHIELDING, SUPERCHARGE) belong to their faction only
- **Promissory notes** (e.g. TEKKLAR_LEGION, CAVALRY) — check `docs/abilities-list.md` for the full list
- **Agents** (e.g. VISCOUNT_UNLENN, BROTHER_MILOR) — check `docs/abilities-list.md` for the full list
- **Commanders** (e.g. TRRAKAN_AUN_ZULOK, AROZ_HOLLOW) — check `docs/abilities-list.md` for the full list
- **Environment abilities** (e.g. QUIETUS, GEOFORM) — check `docs/abilities-list.md` for the full list
- **NEKRO_VIRUS** can have other factions' technologies and flagship abilities
  - When testing Nekro with another faction's **flagship** ability, include `ASSIMILATOR_Z` in the test filename (the Nekro flagship that enables copying). E.g. `assimilator-z+technological-singularity+fourth-moon.test.ts`

## Interaction Tests: What NOT to Test

Not every pair of abilities needs an interaction test. Only write combination tests when abilities genuinely interact — when one modifies state the other reads, or when timing/ordering between them matters. **Do not** write tests for combinations that operate independently.

### Independent modifier stacking

If two abilities both apply hit value modifiers or both add extra dice, they stack mechanically with no special interaction. Individual ability tests already verify each modifier works. No need to test any of these combinations:

- **Hit value + hit value:** Two abilities that each apply a flat modifier to combat rolls.
- **Die count + die count:** Two abilities that each add extra dice to the same or different rolls.
- **Hit value + die count:** One modifies hit values, the other adds dice — they affect orthogonal dimensions of the same roll.

### Redundant blocking

If two abilities both block the same mechanic (e.g. both block Space Cannon, or both block Bombardment), testing them together just verifies redundant stacking.

### Blocker negates modifier

If one ability completely blocks a mechanic (e.g. blocks all Space Cannon) and the other modifies that mechanic's rolls (e.g. applies -1 to Space Cannon rolls), the modifier is irrelevant when the mechanic is blocked. There is no interaction to test.

### Blocker removes precondition

If ability A blocks a mechanic (e.g. blocks Sustain Damage) and ability B depends on that mechanic's output (e.g. repairs units that sustained damage), then B simply has nothing to act on. The test just verifies trivially expected "nothing happens" behavior.

### Config ability vs unit-ability blocker

Config abilities are never blocked by abilities that disable unit abilities. Testing "config ability still fires when blocker is active" is not a meaningful interaction — it's just how the system works.

### Abilities in non-overlapping contexts

If ability A only fires in space combat and ability B only fires in ground combat, they can never interact.

### Independent phase abilities with no shared state

If ability A fires at one phase and ability B fires at a different phase, and neither modifies state the other reads, they are independent. This includes hit value modifiers on one side combined with unit-stealing or phase-specific abilities on the other side that operate on a different dimension of combat.

### When TO write interaction tests

Write a combination test when:

- **One enables/disables the other:** e.g. an ability strips Planetary Shield → another ability that requires PS doesn't fire; an ability blocks sustain → Direct Hit never triggers
- **One modifies state the other reads:** e.g. an ability places ships → another counts ship types for a bonus; an ability copies destroyed ships → another's bonus changes next round
- **Timing/ordering matters:** e.g. an ability steals a unit at START_OF_COMBAT → another can't deploy at START_OF_COMBAT_ROUND because the target is gone
- **One creates units the other destroys/targets:** e.g. an ability places ships mid-combat → another ability destroys all ships; an ability places infantry → another targets it with an extra die
- **Shared resource contention:** Both abilities want to modify the same unit at the same phase
- **Sustain-related chains:** Abilities that fire on sustain use (Direct Hit, Reflective Shielding), modify sustain behavior (Non-Euclidean Shielding cancels extra hits), or repair after sustain (Duranium Armor, Dynamo) — these form genuine causal chains where one ability's outcome feeds into another

## What NOT to Write as Standalone Tests

Don't test framework-level behaviors that apply to all abilities uniformly:

- **"Does not fire when not enabled"** — Every ability checks `isEnabled`/`uses` via the framework.
- **"Only fires once (uses: 1)"** — Uses decrement is handled by the framework, not individual abilities.
- **"Does not affect ground/space combat"** — The `context` field already restricts this at the engine level.

## Verify Assumptions Before Asserting Behavior

When a test relies on a unit dying to trigger an ability (Sleeper Cell, Technological Singularity, Vos Hollow, Direct Hit, etc.), **always add an explicit check that the unit actually died** before asserting the ability behavior. This catches cases where the test setup doesn't produce the expected destruction.

```typescript
// BAD: assumes cruiser died, only checks ability log
t.advanceRound({ attacker: 1 })
expect(t.abilityLog('VOS_HOLLOW')).not.toHaveLength(0)

// GOOD: verify death first, then check ability
t.advanceRound({ attacker: 1 })
expect(t.attacker.units.CRUISER).toHaveLength(2) // 3 → 2
expect(t.abilityLog('VOS_HOLLOW')).not.toHaveLength(0)
```

Same applies to multi-round tests where a unit sustains in round 1 and dies in round 2:

```typescript
t.advanceRound({ attacker: 1 }) // round 1: flagship sustains
expect(t.attacker.units.FLAGSHIP![0].isDamaged).toBe(true)

t.advanceRound({ attacker: 1 }) // round 2: flagship destroyed
expect(t.attacker.units.FLAGSHIP).toBeUndefined()
expect(t.abilityLog('VAN_HAUGE')).not.toHaveLength(0)
```

## Tips

- Use `ARBOREC` as the default "vanilla" faction when you need a side with no special abilities
- `advanceTo()` picks 0-hit outcomes by default, making it deterministic for testing setup abilities
- `advanceTo()` stops **before** the target phase executes
- `advanceRound()` processes from the current position through the END of the combat round
- `dicePool()` returns the **last** logged DICE_POOL entry — be aware that later phases may overwrite earlier ones
- `{ attacker: N }` means attacker **receives** N hits — ensure the defender has enough dice-producing units to generate N hits
- Comment dice calculations inline: `// Cruiser: 7 - 1(ability) = 6`
- Test both positive cases (ability works) and edge cases (ability doesn't trigger when conditions aren't met)
- For abilities with `uses` parameter, test both when uses > 0 and when uses === 0
- Don't assert exact `abilityLog` length — the number of log entries per ability call is an implementation detail. Use `.not.toHaveLength(0)` to verify it fired and `.toHaveLength(0)` to verify it didn't
- Prefer `describe.forEachSide` for new symmetric ability tests — it catches side-specific bugs automatically
