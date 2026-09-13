# Ability Development Guide

## File Structure

Data is split by game system: `src/data/main/` (Twilight Imperium 4) and `src/data/tf/` (Twilight's Fall). Each `index.ts` default-exports a complete `GameData` entry point: system metadata, factions, base units, registered and lookup ability pools, slot presentation, and faction/ability lookup methods. Code outside `src/data` reads it through `getGameData(system)` (`src/utils/get-game-data.ts`) and never imports system data files directly. System-specific availability policy is declared when the entry calls `createGameData`. Shared TI4 abilities are organized in `src/data/main/abilities/` by category:

```
src/data/main/abilities/
  general/          — core/unit abilities (SETTINGS, UNIT_PRIORITY, PRE_DAMAGED, PRE_GALVANIZED, SUSTAIN_DAMAGE, PLANETARY_SHIELD, DISABLE_PLANETARY_SHIELD)
  advanced/         — phase/system abilities (ANTI_FIGHTER_BARRAGE, BOMBARDMENT, SPACE_CANNON_OFFENSE/DEFENSE, RETREAT, ABILITY_ORDER, CAPACITY, FLEET_POOL)
  technology/       — tech cards (ASSAULT_CANNON, PLASMA_SCORING, ...)
  action-card/      — action cards (BUNKER, MORALE_BOOST, SOLAR_FLARE, ...)
  environment/      — environment effects (NEBULA, ENTROPIC_SCAR)
  agenda/           — agenda cards (CONVENTIONS_OF_WAR, PROPHECY_OF_IXTH, ...)
  relic/            — relics (LIGHTRAIL_ORDNANCE, METALI_VOID_ARMAMENTS, ...)
```

Faction abilities live in `src/data/main/faction/[faction_name]/` (TI4) or `src/data/tf/faction/[faction_name]/` (Twilight's Fall) alongside the faction definition. Twilight's Fall shared decks live in `src/data/tf/abilities/` (`ability/`, `genome/`, `paradigm/`, `action-card/`, `unit-upgrade/`); each deck folder has an `index.ts` listing its cards in display order, and `src/data/tf/index.ts` tags each deck with its slot. A TF card that reuses a TI4 implementation is still its own file: it imports the TI4 ability, clones it with `cloneAbility(ability, overrides)` from `src/data/tf/clone-ability.ts`, and exports the result. Always pass a `TF_`-prefixed `key` of the card's own (`TF_ALTRUISTIC_GENOME`), plus only the fields that differ from the source (TF name, description, or the originating faction icon when the source has none). The clone copies the invoke entries, points a self-excluding `excludeSubtypeSource` filter at the new key, and makes the card an opt-in toggle.

Each ability is one file (kebab-case matching the key). File exports a single `Ability` object.

## Ability Interface

```typescript
interface Ability<Params extends Record<string, unknown>> {
  key: string // Unique identifier, SCREAMING_SNAKE_CASE
  name: string // Display name for UI
  description?: string // Tooltip text describing what the ability does
  warning?: string // Optional warning paragraph appended to the tooltip
  icon?: string // Raw SVG string for display next to name
  params: AbilityBaseParams & Params // Default parameter values (includes isEnabled and uses from AbilityBaseParams)
  paramsSchema?: {
    safeParse: (data: unknown) => { success: boolean; data?: unknown }
  } // Zod schema for param validation
  headerUI?: 'isEnabled' | 'uses' | (string & keyof Params) // Param key shown in ability header
  readOnly?: boolean // Lock UI (user cannot toggle)
  uiConfig?: UIConfig<AbilityBaseParams & Params> // Controls for params in UI
  side?: CombatSide // Restrict to attacker or defender
  context?: CombatMode // Restrict to SPACE or GROUND combat
  sync?: boolean // Both sides share identical config
  exclusiveGroup?: string // Mutually exclusive abilities sharing same group
  onParamSet?: (params, key, value) => params | void // Callback for param changes
  declareParamChange?: (params, settings: SettingsParams) => ParamChange[]
  declareSubtype?: (params) => DeclaredSubtype[] // Declare variant subtypes (e.g. Cavalry)
  sort?: (params, ctx, unitIds) => UnitId[] // Pre-sort this ability's unit invokes
  preventDestroy?: (params, ids, api) => UnitId[] // Spare units from opponent direct destroys
  invoke: AbilityInvoke<Params>[] // Array of timing handlers
}
```

There is **no `category`/`subcategory` field**. An ability's category is derived from the registration slot it occupies (which `index.ts` array or faction slot it is added to), surfaced via that game system's `SLOT_DISPLAY` — abilities never declare it. Each system owns its `AbilitySlot`, `FactionKey`, `FACTION_KEY_TO_SLOT`, `unitSlot`, `SLOT_DISPLAY`, and `SLOT_ORDER` declarations in `src/data/<system>`; the engine treats faction and slot names as opaque strings. The shared `FactionAbilities` runtime shape is `Record<string, Ability[]>`; every key must exist in the selected system's mapping or data resolution/collection throws (for example, Twilight's Fall has no breakthrough slot).

**`params`** — includes `AbilityBaseParams` (`isEnabled: boolean`, `uses: number`) merged with custom `Params`. Example: `params: { isEnabled: false, uses: Infinity, strategy: 'BEST' }`.

**`headerUI`** — renders a control in the ability header row. Boolean params show a checkbox, number params show a numeric input. Most abilities use `headerUI: 'isEnabled'` or `headerUI: 'uses'`.

**`readOnly: true`** — ability appears in UI but cannot be toggled off. Used for always-on faction abilities (e.g., Fragile, Unrelenting).

**`context`** — restricts the ability to a specific combat mode. When set, the ability is skipped during combat if the mode doesn't match, and dimmed (opacity 0.5) in the UI. The ability remains fully interactive when dimmed.

```typescript
context: 'SPACE' // Only fires during space combat
context: 'GROUND' // Only fires during ground combat
// omit for abilities that work in both modes
```

Note: This is the **ability-level** `context` (combat mode). Don't confuse with the **invoke-level** `context` (meta-phase), which restricts individual invokes to specific phases like `'AFB'` or `'BOMBARDMENT'`.

**`side`** — restricts which side can use the ability:

```typescript
side: 'attacker' // Only available to the attacker
side: 'defender' // Only available to the defender
```

**`sync: true`** — both sides share identical config. When the user changes params on one side, the other side is automatically updated to match. Useful for environment effects and other abilities where both players share the same setting.

**`exclusiveGroup`** — abilities sharing the same group are mutually exclusive — enabling one disables others in the group.

**`preventDestroy`** — destroy-prevention hook (e.g. Divinity). When an OPPOSING ability directly destroys units on this ability's side via `destroyUnits` (Spark, Lash, roll triggers, …), enabled abilities carrying this hook are consulted before removal. Receives the ability's live params, the about-to-be-destroyed `UnitId[]`, and this side's `SideApi`; returns the ids to spare. The engine caps the spared count at the ability's remaining `uses` and consumes one use per spared unit. NOT consulted for destroys inflicted by the ability's own side (self-sacrifice costs like Devotion or Exotrireme's self-destruct) nor for hit-pool destruction — model hit-based saves with a `BEFORE_ASSIGN_HITS` invoke instead.

