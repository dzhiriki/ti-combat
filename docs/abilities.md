# Ability Development Guide

## File Structure

Data is split by game system: `src/data/main/` (Twilight Imperium 4) and `src/data/tf/` (Twilight's Fall). Each `index.ts` default-exports a complete `GameData` entry point: system metadata, factions, base units, registered and lookup ability pools, slot presentation, and faction/ability lookup methods. Code outside `src/data` reads it through `getGameData(system)` (`src/utils/get-game-data.ts`) and never imports system data files directly. System-specific availability policy is declared when the entry calls `createGameData`. Shared TI4 abilities are organized in `src/data/main/abilities/` by category:

```
src/data/main/abilities/
  general/          — core/unit abilities (UNIT_PRIORITY, PRE_DAMAGED, PRE_GALVANIZED, SUSTAIN_DAMAGE, PLANETARY_SHIELD, DISABLE_PLANETARY_SHIELD)
  advanced/         — phase/system abilities (ANTI_FIGHTER_BARRAGE, BOMBARDMENT, SPACE_CANNON_OFFENSE/DEFENSE, RETREAT, ABILITY_ORDER, CAPACITY, FLEET_POOL)
  technology/       — tech cards (ASSAULT_CANNON, PLASMA_SCORING, ...)
  action-card/      — action cards (BUNKER, MORALE_BOOST, SOLAR_FLARE, ...)
  environment/      — environment effects (NEBULA, ENTROPIC_SCAR)
  agenda/           — agenda cards (CONVENTIONS_OF_WAR, PROPHECY_OF_IXTH, ...)
  relic/            — relics (LIGHTRAIL_ORDNANCE, METALI_VOID_ARMAMENTS, ...)
```

Faction abilities live in `src/data/main/faction/[faction_name]/` (TI4) or `src/data/tf/faction/[faction_name]/` (Twilight's Fall) alongside the faction definition. Twilight's Fall shared decks live in `src/data/tf/abilities/` (`ability/`, `genome/`, `paradigm/`, `action-card/`, `unit-upgrade/`); each deck folder has an `index.ts` listing its cards in display order, and `src/data/tf/index.ts` tags each deck with its slot. The generic `cloneAbility(ability, overrides)` exported by `@/combat` copies an ability and gives static invoke entries fresh identities without changing any policy. A TF card that reuses a TI4 implementation is still its own file and uses the wrapper in `src/data/tf/clone-ability.ts`; that wrapper adds TF-specific subtype rekeying and opt-in defaults. Always pass a `TF_`-prefixed `key` of the card's own (`TF_ALTRUISTIC_GENOME`), plus only the fields that differ from the source (TF name, description, or the originating faction icon when the source has none).

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
  onParamSet?: (params, key, value, ctx) => params | void // Setup: react to a UI param edit
  declareChanges?: (ctx, params) => void // Setup-visible effect; invokes reuse it via ctx.invokeChanges()
  declareSubtype?: (params) => DeclaredSubtype[] // Declare variant subtypes (e.g. Cavalry)
  sort?: (params, ctx, unitIds) => UnitId[] // Pre-sort this ability's unit invokes
  preventDestroy?: (params, ids, api) => UnitId[] // Spare units from opponent direct destroys
  invoke: AbilityInvoke<Params>[] // Array of timing handlers
}
```

There is **no `category`/`subcategory` field**. An ability's category is derived from the registration slot it occupies (which `index.ts` array or faction ability group it is added to) — abilities never declare it. Each system owns its `SLOTS` config in `src/data/<system>/ability-slots.ts`; the engine treats faction and slot names as opaque strings. See [Slot config](#slot-config) below.

Everything a faction owns maps onto `FACTION_<NAME>`: an ability group key (the shared `FactionAbilities` runtime shape is `Record<string, Ability[]>`, so `ability` → `FACTION_ABILITY`) and a unit type alike (a dreadnought's `ABILITIES` → `FACTION_DREADNOUGHT`). The system must declare a slot of that name or data resolution throws (for example, Twilight's Fall has no `FACTION_BREAKTHROUGH` slot). Because the two share one namespace, a group named after a unit type renders in that unit's slot; Nekro Virus uses this to file its copied unit abilities next to its own units.

### Slot config

`SLOTS` is a single ordered list that fixes render order, titles, category grouping, and how each slot is filled. `AbilitySlot` is derived from it, so a slot can't be registered against unless it is declared:

```typescript
export const SLOTS = [
  { title: 'GENERAL', slot: 'GENERAL' }, // shared deck from index.ts
  {
    title: 'FACTION', // category header, items render as sub-headers
    items: [
      { title: 'HERO', slot: 'FACTION_HERO', strategy: 'OWN' },
      { title: 'AGENT', slot: 'FACTION_AGENT', strategy: 'OWN' },
      // Several slots under one sub-header, sharing its title and order
      {
        title: 'UNIT',
        slot: ['FACTION_CRUISER', 'FACTION_PDS'],
        strategy: 'OWN',
      },
    ],
  },
  // The same slot again, from the other side of the table
  { title: 'AGENT', slot: 'FACTION_AGENT', strategy: 'OTHER' },
  // Hidden from the NEUTRAL faction
  {
    title: 'PROMISSORY',
    slot: 'FACTION_PROMISSORY',
    strategy: 'ALL',
    neutral: false,
  },
  { title: 'OTHER', slot: 'OTHER' },
] as const satisfies readonly SlotEntry[]
```

Every entry, and every category (whose flags its items inherit), also takes:

| flag      | Default | Meaning                                                                                                           |
| --------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `neutral` | `true`  | Whether NEUTRAL sees the slot. Neutral is a generic opponent: no research, hand, or notes, so TI4 turns those off |
| `icon`    | `true`  | Whether cards show their faction icon. Off where the header already names the faction (own agents under FACTION)  |

Neutral eligibility is defined only in the slot config. Fleet Pool is available to Neutral through ADVANCED and defaults to disabled.

| `strategy` | Which of the slot's abilities the selected faction sees                  |
| ---------- | ------------------------------------------------------------------------ |
| _none_     | A shared deck: whatever the system's `abilities` record registered there |
| `OWN`      | The ones it owns                                                         |
| `OTHER`    | The ones every **other** faction owns                                    |
| `ALL`      | Every faction's, its own included                                        |

There is one slot per kind of card — all agents are collected into `FACTION_AGENT` — and a slot may appear twice under different strategies. That is how an agent renders under FACTION for the faction holding it and in the shared AGENT list for everyone else, without being registered twice.

### How a faction's abilities are collected

`createGameData` collects each ability once per source into a `CollectedAbility`: the definition plus its registered `slot`, owning faction if any, and optional deployment metadata. `RegisteredAbility` is the definition plus `slot`, the shape used by engine lookups, reconcile, and the setup store. Presentation and eligibility remain in `GameData.slots`; collected abilities carry no `strategy`, `neutral`, or `display` fields.

Shared decks register under slots with no strategy, faction-owned abilities under slots with a strategy; an ability no entry could ever show is a data error and throws. `getAvailableAbilities(side, faction)` walks the collected list in **registration order** and keeps abilities matching at least one slot entry's ownership and Neutral rules. The panel iterates `GameData.slots` in display order, matching available abilities by slot and owner. With two or more planets it shows Bombardment and Commit Ground Forces under GENERAL, since their planet splits matter then (`layoutPlanetSplits`). Category and subcategory titles, icon visibility, and title-based search all come directly from that config.

The one exception is the catch-all: an ability that no entry shows, but that another faction can reach across the table with (an `external` invoke), is appended to the `OTHER` slot with its owner's icon. Systems opt out by not declaring `OTHER` — Twilight's Fall has no such slot.

A group with no `OWN` slot is only shown through its `ALL` pool — that is how a faction's own promissory notes stay out of its FACTION section.

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

## Setup changes

Setup never runs PREPARE, so an effect it must show before combat — a unit's
categories, where it may be placed, or which units a grant makes ships — is
written once in `declareChanges`. It has exactly the API of an invoke `call`:

```typescript
export const theAlastor: Ability = {
  // ...
  declareChanges: ctx => {
    const selected = ctx.api.own.system
      .getUnits()
      .filter(id => ctx.api.own.isUnitCategory(id, 'GROUND_FORCES'))
    ctx.api.own.grantCategory(selected, 'SHIPS')
  },
  invoke: [
    {
      timing: 'START_OF_COMBAT',
      call: ctx => {
        ctx.invokeChanges()
      },
    },
  ],
}
```

Setup runs the changes of every active ability (enabled, with its `headerUI`
param set), attacker first, against a model holding the fielded units of both
sides. Reconcile stores that model as `optionMetadata.model`, and setup reads it
like any combat state:

- **Placement** — `ALLOWED_SURFACES` (Miniaturization, Nekro unit copies).
- **Option lists** — unit categories (Eidolon Maximum, Hel-Titan), grants
  (Alastor, Z-Grav Eidolon, Matriarch) and the units an ability may place.
  Lists of units that fight show only the units the model holds; fielded units
  alone supply counts and caps.

An ability that may place units declares them with `placeUnits` in its changes
(Brother Milor, Indoctrination, Overwing Zeta, Sleeper Cell, …):

```typescript
declareChanges: ctx => {
  ctx.api.own.placeUnits({ FIGHTER: 2 }, SPACE_SURFACE_ID)
},
```

In setup, `placeUnits` only makes each variant present on the surface: it adds
one unit where none stands yet and the unit limit leaves room, enforces nothing
else, and places nothing for an ability whose `context` is the other combat
mode. Declare what the ability may place, even if it might not: listing a unit
that never arrives is harmless, while a placed unit missing from the lists
takes hits last and can't sustain. Changes run in passes until one places
nothing new, so a change sees units declared by abilities registered after it
and by the opponent (Sleeper Cell captures the opponent's ship types).

The engine never runs `declareChanges` on its own. An invoke applying the same
effect calls `ctx.invokeChanges()` (params default to the ability's current
config) instead of repeating the code; there `placeUnits` places for real. TF
Hel-Titan keeps its plain stats invoke for Janovet and declares
`declareChanges: statsInvoke.call` instead.

- Put in `declareChanges` only what setup must see; keep combat-only or
  conditional effects in the invoke (Z-Grav Eidolon's change grants SHIPS to
  the mechs in space; its START_OF_COMBAT invoke also rewrites combat values).
- Changes see the fielded and declared units, not the combat that follows:
  don't move or remove units, write ability config, or check `isEnabled`
  (setup already gates on it). Add a subtype only when it replaces fielded
  units before combat (Galvanized Units marks its chosen units, so the
  Commit Ground Forces and Bombardment splits list them apart); its PREPARE
  applies the same subtype for real.
- An invoke whose placement matches the declaration calls
  `ctx.invokeChanges()` instead of repeating it (Brother Milor, Overwing Zeta,
  Dunlain Reaper after removing its infantry). Call `placeUnits` directly only
  when the invoke needs the placed ids or a surface setup can't know
  (Indoctrination, Moyin's Ashes).
- Declaring changes moves the ability's PREPARE ahead of other PREPAREs, so
  unit copies and transformations set stats before Capacity and Fleet Pool
  enforce.
- A copier runs its target's changes as the target:
  `withRunningAbility(ctx, target, () => ctx.invokeChanges(params))`
  (Technological Singularity, Ssruu, Clever Genome; Technological
  Singularity then restores placement surfaces because the copy is gained
  mid-combat). Forward only changes that still matter once the copy is
  gained: TF Singularity forwards none, since the Abilities that declare
  changes act before it can trigger.

## Timing System

Timings define when abilities fire. They run in this order during combat:

```
PREPARE               — once at combat construction
COMMIT_UNITS          — during COMMIT_UNITS phase (ground combat unit commitment)
COMMIT_UNITS_STEP     — the Commit Ground Forces driver lands ground forces
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

`onParamSet`, `declareSubtype`, and factory `invoke` receive a trailing `ctx: AbilityLookupContext`:

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

Used in both `isCallable` and `call` contexts. The same `SideApi` class is used for both read and write — write methods are only available during `call` (mutable combat context).

### Read Methods

Unit queries are grouped by scope. `system` sees every living unit across all
surfaces in the active system, `surface` sees only the active combat surface,
and `participating` sees the derived combat-participant pool regardless of
surface. Effects that choose or affect combatants use `participating` in both
space and ground combat, even when their text says “in the active system”;
explicit planet or space-area effects use `surface`; effects that refer to
general units throughout the active system use `system`.

`UnitQueryOptions` is `{ includeVariants?: boolean }`; without it a plain type
matches only that exact variant key. The namespace selects the pool;
`participating` already contains the units admitted to combat. Queries do not
filter by category. When an effect needs a category within `system` or
`surface`, check each ID with `isUnitCategory`.

```typescript
class UnitQuery {
  getUnits(unitType?: UnitLocator, options?: UnitQueryOptions): UnitId[]  // no type: every unit in scope
  hasUnitType(unitType: UnitLocator, options?: UnitQueryOptions): boolean
  countUnits(filter?: UnitLocator | UnitLocator[], options?: UnitQueryOptions): number
  findUnitByPriority(priority: UnitLocator[], options?: FindUnitOptions): UnitId | undefined
  findUnitByPriority(priority: UnitLocator[], options: FindUnitsOptions): UnitId[]  // with `amount`
  getUnitTypes(): UnitBaseType[]
}

system: UnitQuery
surface: UnitQuery
participating: UnitQuery

getAssignHitsTargets(hits: number): UnitId[]  // Participants `hits` would destroy
getFaction(): string
getCombatMode(): CombatMode  // for hooks that receive only a SideApi (e.g. preventDestroy)
hasUnit(unitId: UnitId): boolean
getPendingHits(filter?: { base?: true; bonus?: true }): number
canAssignHitToUnit(unitId: UnitId): boolean  // Includes phase and unit-ability hit restrictions
isParticipating(unitId: UnitId): boolean
matchesUnitLocator(unitId: UnitId, locator: UnitLocator): boolean
matchesUnitList(unitId: UnitId, list: UnitList): boolean  // Any enabled entry; skips false/0 like getFlat
isUnitCategory(unitId: UnitId, category: UnitCategory): boolean  // During the current meta
isUnitTypeCategory(unitType: UnitType, category: UnitCategory): boolean  // Native categories, for production choices
getUnitVariantsOptions(filter?: ParamFilter): { label: string, value: string }[]
getUnitVariantsOptions(paramKey: string): { label: string, value: string }[]   // reads filter/limit from the declareParam
getUnitStats(unitTypeOrId: string | UnitId): UnitStats
getUnitTypesWithAbility(abilityKey: string): UnitType[]  // Variant keys whose stats carry the ability, fielded or not
getUnitVariantKey(unitId: UnitId): string | undefined
getUnitState(unitId: UnitId): UnitState
getUnitBaseType(unitId: UnitId): UnitBaseType
getAbilityConfig(key: string): Record<string, unknown>
isUnitAbilityLost(ability: UnitAbility, unitId: UnitId): boolean
isUnitAbilityCannotBeUsed(ability: UnitAbility, unitId: UnitId): boolean
isUnitAbilityDisabled(ability: UnitAbility, unitId: UnitId): boolean  // lost or cannot be used
```

### Write Methods (available in `call` only)

#### Unit Operations

```typescript
destroyUnits(target: UnitId | UnitId[]): void  // Array variant fires destroy abilities once
removeUnits(target: UnitId | UnitId[]): void   // Remove without triggering destroy abilities
placeUnits(unitsToAdd: Partial<Record<UnitType, number>>): Record<UnitType, UnitId[]>  // Returns the placed UnitIds (keyed by variant key)
modifyUnitType(key: UnitType, updates: Partial<UnitStats>): void   // Modify stats for all units of a type
modifyUnitState(unitId: UnitId, updates: Partial<UnitState>): void // Modify per-unit mutable state
grantCategory(ids: UnitId | readonly UnitId[], category: UnitCategory): void
```

Native `UnitStats.CATEGORIES` defaults to the base type's categories.
Participation follows categories alone: ships (native or granted) join space
combat wherever they stand in the system, and ground forces join ground combat
on the invaded planet (the attacker's are committed there from space),
including newly placed units. A multi-planet invasion moves the active
surface: bombardment and commitment use the first planet, then each planet's
Space Cannon Defense and ground combat run with that planet active. Hel-Titans natively belong to both `STRUCTURES`
and `GROUND_FORCES`; Eidolon Maximum mechs are ships and ground forces, so one
on a planet fights in space combat too.

A `CATEGORIES` entry may be limited to meta phases:
`{ category: 'SHIPS', phase: 'SPACE_COMBAT' }` (or a list of phases) holds only
while the scheduler's current meta (`CombatStateData.meta`) is one of them.
Nested metas such as AFB count as the combat they run in; PREPARE has no meta,
and setup option lists use their mode's combat meta (`getCombatMeta`).
Starlancer XI is a ground force that is a ship during space combat: its mechs
fight in space combat from a planet too, but are no ships during Space Cannon
Offense or ground combat. No invoke is involved.

`grantCategory` applies only to the selected IDs: each counts as a member of the
category for the rest of the combat and takes part in its combat like a native
member. A unit holds at most one grant. The categories are `SHIPS`, `GROUND_FORCES`, and
`STRUCTURES`. Non-fighter ships are ships whose base type is not `FIGHTER`;
they are not a separate category. Base types and variants remain unchanged.

Alastor snapshots its chosen ground forces and grants them `SHIPS`; Z-Grav
Eidolon grants `SHIPS` to the mechs in the space area when it flips, because
it is a ship only there (changing the mech's `CATEGORIES` would make every mech
a ship). Matriarch
and Morphwing grant `GROUND_FORCES` to the fighters in space at commitment;
the engine lands them on the active planet with the native ground forces and
returns them to space at completion. Later reinforcements do not inherit these
grants.

Setup sees these effects only through `declareChanges` (see
[Setup changes](#setup-changes)), which shapes possible setup options such as
Sustain Priority and Assign Hits Order. Runtime effects use scoped queries and
`isUnitCategory` instead. Starlancer XI's membership is a phase-scoped native
entry (see above). Its special combat-end rules are deferred.

#### Hit Operations

```typescript
reduceHits(amount: number): void
addHits(hits: number): void                       // Ordinary hits on the landing side
addHits(hits: number, priority: UnitType[]): void  // Type-restricted; throws if the landing side's hitPool is non-empty

// Apply a flat +/- to each combat roll result for this dice-roll group.
// target omitted = all of this side's dice; { exclude } = all but the listed base types; unitId selects one actual unit.
applyBonusToResult(
  amount: number,
  target?: UnitType | { exclude: UnitBaseType[] }
    | { unitId: UnitId },
): void
```

`addHits` and `reduceHits` do not carry category or unit-ability metadata. The
participating pool and the assignment phase determine eligible casualties.
Effects that select a sustaining unit must check `canAssignHitToUnit` first.

#### Unit Ability Restrictions

Two-layer system — **lost** (ability removed) vs **cannotBeUsed** (ability present but blocked):

```typescript
// Disable ability for all units, a specific base type, or a category
setUnitAbilityLost(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory, surfaceId?: SurfaceId): void
removeUnitAbilityLost(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory, surfaceId?: SurfaceId): void
setUnitAbilityCannotBeUsed(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory, surfaceId?: SurfaceId): void
removeUnitAbilityCannotBeUsed(ability: UnitAbility, reason: string, target?: UnitBaseType | UnitCategory, surfaceId?: SurfaceId): void

// Carve one unit type back OUT of every restriction (both layers) coming from `reason`
setUnitAbilityRestrictionImmunity(reason: string, unitType: UnitBaseType): void
removeUnitAbilityRestrictionImmunity(reason: string, unitType: UnitBaseType): void
```

`reason` is the ability key that caused the restriction. Used to cleanly remove restrictions without affecting other abilities' restrictions.

`target` can be a specific `UnitBaseType` such as `'MECH'` or a `UnitCategory`
(`'SHIPS'`, `'GROUND_FORCES'`, or `'STRUCTURES'`). Categories are resolved
against individual units, so category grants are reflected. Omit the target to
apply the restriction to every unit in scope. A `surfaceId` limits it to the
units standing on that surface (Ral Nel Miniaturization's structures in space).

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
  invoke: [/* ... */],
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
    ability: [myAbility], // Only available to this faction
    technology: [factionTech], // Faction-specific technology
    unit: [unitAbility], // Unit-attached abilities
    promissory: [promNote], // Available to all factions
    agent: [agentAbility], // Available to all factions
    commander: [commanderAbility], // Available to all factions
    hero: [heroAbility], // Available to all factions
    breakthrough: [breakthrough], // Breakthrough abilities
  },
  units: {/* ... */},
}
```

Each group renders in the `FACTION_<KEY>` slot its system declares `OWN`. `promissory`, `agent`, and `commander` are additionally collected across all factions into the shared `ALL` pools available to everyone; `promissory` has no `OWN` slot, so it appears only in that shared pool, never under its owner.

### Twilight's Fall unit upgrades

Each card in `src/data/tf/abilities/unit-upgrade/` is a normal `Ability` object.
Declare its params, UI, exclusive group, and special invokes directly. Non-mech
cards use `exclusiveGroup: 'UNIT_UPGRADE_<UNIT_TYPE>'` (the same name as the slot each unit type's cards are registered under); mech cards omit it
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
abilities without depending on factory metadata or runtime unit modifications,
copying the block's `ABILITIES` onto the flagship along with its unit
abilities.

A card whose text belongs to the upgraded unit ("destroy this unit") puts that
text in its stat block's `ABILITIES` under the card's own key, so it fires per
unit and reads the card's config; Janovet copies it like any other block
ability, so cards never check for the flagship. TF Exotrireme and Strike Wing
Alpha are the Sardakk N'orr Exotrireme II and Argent Flight Strike Wing Alpha
II re-keyed this way; Linkship has its own text, gated on the retreating unit
(`unitId === ctx.getUnit()`). The registered card spreads the text to carry
its params, controls, and `sort` (the engine reads `sort` from the registered
ability), keeps only the stats invoke, and drops the text's ability-level
`context` so the stat block applies in both modes. Exotrireme also declares
`declareChanges: statsInvoke.call` so its sacrifice list sees which units
carry the text. The Sardakk ability is on by default with `uses` in its header; the card
restores an `isEnabled` header, off by default, since switching it on means
holding the upgrade.

### Lazy faction data

A faction module exports a `FactionDefinition`. Its `abilities` and any unit base/upgraded `ABILITIES` may be a function of `LazyContext`, resolved once per field by `createGameData`:

```typescript
export const copyingFaction: FactionDefinition = {
  name: 'Copying faction',
  abilities: context => ({
    technology: [...(context.getFaction('SOURCE').abilities?.technology ?? [])],
  }),
  units: {
    FLAGSHIP: {
      BASE: {
        ABILITIES: context => [...context.getAbilities('FACTION_AGENT')],
      },
    },
  },
}
```

The context contains only `getFactionKeys()`, `getFaction(key)`, and
`getAbilities(slot)`. `resolveFactions` runs once while constructing the system
and recursively initializes dependencies requested through those lookups,
regardless of faction declaration order. A lazy faction ability map initializes
together because its group names are unknown until it returns. Runtime
`GameData.getFaction` reads the completed roster and `GameData.getAbilities`
filters the completed catalog; neither performs reconciliation.

Factories in one construction share a context object, separate from runtime
`GameData`. A reentrant lookup skips the initializer already running and resolves
the remaining fields, so a flagship can request its own faction's abilities.
Dependencies must be acyclic; reading an unfinished initializer's own result is
unsupported. All fields finish before the runtime roster and catalog are returned.

Use the context lookups instead of importing other faction definitions. Nekro is
a static faction definition; its lazy ability initializer creates fresh copies
once per system construction. Technological Singularity is a static ability whose
callbacks look up targets from the current side's runtime abilities and create
generic unit upgrades when needed.

Nekro's copied faction technologies and flagship abilities come from
`FACTION_TECHNOLOGY` and `FACTION_FLAGSHIP` slot lookups. Faction-unit stat
copies use `getFactionKeys()` and `getFaction(key)`: units such as Letani Warrior
II have no standalone ability for a slot lookup to return.

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

There are five UI config item types. The list variants are all expressed as `unit-list` with a `mode`:

| Type         | Param Type                | Use Case                                                      |
| ------------ | ------------------------- | ------------------------------------------------------------- |
| `checkbox`   | `boolean`                 | Toggle                                                        |
| `number`     | `number`                  | Counter with optional `min`/`max`                             |
| `select`     | `string`                  | Dropdown (`items: SelectItem[] \| SelectGroup[]`)             |
| `unit-list`  | `UnitList<V>` (see below) | List of units; behavior set by `mode` (+ optional `sortable`) |
| `unit-split` | `UnitList<number>`        | A slider per unit type dividing a `split` param's units       |

`unit-split` takes the items of a `split` param
(`getUnitVariantsOptions(key)`): one slider per unit type whose units have
more than one place to go, each thumb the border between two surfaces. The
control is hidden when no type has.

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

### Surface-aware unit selectors

`declareParam` defaults to `scope: 'participating'`; omit it for parameters
selecting participating units. Use `scope: 'system'` for units throughout the
system, or `scope: 'type'` for type-only choices, reinforcements, and controls
confined to one surface. `source` still selects categories; `side`, `filter`,
`sort`, and `limit` still apply.

`getUnitVariantsOptions(paramKey)` and reconciliation use the same resolver.
Scoped options have a `UnitLocator` key and surface metadata. They offer only
the units the setup model holds: fielded units and those active abilities may
place (see [Setup changes](#setup-changes)). Participating choices use the
active combat surface; setup grants can expose additional surfaces. In ground
mode they are made by unit type (plain variant keys, no surface): each ground
combat is fought on one planet, so a choice applies on every planet. Only a combat drawing participants from several surfaces (space
combat with Alastor or Eidolon Maximum) and system choices keep the
surface. System
choices use every surface a unit stands on. Explicit availability filters and
count limits still apply. `scope: 'type'` choices (reinforcements) offer every
type of the category. Reconciliation keeps participating list entries for every
surface of the param's mode (each planet for `GROUND`), so settings for an
unselected planet survive planet and mode switches while the control shows only
the active one. It also keeps the entries of units no longer offered, hidden,
so a unit removed and placed again gets its settings back; share links carry
only the offered entries.
Single choices follow the active surface and keep their unit type when the
planet changes; ground choices, made by type, need no move.
`sort: 'combat-desc'` (`'combat-asc'`) orders options by the expected hits of
their combat roll, strongest (weakest) first, with worth breaking ties; it
reads the setup model's stats, so upgrades and declared changes count. A
single choice under a combat sort picks automatically until the user picks:
while it holds the declared default or the value reconcile last chose
(`CombatSetup` tracks it), reconcile moves it to the first option, on its
surface while one is offered there. A picked unit sticks while offered and
falls back to the first option when it leaves (Viscount Unlenn and Evelyn
DeLouis pick the strongest unit, Cavalry the weakest). Render such a select
with the options as returned; don't reverse them.
Give every participating param a `filter.combatMode`; without
one, the other mode resolves a different catalog and reconcile resets it.
Ordered controls stay flat and suffix duplicate names with their surface.
Independent controls are grouped by surface only when a unit type appears on
multiple surfaces.
Otherwise, they stay flat without headings. `IN_COMBAT` limits count the units
the control offers on that surface, including commitments projected onto the
active planet; the build-time clamp uses the same caps.

`filter: { withAbility: true }` offers only the unit types whose stats carry
the ability declaring the param, matched by key so re-keyed copies keep
working. Exotrireme's sacrifice list uses it, so every dreadnought carrying
the text and The Faces of Janovet (which copies it) can be picked. Setup never
runs PREPARE, so the filter reads the setup model: an ability attached to units
at PREPARE must also be attached by a `declareChanges` to be offered. Reconcile
lists the holders as if the ability were switched on and its unit upgraded (an
ability in a unit's `FACTION_<UNIT>` slot counts that unit), so the control
keeps its options and order meanwhile.
`SideApi.getUnitTypesWithAbility(key)` answers the same question at runtime
from the current stats.

`UnitLocator` accepts legacy `UnitType` values as well as qualified keys from
`makeUnitLocator(type, surfaceId)`. Unit queries, priority helpers, and
`SideApi.matchesUnitLocator(id, locator)` respect both parts. For per-unit
allow-lists use `SideApi.matchesUnitList(id, list)` instead of
`getFlat(list).some(t => matchesUnitLocator(id, t))`: it skips `false`/`0`
entries like `getFlat` and compiles each list object once, so never mutate a
`UnitList` param in place.
`parseUnitLocator(locator)` returns `unitType` (decoded variant), `baseType`,
`subtypes`, and optional `surfaceId` for both qualified and legacy values. Use
`unitType` for variant/stat work and `locatorWithSubtype(locator, subtype)`
to retain location in subsequent queries.
Subtype declarations use plain `unitType` plus optional `surfaces` metadata.

### Per-planet choices

`scope: 'planet'` offers each unit type once per planet of the system,
whether or not units stand there, with `UnitLocator` keys
(`@planet-2/INFANTRY`). A ground invasion fights over every planet, so each
receives what the list sends it; the runtime reads the invaded planets with
`foughtPlanetIds(ctx.state)` (`abilities-engine/unit-options.ts`) and puts
units listed for a planet outside the invasion on the first one. Values stored by type (earlier versions) move to the first
planet, and a subtype never inherits its parent's count.

- **Per-planet amounts** (G'hom Sek'kus: units committed onto each planet):
  a `unit-list` in `number` mode, grouped by planet. A `limit` caps each
  base type's total across planets.
- **Splits** (`split: UnitSplit`): divide units the side already fields.
  `from: 'space'` counts units in space (commitment), `from: 'system'` every
  unit (`unitAbility` narrows them, Bombardment's `'BOMBARDMENT'`);
  `canStay` adds a `@space` entry for units kept back. Each item's `max` is its
  type's unit count, and reconcile keeps every type's counts adding up to it:
  new units go to the first planet, surplus leaves space first, then the last
  planets. Show it with `unit-split`. At runtime `splitUnits(ctx, list, ids)`
  (`abilities-engine/api/split-units.ts`) returns the planets and the units
  each receives, putting units the list doesn't cover on the first planet.

`resolveStep(meta, { surfaceId, units })` resolves a unit ability against a
planet with only the given units rolling: the planet becomes active (targets,
Planetary Shield) before the roll and stays so. Calls run last-pushed first,
so push planets in reverse (Bombardment's driver).

Setup changes extend these choices through their grants: a unit granted the
mode's category counts on its own surface (Alastor), and the attacker's
granted ground forces in space are committed onto the active planet
(Matriarch/Morphwing), which also lists them in Commit Ground Forces'
split. The preview never grants runtime participation.

### Uses per planet

Any ability with limited uses that it spends on a specific planet gets a
"Uses per planet" control in a multi-planet invasion, with no
ability code. An ability qualifies when one of its use-spending (non-`system`)
invokes runs during a planet's turn rather than once for the system:
`PREPARE`, `COMMIT_UNITS`, `COMMIT_UNITS_STEP`, `BOMBARDMENT_STEP` and the
space-only steps don't count, so Blitz has no control; read-only and
SPACE-context abilities never qualify (`spendsUsesOnPlanet` in
`combat-state/planet-uses.ts`). The caps live in the generic `planetUses` param
(`[SurfaceId, number][]`, next to `isEnabled` and `uses`); a planet without
an entry is not limited, and a cap is a maximum, not a reservation: uses a
planet leaves carry on to the planets after it. While a planet is active
(its bombardment, Space Cannon Defense and ground combat) the ability's
`params.uses` is what that planet may still spend, so invokes and dice
modifiers need nothing planet-aware. The control (a number `List` with
`optional` counts) steps a cap up from 0 to `uses`, then to no limit (an empty
field); an ability with a fixed single use (default `uses: 1` and no `uses`
control in its header or config, e.g. Fire Team) gets a checkbox per planet
titled "Use on planets" instead (checked = allowed, unchecked = cap 0).
Editable uses (Morale Boost) always get the counts. It renders first in the
ability's config, whenever the uses are finite. Reconcile drops caps of missing planets and of abilities that don't qualify,
and lowers caps above `uses`.