## Parameters

Define a `Params` type, provide `params` (which includes `AbilityBaseParams`).

Common patterns:

```typescript
// Toggle ability
type Params = { isEnabled: boolean }
params: {
  isEnabled: false,
  uses: Infinity,
}
headerUI: 'isEnabled'

// Uses counter (e.g., action cards x4)
type Params = { uses: number }
params: {
  isEnabled: true,
  uses: 0,
}
headerUI: 'uses'

// Custom params with priority list
type Params = {
  isEnabled: boolean
  targetPriority: UnitType[]
}
```

In tests, `ABILITY_KEY: true` is shorthand for `{ isEnabled: true }`.

## Invoke

The `invoke` array defines when and how the ability fires. Each entry targets one timing:

```typescript
invoke: [
  {
    timing: AbilityTiming,         // When to fire
    context?: MetaPhase | MetaPhase[],  // Restrict to specific meta-phases
    side?: 'OWN' | 'OPPONENT',    // Filter by trigger side (see Trigger System)
    isCallable?: (...) => boolean, // Guard (optional, default: always callable)
    call: (...) => void,           // Execution
  }
]
```

**`side: 'OWN' | 'OPPONENT'`** — filters the invoke by which side caused the trigger. Only meaningful for triggered timings (e.g., `AFTER_SUSTAIN_DAMAGE_USE`). `'OWN'` means the invoke fires only for the side that triggered the event. `'OPPONENT'` means it fires only for the other side. Omit for no filtering (fires for both sides).

**`context`** — restricts invoke to specific meta-phases. Only fires when `state.currentPhase.meta` matches:

```typescript
context: 'AFB' // Only during AFB phase
context: ['BOMBARDMENT', 'SPACE_CANNON_OFFENSE'] // During either phase
```

### Factory form

`invoke` may be a function of the ability's merged params and a lookup context. The engine calls it when it builds a side's invoke index and again after any param of the ability changes, so a selector ability registers only what it selected:

```typescript
invoke: (params, ctx) => {
  const agent = ctx.abilities.own
    .get('AGENT')
    .find(a => a.key === params.agentKey)
  return agent ? resolveInvokes(agent, params, ctx).map(wrap) : []
}
```

Factories must be pure and cheap. Only config abilities may use this form; unit-attached abilities keep the array (see engine-gotchas). Use `resolveInvokes(ability, params, ctx)` from `@/combat` to read another ability's list, and `hasStaticInvokes(ability)` when you need the array itself.

## Timing System

Timings define when abilities fire. They run in this order during combat:

```
PREPARE               — once at combat construction
COMMIT_UNITS          — during COMMIT_UNITS phase (ground combat unit commitment)
START_OF_COMBAT       — before first round
START_OF_COMBAT_ROUND — before each round (including first)
BEFORE_UNIT_ABILITY_ROLL — before AFB / bombardment / space cannon dice
AFTER_UNIT_ABILITY_ROLL  — after unit ability dice are rolled (hits assigned to opponent)
BEFORE_DICE_ROLL      — before combat dice
AFTER_DICE_ROLL       — after combat dice are rolled (hits pending, before assignment)
BEFORE_ASSIGN_HITS    — before hit assignment (sustain damage fires here)
AFTER_ASSIGN_HITS_STEP — after hits are assigned and destroyed units processed
WHEN_SUSTAIN_DAMAGE_USE  — triggered immediately when a sustain damage use occurs (before AFTER)
AFTER_SUSTAIN_DAMAGE_USE — triggered immediately after a sustain damage use
WHEN_GALVANIZE        — triggered immediately after a unit becomes galvanized (Last Bastion)
DESTROY               — when units are destroyed (internal destroy processing)
WHEN_DESTROY          — when units are destroyed (before AFTER_DESTROY, fires from destroyed unit's ABILITIES)
AFTER_DESTROY         — after units are destroyed
END_OF_COMBAT_ROUND   — after each round
AFTER_COMBAT_ROUND    — after END_OF_COMBAT_ROUND, before CLEANUP_ROUND
END_OF_COMBAT         — when combat ends
CLEANUP_ROUND         — after AFTER_COMBAT_ROUND, resets per-round state (e.g. usedSustainThisRound)
CLEANUP               — once after combat ends, after END_OF_COMBAT (pair with PREPARE for combat-level teardown)
```

Triggered timings such as `WHEN_SUSTAIN_DAMAGE_USE`, `AFTER_SUSTAIN_DAMAGE_USE`, `WHEN_GALVANIZE`, and `WHEN_INDOCTRINATION` are not in the core `TimingContextMap` — they are added by individual ability files via `declare global` interface merging (see `general/pre-galvanized.ts`, `yin_brotherhood/indoctrination.ts`).

### Function Signatures by Timing

The `call`/`isCallable` signature is derived from the timing's entry in `TimingContextMap`. A timing maps to either `void` (no context arg) or a context type passed as the third argument.

**Void timings** (`void` in `TimingContextMap` — PREPARE, COMMIT_UNITS, START_OF_COMBAT, START_OF_COMBAT_ROUND, BEFORE_DICE_ROLL, BEFORE_UNIT_ABILITY_ROLL, AFTER_UNIT_ABILITY_ROLL, AFTER_DICE_ROLL, BEFORE_ASSIGN_HITS, AFTER_ASSIGN_HITS_STEP, END_OF_COMBAT_ROUND, AFTER_COMBAT_ROUND, END_OF_COMBAT, CLEANUP_ROUND, CLEANUP, and all the `*_STEP` timings):

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext) => boolean
call: (ctx: AbilityCallContext, params: Params) => void
```

There is **no separate "dice" context argument**. Dice modifiers are applied during `BEFORE_DICE_ROLL` / `BEFORE_UNIT_ABILITY_ROLL` by calling methods directly on `ctx.api.own` / `ctx.api.opponent` (e.g. `addDiceCount`, `addDiceGroup`, `applyBonusToResult`).

**Destroy timings** (DESTROY, WHEN_DESTROY, AFTER_DESTROY) — context is `UnitId[]` (the destroyed unit ids):

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext, ids: UnitId[]) => boolean
call: (ctx: AbilityCallContext, params: Params, ids: UnitId[]) => void
```

**UnitId timings** (file-declared: WHEN_SUSTAIN_DAMAGE_USE, AFTER_SUSTAIN_DAMAGE_USE, WHEN_INDOCTRINATION, WHEN_GALVANIZE) — context is a single `UnitId`:

```typescript
isCallable?: (params: Params, ctx: AbilityReadContext, unitId: UnitId) => boolean
call: (ctx: AbilityCallContext, params: Params, unitId: UnitId) => void
```

## Context Objects

### AbilityReadContext (in `isCallable`)

Read-only. Cannot modify state.

```typescript
interface AbilityReadContext {
  readonly state: Readonly<CombatStateData>
  readonly api: { readonly own: SideApi; readonly opponent: SideApi }
  readonly utils: AbilityUtils // Helpers (getFlat, etc.)
  readonly meta: MetaPhase // Innermost active meta-phase
  readonly side: CombatSide // Absolute side this ability runs on
  readonly abilities: OwnOpponentContext<RuntimeAbilityList> // All registered abilities per side
  readonly this: Ability // The currently-running ability (use ctx.this.key, not literals)
  readonly unitSource: UnitId | undefined // UnitId the ability is attached to, if any
  getUnit(): UnitId // Only for unit abilities — throws otherwise
  isOwner(): boolean // True if current side's faction owns this ability
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
}
```

`AbilityReadContext` also exposes `getPostRollSides()` and several `currentDiceRoll*` accessors valid only inside a dice-roll group (see `docs/dice-math.md`).

### AbilityCallContext (in `call`)

Mutable. State is an Immer draft.

```typescript
interface AbilityCallContext {
  state: CombatStateData // Immer draft
  api: { own: SideApi; opponent: SideApi } // Full read-write API
  readonly utils: AbilityUtils
  readonly meta: MetaPhase
  readonly side: CombatSide
  readonly abilities: OwnOpponentContext<RuntimeAbilityList>
  readonly this: Ability
  readonly unitSource: UnitId | undefined
  logger?: Logger // Append to ability log via logger?.log(...)
  trigger<K extends AbilityTiming>(name: K, context: TimingContextMap[K]): void // Emit trigger event
  getUnit(): UnitId // Only for unit abilities — throws otherwise
  isOwner(): boolean
  getAbilitiesForTiming(
    timing: AbilityTiming | AbilityTiming[],
  ): { key: string; name: string }[]
}
```

`own` / `opponent` are relative to the ability's side, not attacker/defender. The call context additionally exposes dice-roll declaration helpers (`declareReroll`, `declareHitPoolTransform`), `transitionTo`, `rollDice`, and `resolveStep`. Its `firing` override likewise accepts ability-relative `OWN` / `OPPONENT` values and maps them to combat sides internally — see `docs/dice-math.md` and the type definitions in `abilities-engine/types.ts`.

### AbilityLookupContext (declare hooks, invoke factories)

`onParamSet`, `declareParamChange`, `declareSubtype`, and factory `invoke` receive a trailing `ctx: AbilityLookupContext`:

```typescript
interface AbilityLookupContext {
  readonly abilities: OwnOpponentContext<RuntimeAbilityList> // own / opponent
  readonly this: Ability // the ability being evaluated
}
interface RuntimeAbilityList {
  readonly all: readonly Ability[]
  get(slot: string): readonly Ability[] // registration order, cached
}
```

`AbilityReadContext` and `AbilityCallContext` carry the same members, so `uiConfig` and invokes use `ctx.abilities.own.get('AGENT')` directly (Ssruu, Nomad's Temporal Command Suite, TF Clever Genome).

### `getUnit()`

Available on both `AbilityReadContext` and `AbilityCallContext`. Returns the `UnitId` this ability is attached to. Only valid for unit abilities (abilities defined in a unit's `ABILITIES` array). Throws an error if called from a config ability.

```typescript
// Unit ability example — modify own unit state
call: ctx => {
  const unitId = ctx.getUnit()
  ctx.api.own.modifyUnitState(unitId, { isDamaged: true })
}
```

## SideApi

Used in both `isCallable` and `call` contexts. The same `SideApi` class is used for both read and write — write methods are only available during `call` (Immer draft context).

### Read Methods

`GetUnitsOptions` is `{ includeVariants: boolean }` and is **required** wherever it appears.

```typescript
getFaction(): string
getCombatMode(): CombatMode  // for hooks that receive only a SideApi (e.g. preventDestroy)
getUnits(unitType: UnitType, options: GetUnitsOptions): UnitId[]
hasUnit(unitId: UnitId): boolean
hasUnitType(unitType: UnitType, options: GetUnitsOptions): boolean
countUnits(filter: UnitType | UnitType[] | undefined, options: GetUnitsOptions): number
getPendingHits(filter?: { base?: true; bonus?: true }): number
getHitPoolValidTargets(): UnitType[]
getActiveBaseTypes(): UnitBaseType[]
getParticipatingUnitTypes(options?: { combatMode?: CombatMode }): UnitType[]
getUnitVariantsOptions(filter?: ParamFilter): { label: string, value: string }[]
getUnitVariantsOptions(paramKey: string): { label: string, value: string }[]   // reads filter/limit from the declareParam
findUnitByPriority(priority: UnitType[]): UnitId | undefined
getUnitStats(unitTypeOrId: string | UnitId): UnitStats
getUnitVariantKey(unitId: UnitId): string | undefined
getUnitState(unitId: UnitId): UnitState
getUnitBaseType(unitId: UnitId): UnitBaseType
getAbilityConfig(key: string): Record<string, unknown>
isUnitAbilityLost(ability: UnitAbility, unitType: UnitType): boolean
isUnitAbilityCannotBeUsed(ability: UnitAbility, unitType: UnitType): boolean
```

### Write Methods (available in `call` only)

#### Unit Operations

```typescript
destroyUnits(target: UnitBaseType | UnitId | UnitId[]): void  // Destroy by type (first found), UnitId, or UnitId[]; array variant fires destroy abilities once
removeUnits(target: UnitBaseType | UnitId | UnitId[]): void   // Remove without triggering destroy abilities
placeUnits(unitsToAdd: Partial<Record<UnitType, number>>): Record<UnitType, UnitId[]>  // Returns the placed UnitIds (keyed by variant key)
modifyUnitType(key: UnitType, updates: Partial<UnitStats>): void   // Modify stats for all units of a type
modifyUnitState(unitId: UnitId, updates: Partial<UnitState>): void // Modify per-unit mutable state
```

#### Hit Operations

```typescript
reduceHits(amount: number): void
addHits(hits: number): void                       // Unrestricted hits on the landing side
addHits(hits: number, validTargets: UnitType[]): void  // Restricted; throws if the landing side's hitPool is non-empty

// Apply a flat +/- to each combat roll result for this dice-roll group.
// target omitted = all of this side's dice; { singleUnit } = one unit type;
// { exclude } = all but the listed base types.
applyBonusToResult(
  amount: number,
  target?: UnitType | { exclude: UnitBaseType[] } | { singleUnit: UnitType },
): void
```

#### Unit Ability Restrictions

Two-layer system — **lost** (ability removed) vs **cannotBeUsed** (ability present but blocked):

```typescript
// Disable ability for all units, specific type, or category
setUnitAbilityLost(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory): void
removeUnitAbilityLost(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory): void
setUnitAbilityCannotBeUsed(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory): void
removeUnitAbilityCannotBeUsed(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory): void

// Carve one unit type back OUT of every restriction (both layers) coming from `reason`
setUnitAbilityRestrictionImmunity(reason: string, unitType: UnitBaseType): void
removeUnitAbilityRestrictionImmunity(reason: string, unitType: UnitBaseType): void
```

`reason` is the ability key that caused the restriction. Used to cleanly remove restrictions without affecting other abilities' restrictions.

`target` can be a specific `UnitBaseType` (e.g., `'MECH'`) or a `UnitCategory` (`'SHIPS'`, `'NON_FIGHTER_SHIPS'`, `'GROUND_FORCES'`, `'STRUCTURES'`). Categories are resolved at check time, so changes to category membership are automatically reflected.

**Immunity** is the inverse of a restriction: `setUnitAbilityRestrictionImmunity('ENTROPIC_SCAR', 'FLAGSHIP')` makes flagships ignore every restriction that scar added, blanket ones included. It resolves lazily alongside the restrictions themselves, so it can be declared before or after the restricting ability's PREPARE (see the Il Na Viroset flagship, `il_na_viroset/enigma.ts`).

**lost vs cannotBeUsed**: "lost" means the ability is gone (e.g., Publicize Weapon Schematics removes War Sun sustain). "cannotBeUsed" means it's still there but blocked (e.g., Fourth Moon prevents sustain from firing). Both are checked by Sustain Damage before firing.

#### Subtype Operations

```typescript
addSubtype(unitId: UnitId, subtype: UnitVariantId): UnitType | undefined  // Returns the new variant key
removeSubtype(unitId: UnitId, subtype: UnitVariantId): void
```

Both take a `UnitId` (not a variant key). There is no `statsFactory` argument — subtype stats come from the ability's `declareSubtype` (`DeclaredSubtype.statsFactory`), which is invoked once at config time and pre-populates `s.unitStats[variantKey]`.

#### Ability Config Mutations

```typescript
// Update own ability's params (key inferred from current ability)
updateAbilityConfig(updates: Record<string, unknown>): void

// Update another ability's params by key
updateAbilityConfig(key: string, updates: Record<string, unknown>): void
```

## Dice Modifiers

There is no separate "DiceApi" object. Dice are modified during `BEFORE_DICE_ROLL` / `BEFORE_UNIT_ABILITY_ROLL` by calling these methods directly on `ctx.api.own` / `ctx.api.opponent`. Each call queues a modifier that the dice-math kernel applies (see `docs/dice-math.md`).

```typescript
addDiceCount(count, target?: 'BEST' | 'WORST', unitTypes?): void  // Add dice to best/worst (lowest/highest hit value) source, optionally restricted to `unitTypes` (base types; empty list = no-op). The dice land ON the chosen unit's entry, so per-unit effects (Crown of Thalnos' safe reroll) see them
setDiceCount(count: number, unitType: UnitType): void             // Set per-unit dice count for a unit type
addDiceGroup(diceGroup: DiceGroup): void                          // Add a new dice group keyed under the current ability
```

`DiceGroup` is `[hitValue, baseDice]` or `[hitValue, baseDice, bonusDice]` (`src/types/die.ts`). Hit value is the threshold — a die must roll ≥ hitValue to hit. Total dice per unit = `baseDice + bonusDice`.

The call context also offers richer declarations for conditional/reroll/trigger effects — `applyConditionalBonusToResult`, `declareReroll`, `declareRollTrigger`, `declareCustomRoll` — documented in `docs/dice-math.md`.

## Registration

### Category Abilities (technology, action-card, etc.)

1. Create ability file in `src/data/main/abilities/[category]/`
2. Export ability object
3. Add import + array entry in `src/data/main/abilities/[category]/index.ts`

Example — adding to technology:

```typescript
// src/data/main/abilities/technology/my-tech.ts
import { type Ability } from '@/combat'

type Params = { isEnabled: boolean }

export const myTech: Ability<Params> = {
  key: 'MY_TECH',
  name: 'My Tech',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  invoke: [
    /* ... */
  ],
}
```

```typescript
// src/data/main/abilities/technology/index.ts
import { myTech } from './my-tech'
export default [/* ...existing */ myTech]
```

### Faction Abilities

Faction abilities are registered in the faction's `index.ts`:

```typescript
// src/data/main/faction/my_faction/index.ts
import type { Faction } from '@/types'
import { myAbility } from './my-ability'

export const my_faction: Faction = {
  name: 'My Faction',
  abilities: {
    faction: [myAbility], // Only available to this faction
    technology: [factionTech], // Faction-specific technology
    unit: [unitAbility], // Unit-attached abilities
    promissory: [promNote], // Available to all factions
    agent: [agentAbility], // Available to all factions
    commander: [commanderAbility], // Available to all factions
    hero: [heroAbility], // Available to all factions
    breakthrough: [breakthrough], // Breakthrough abilities
  },
  units: {
    /* ... */
  },
}
```

`faction` abilities only appear for that faction. `promissory`, `agent`, `commander`, `hero`, and `breakthrough` are collected across all factions and available to everyone.

### Twilight's Fall unit upgrades

Each card in `src/data/tf/abilities/unit-upgrade/` is a normal `Ability` object.
Declare its params, UI, exclusive group, and special invokes directly. Non-mech
cards use `exclusiveGroup: 'TF_UNIT_UPGRADE_<UNIT_TYPE>'`; mech cards omit it
so they stack.

For a fixed stat block, use `createStatsInvoke(unitType, stats)` from
`@/utils/create-stats-invoke`. It accepts native `UnitStats` and returns only a
`PREPARE` invoke with `system: true` (stat application never consumes active
uses, and still runs at zero uses):

```typescript
invoke: [
  createStatsInvoke('CARRIER', {
    COMBAT: [9, 1],
    CAPACITY: 8,
    UNIT_ABILITIES: { SUSTAIN_DAMAGE: true },
    ABILITIES: [sustainDamage],
  }),
]
```

The helper does not attach abilities implicitly: declare both the native unit
ability flag and its handler when needed. Relative stat changes (Echo of
Ascension, mech upgrades) use ordinary PREPARE handlers. If a card needs extra
PREPARE work, call its stats invoke inside that same handler and retain
`system: true`; do not add a second PREPARE (see Hel-Titan and the war suns).

Stats invokes expose their `unitType` and `stats`, narrowed by `isStatsInvoke`
from `@/utils/is-stats-invoke`. Janovet uses these to inherit printed upgrade
abilities without depending on factory metadata or runtime unit modifications.

### Lazy faction data

A faction module exports a `FactionDefinition`. Its `abilities` and any unit `ABILITIES` may be a function of the system's `GameData`, resolved once by `createGameData`:

```typescript
export const nekro_virus: FactionDefinition = {
  abilities: data => ({ technology: copyTechnologies(data.factions) }),
  units: { FLAGSHIP: { BASE: { ABILITIES: data => [...] } } },
}
```

This is the same `GameData` entity that the system exports. It exposes `id`, `baseUnits`, `factions`, and `getAbilities(slot)`. During lazy resolution, `factions` intentionally contains only static factions, so a lazy faction never sees another lazy faction. Use this instead of importing other faction modules.

### Unit Abilities

Abilities attached to specific units via `ABILITIES` array in unit stats. These fire from living units (or destroyed units for AFTER_DESTROY):

Use `ctx.this.key` for the restriction `reason` rather than hardcoding the ability key — it keeps the ability self-contained and rename-safe.

```typescript
// src/data/main/faction/mentak_coalition/fourth-moon.ts
export const fourthMoon: Ability = {
  key: 'FOURTH_MOON',
  name: 'Fourth Moon',
  description: "Other players' ships in this system cannot use Sustain Damage.",
  context: 'SPACE',
  params: { isEnabled: true, uses: Infinity },
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          ctx.this.key,
          'SHIPS',
        )
      },
    },
    {
      timing: 'DESTROY',
      isCallable: (_params, ctx, ids) => ids.includes(ctx.getUnit()),
      call: ctx => {
        ctx.api.opponent.removeUnitAbilityCannotBeUsed(
          'SUSTAIN_DAMAGE',
          ctx.this.key,
          'SHIPS',
        )
      },
    },
  ],
}

// In faction definition:
units: {
  FLAGSHIP: {
    BASE: {
      COMBAT: [7, 2],
      UNIT_ABILITIES: { SUSTAIN_DAMAGE: true },
      ABILITIES: [fourthMoon],  // Attached to the unit
    },
  },
}
```

## UI Configuration

`uiConfig` controls which params appear in the expandable ability panel:

```typescript
// Static
uiConfig: [
  { key: 'isEnabled', label: 'Enable', type: 'checkbox' },
  { key: 'uses', label: 'Uses', type: 'number', min: 0, max: 10 },
  { key: 'strategy', label: 'Strategy', type: 'select', items: [
    { label: 'Best', value: 'BEST' },
    { label: 'Worst', value: 'WORST' },
  ]},
  { key: 'targetPriority', label: 'Targets', type: 'unit-list', mode: 'order', items: [...] },
  { key: 'units', label: 'Units', type: 'unit-list', mode: 'checkbox', sortable: true, items: [...] },
]

// Dynamic (context-aware)
uiConfig: (ctx, params) => {
  return [
    {
      key: 'targetPriority',
      label: 'Target Priority',
      type: 'unit-list',
      mode: 'order',
      // Passing the param key reads the filter/limit from its declareParam:
      items: ctx.api.opponent.getUnitVariantsOptions('targetPriority'),
    },
  ]
}
```

There are exactly four UI config item types. The list variants are all expressed as `unit-list` with a `mode`:

| Type        | Param Type                | Use Case                                                      |
| ----------- | ------------------------- | ------------------------------------------------------------- |
| `checkbox`  | `boolean`                 | Toggle                                                        |
| `number`    | `number`                  | Counter with optional `min`/`max`                             |
| `select`    | `string`                  | Dropdown (`items: SelectItem[] \| SelectGroup[]`)             |
| `unit-list` | `UnitList<V>` (see below) | List of units; behavior set by `mode` (+ optional `sortable`) |

`unit-list` modes:

- `mode: 'order'` — reorderable priority list (param shape `[UnitType][]`)
- `mode: 'checkbox'` — multi-select (param shape `[UnitType, boolean][]`)
- `mode: 'number'` — per-item numeric values, items may carry a `max` (param shape `[UnitType, number][]`)

## Resolution Order

Abilities are resolved in alternating fashion — attacker goes first, then defender, then attacker, continuing until both sides skip consecutively. Each side resolves one ability per turn.

For a given timing, the tracker ensures:

- Config abilities fire at most once per timing phase
- Unit abilities fire once per unit instance

If an ability destroys units (and the timing is not AFTER_DESTROY), the system automatically runs `AFTER_DESTROY` for any destroyed units.

## Trigger System

Abilities can emit **trigger events** via `ctx.trigger()` during their `call`. Triggers are processed immediately after the ability's `produce()` completes, before `AFTER_DESTROY` checks.

Currently supported triggers:

| Trigger Name               | Emitted By     | Description                                           |
| -------------------------- | -------------- | ----------------------------------------------------- |
| `WHEN_SUSTAIN_DAMAGE_USE`  | Sustain Damage | Fires immediately when a unit sustains (before AFTER) |
| `AFTER_SUSTAIN_DAMAGE_USE` | Sustain Damage | Fires immediately after a unit sustains               |

### How Triggers Work

1. During `call`, the ability calls `ctx.trigger('WHEN_SUSTAIN_DAMAGE_USE', unitId)` then `ctx.trigger('AFTER_SUSTAIN_DAMAGE_USE', unitId)`
2. After `produce()`, the system runs `runAbilities(...)` for each trigger sequentially — `WHEN_` resolves fully before `AFTER_` begins
3. Invokes with `side: 'OWN'` fire only for the trigger side; `side: 'OPPONENT'` fire only for the other side
4. The trigger side goes first in the alternating resolution loop
5. Abilities in triggered windows cannot emit new triggers (recursion prevention)

### Example: Reacting to Sustain Damage

```typescript
invoke: [
  {
    timing: 'AFTER_SUSTAIN_DAMAGE_USE',
    side: 'OPPONENT', // React when opponent sustains
    isCallable: (params, ctx, unitId) => { ... },
    call: (ctx, params, unitId) => { ... },
  },
]
```

## Checklist for New Abilities

1. Create file in the correct category directory
2. Define `Params` type and `params` (including `isEnabled` and `uses` from AbilityBaseParams)
3. Choose correct timing(s) — see [Timing System](#timing-system)
4. Implement `isCallable` guard if ability is conditional
5. Implement `call` with the correct signature for the timing
6. Add `headerUI` — every ability must be visible in the UI. For always-on abilities with no user controls, use `params: { isEnabled: true, uses: Infinity }`, `headerUI: 'isEnabled'`, and `readOnly: true`
7. Add `uiConfig` if ability has configurable params beyond the header
8. Add `side` if ability is side-restricted
9. Register in the category's `index.ts` (or faction's `index.ts`)
10. Write tests (see `docs/testing.md`)
11. Mark ability as `[x]` in `docs/abilities-list.md`
