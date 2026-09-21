# Engine Gotchas

Non-obvious invariants of the combat engine, dice-math kernel, and test
harness. Each of these was discovered the hard way while debugging; check
here before re-deriving behavior empirically. Keep entries short: the
gotcha, what to do instead, and a reference implementation.

Statically checkable invariants (invoke identity/dedup rules, uiConfig
shape, finite number-input defaults, select option values) are enforced by
`tests/ability-invariants.test.ts` — when adding a gotcha of that kind, add
a check there too.

## Ability engine

- **One invoke per (ability, timing).** A second invoke with the same timing
  on one ability is silently skipped. Compose extra work into the single
  invoke instead (see `src/data/tf/abilities/unit-upgrade/pds/hel-titan.ts`,
  which calls its stats invoke and restores ground participation in one PREPARE).

- **The engine must never import from `src/data`.** The data barrels
  (`src/data/main`, `src/data/tf`, `src/data`) evaluate every ability at
  load time, and abilities import `declareParam` etc. from `@/combat`. An
  engine module importing a data barrel closes a cycle where the `@/combat`
  barrel is still mid-evaluation and `declareParam` is `undefined` for the
  first ability that runs ("declareParam is not a function" on every test
  file). Helpers the engine needs (`enforceFleetPool`, `collectFreeCargo`)
  live in `src/combat/abilities-engine/api/` and are imported by the data
  side, never the reverse.

- **`resolveStep` side overrides are ability-relative.** Pass `OWN` /
  `OPPONENT` in `firing`; `resolveStep` maps them to attacker / defender from
  `ctx.side`. Passing absolute sides breaks steps dispatched by the defender
  (the attacker-disabled AFB path is the reference case).

- **Invoke dedup is by object identity.** Two abilities sharing the same
  invoke objects (e.g. a shallow-cloned ability with a new key) fire only
  once between them. When re-keying a clone, clone the invokes too:
  `invoke: original.invoke.map(inv => ({ ...inv }))`. The generic
  `cloneAbility` in `src/combat/abilities-engine/clone-ability.ts` does this;
  TF and Nekro both use it.

- **Registered abilities are copies of their definitions.** `RegisteredAbility`
  is `Ability & { slot }`, and `createGameData` builds registered entries by
  spreading the definition. Identity-based lookups (`Set<Ability>`, WeakMap
  caches) therefore never match a registered entry against the unit-definition
  object it came from — dedupe by `key` instead. Invoke objects are shared by
  the copy, so invoke-identity dedup is unaffected.

- **TF clones never share a key with their TI4 source.** Every `cloneAbility`
  call passes its own `TF_<NAME>` key, so a TF session addresses Altruistic
  Genome as `TF_ALTRUISTIC_GENOME`, not `TELLURIAN`. Anything
  keyed by the source's literal key breaks for the clone: declared subtypes
  are stamped with the declaring ability's key, so `cloneAbility` rewrites a
  self-referencing `excludeSubtypeSource`; in ability code prefer
  `ctx.this.key` over a literal (see Thundarian's restart log).

- **Unit-linked GENERAL abilities become always-on when no unit definition
  carries them.** `collectAbilityCandidates` runs a config ability
  unconditionally unless its key appears in the faction's unit-definition
  ability keys — so an ability meant to ride on units (e.g.
  `DISABLE_PLANETARY_SHIELD`) silently fires for factions whose unit defs
  never mention it. Gate such abilities with
  `isCallable: (_p, ctx) => ctx.unitSource !== undefined`.

- **`modifyUnitType` shallowly assigns native stats.** Supplying
  `UNIT_ABILITIES` replaces the whole map; it does not merge individual flags
  with the existing map. The same applies to `ABILITIES`. Fixed upgrade cards
  must list their complete unit-ability block (including `{}` when clearing
  it); relative modifiers must spread the current map when preserving it.
  `createStatsInvoke` deliberately preserves this behavior (see
  `tests/engine/create-stats-invoke.test.ts`).

- **Abilities attached to unit stats during PREPARE are too late for their
  own PREPARE invokes.** `modifyUnitType(..., { ABILITIES: [...] })` inside a
  PREPARE cannot add another PREPARE-timed ability for this combat. Do the
  work directly in the attaching ability's PREPARE instead (see the TF war
  sun upgrades stripping Planetary Shield 2RAM-style in
  `src/data/tf/abilities/unit-upgrade/war-sun/prototype-war-sun.ts`).

- **Finite `uses` bills and gates EVERY non-system invoke — including a
  card's PREPARE.** A stat-upgrade card with a finite-uses active ability
  (TF Exotrireme) must mark its PREPARE `system: true`, or the stat
  application burns a use at PREPARE and stops applying entirely once
  `uses` reaches 0. `createStatsInvoke` (`src/utils/create-stats-invoke.ts`)
  marks native stat applications as system invokes; custom PREPARE handlers
  must retain that flag (see TF Exotrireme and Hel-Titan).

- **System invokes skip dispatch-time `uses` gating.** Invokes on timings
  like `REROLL_DICE_ROLL` (whose billing is deferred to the kernel) fire
  even at `uses: 0` unless you add
  `isCallable: params => params.isEnabled && params.uses > 0` explicitly
  (see Bone Picked Clean, Munitions Reserves).

- **REROLL decls are billed in TWO places — `consumeUseIf` must be honored
  by both.** The per-unit-type reroll factory (`runPerUnitTypeMode` →
  `applyRerollSpecs`) sets `usesDelta` on every fired branch, and
  `markOneShotUses` then skips any key already present. A `RerollDecl`
  with `consumeUseIf` (Munitions Reserves, which pays at
  START_OF_COMBAT_ROUND via the normal dispatch decrement) must therefore
  carry `consumeUseIf` onto `RerollTargetSpec` so the factory defers
  billing; otherwise the reroll bills a second use per round (symptom:
  `uses: 1` and `uses: 2` both fire for one round, `uses` goes negative).

- **One external invoke poisons the rest on non-owner sides.** An ability
  with ANY `external: true` invoke dispatches ONLY its external invokes on a
  side that doesn't own it (the cross-faction filter inlined in
  `buildInvokes` / `addAbilityInvokes`, `abilities-engine.ts`). A wrapper
  ability that aggregates invokes from mixed sources (some agent-derived/
  external, some not) must mark ALL of them external, or the non-external
  ones silently never fire (see `wrapInvoke` in `tf-genome/clever-genome.ts`).

- **`invoke` may be a factory, but only for config abilities.**
  `Ability.invoke` can be `(params, ctx) => AbilityInvoke[]` instead of a
  static array — the engine calls `resolveInvokes` to resolve it when it
  builds a side's invoke index and again on every param change to that
  ability (`updateAbilityConfig` → `hasDynamicInvokes` in `ability-api.ts`),
  so the list can depend on the ability's own params (see
  `tests/engine/function-invoke.test.ts`). The no-unit external fallback in
  `collectAbilityCandidates` and the OTHER-slot construction in
  `create-game-data.ts` read `ability.invoke` without a side context and treat
  a factory as "no external invokes", and `removeUnitInvokes`'s
  per-unit-death sweep skips candidates that fail `hasStaticInvokes` rather
  than resolving them, since resolving would need per-unit params/ctx it
  doesn't have on that path — so unit-sourced candidates must keep the array
  form (`tests/ability-invariants.test.ts` enforces it). Code that reads
  `ability.invoke` directly as an array (clone-for-rekey copies,
  PREPARE-invoke extraction for Singularity/Ssruu-style copiers) must guard
  with `hasStaticInvokes(ability)` first — see the guards in
  `nekro_virus/index.ts`, `nekro_virus/technological-singularity.ts`,
  `create-tf-singularity.ts`, `ssruu.ts`, `clever-genome.ts`, and the
  the generic `cloneAbility`.

- **Factory `invoke` is re-resolved on every param change** of that ability
  (`updateAbilityConfig`), not only on `isEnabled`/`uses` — `addAbilityInvokes`
  calls `removeInvokeEntries` and then repopulates that ability's entries,
  while a dispatch pass may still be iterating that side's invoke
  collections. Keep factories pure and cheap; never cache by params inside
  them. `tests/engine/function-invoke.test.ts` (the SWITCHER case) is the
  only coverage of this resolve-and-splice path today. Reconcile and the
  engine also don't resolve a factory identically: `reconcileAbilityOrder`
  (`reconcile.ts`) calls it with `sideConfig[key] ?? ability.params` — the
  UI config, no live overlay — while the engine (`abilities-engine.ts`)
  resolves it with the merged base+live params. The two agree before combat
  starts; a factory that branches on a live-overlay-only value would see
  different lists in the two places. `updateAbilityConfig` re-resolves the
  factory BEFORE it runs the ability's `onParamSet`, so a factory must not
  branch on a value that `onParamSet` derives; key it on the raw param the
  caller wrote (Ssruu keys on `agentKey`, Clever Genome on `genomeKey`).

- **Lazy dependencies resolve through lookup calls.** A factory receives a
  `LazyContext` containing only `getFactionKeys()`, `getFaction(key)`, and
  `getAbilities(slot)`.
  `resolveFactions` runs once and recursively initializes the requested faction
  or slot, including lazy dependencies in the same faction. Running initializers
  are consumed before invocation so reentrant lookups can finish other fields
  without restarting them. Dependencies must be acyclic. Runtime `GameData`
  reads only the completed roster and catalog. Nekro uses the context's faction
  keys and excludes itself from its copy sources.

- **Config abilities resolve before unit-attached abilities within a timing
  pass.** A unit ability's PREPARE cannot pre-empt an ADVANCED phase driver's
  PREPARE — e.g. a flagship text zeroing `CAPACITY_COST` runs AFTER the
  capacity driver has already removed the excess units. Model such texts at
  the stats level instead (A Strangled Whisper is the `FREE_CARGO` stat on
  the flagship, consumed by the capacity driver itself, not an invoke).

- **TF unit-upgrade cards MUST register ahead of the base slots.**
  The TF `GameData` entry lists their slots before GENERAL/ADVANCED in its
  `abilities` record (key order is registration order): the cards'
  PREPARE applies the stat block (capacity, Fighter-II-style
  `FLEET_POOL_COST`) that the ADVANCED drivers' own PREPARE enforcement then
  reads — they are the TF analog of TI4's build-time UPGRADED stats. Re-appending them after `base` silently makes
  Capacity/Fleet Pool enforce against the un-upgraded stats (fighters
  removed despite a fleet-pool fallback). Panel display is unaffected —
  slots are grouped and ordered via the system's `SLOTS` config, not list
  order.

- **Never multiply a possibly-infinite stat by a unit count without checking
  the count first.** `Infinity * 0 = NaN` poisons every comparison
  downstream (`computeTotalCapacity` skips zero-count types for exactly this
  reason; a NaN total made capacity cleanup silently stop removing anything
  once the infinite carrier died).

- **`getAssignHitsTargets(n)` returns victims in pool order, most-protected
  first — the TAIL dies first.** The unit spared by cancelling one hit is
  `result[0]`, not `result[n-1]` (see Divinity's `savedByHitCancel`).

- **Out-of-band ability hits need their own wipe check.** When `addHits`
  creates a hit pool outside a dice-roll group, `CombatState.assignHits`
  queues both assignment and `_postAssignHits`. Keep that completion check
  after the destruction cascade; otherwise a Magen Defense Grid wipe resumes
  `START_OF_COMBAT` and rolls combat dice before ending the combat.

- **Direct unit removal must park, drain destruction effects, then check for
  a wipe.** `removeUnits` and `destroyUnits` queue a completion check before
  their ability timing resumes; when already inside a destruction cascade,
  that check belongs at the end of the active group so `AFTER_DESTROY`
  abilities such as Brother Milor still fire. Parking must compare the actual
  next step (`peekStep`), not the next timing (`currentStep`), because a queued
  method-only check otherwise leaves the invoking timing in place and repeats
  it indefinitely (Fragment Reality + Fleet Pool).

- **A blanket restriction stops being blanket once anything is immune to
  it.** `setUnitAbilityRestrictionImmunity(reason, unitType)` makes a
  target-less restriction resolve into the concrete unit types present
  minus the immune ones, so `isAbilityBlocked` (which only reports the
  `'ALL'` case) turns false for that side. Per-type dice collection still
  filters correctly; what slips through is the hard-block path that drops
  config-level `addDiceGroup` decls for a fully-blocked side (see
  `tests/engine/disabled-unit-ability-blocks-custom-dice.test.ts`). Only
  matters when a side fields both an immune unit and a config ability
  adding custom dice for a restricted unit ability.

- **`getAvailableAbilities` returns registration order, not config order.**
  The list feeds the engine, where order drives invoke resolution within a
  timing pass, so it walks the collected abilities (shared decks in
  `index.ts` order, then faction-owned ones) and asks the slot config only
  _whether_ each is visible. The panel iterates `GameData.slots` in display
  order and matches abilities by slot and owner; collected abilities carry
  no presentation or eligibility fields. Reordering the collection to match the config silently moves
  ADVANCED's phase drivers out of their registration position.

- **`getAvailableAbilities` feeds BOTH the panel and the engine.** Hiding a
  slot removes engine behavior, not just UI. The `ADVANCED` slot holds the
  phase drivers (AFB, Space Cannon, Bombardment, Retreat, Fleet Pool,
  Capacity) — never hide it, even for Twilight's Fall.

- **Winning SPACE combat requires participating units.** `_postAssignHits`
  uses `hasAnyUnits` for non-combat metas (so SCO/AFB wipes end things),
  but a would-be winner whose remaining units are all non-participating
  (ferried ground forces, structures) is downgraded to 'draw' in SPACE
  mode — only ship-mechs (Eidolon Maximum, Starlancer XI with ships
  fielded) win via participation. Combat-round wipes and GROUND mode are
  untouched (see `tests/engine/space-combat-winner-participation.test.ts`).

## Reconcile and config

- **The session's game system cannot be inferred from its factions.** Neutral
  exists in both systems; TF Neutral vs Neutral still needs TF genomes and
  must not acquire TI4 mechanics. Pass `system` through setup, simulation input,
  and data lookups; serialize it as `g=TI4` or `g=TF`. Only URL validation infers
  it for legacy links without the field (first recognized non-neutral faction, otherwise
  TI4); explicit systems validate both factions against their own roster.
  The `combatTest` shorthand defaults to TI4; every TF test must set
  `system: 'TF'` explicitly. See
  `tests/game-system.test.ts` for URL and worker regression coverage.

- **`resetSettingsToBase` intentionally does NOT re-apply
  `declareParamChange`.** The asymmetry with `resetBaseGroups` is
  load-bearing (Alastor/Eidolon tests). If an ability needs its
  participation change to survive into the engine run, restore it at
  runtime in its PREPARE (see Hel-Titan's `onPrepare`).

- **`declareParamChange` additions to DERIVED settings groups survive only
  because `resetBaseGroups` re-applies them after `onParamSet`.** The
  derivation (`ships` → `spaceCombatParticipating`, etc.) recomputes derived
  groups from the base groups, clobbering anything pushed into them earlier
  in the pass. Base-group targets (Hel-Titan's `groundForces`) never hit
  this; derived-group targets (Starlancer XI's `spaceCombatParticipating`)
  rely on the post-derivation re-apply — don't remove it.

- **`declareParam` sourced params sync only at reconcile — but the reconciled
  value SURVIVES into the engine run.** A runtime `updateAbilityConfig` to a
  source list (e.g. `SETTINGS.spaceCombatParticipating`) does not propagate to
  params sourced from it (fleet pool, sustain priorities, unit priority).
  When the addition came from a `declareParamChange` at reconcile, the
  dependent lists already contain it and `resetSettingsToBase` does not touch
  them — only the SETTINGS group itself needs the runtime restore (Starlancer
  XI restores `spaceCombatParticipating` in PREPARE and nothing else). Update
  a dependent ability's config at runtime only for additions that never went
  through reconcile.

- **`SETTINGS.ships` and `SETTINGS.spaceCombatParticipating` are distinct.**
  `ships` cascades (via `onParamSet`) into `nonFighterShips`,
  `spaceCombatParticipating`, and SCO targets; setting
  `spaceCombatParticipating` directly grants combat participation WITHOUT
  ship-ness (fleet pool, capacity, SCO targeting untouched) — that's how
  Starlancer XI mechs fight in space from the ground.

- **Capacity and Fleet Pool split Fighter-II-style cargo between them.**
  Units with BOTH `CAPACITY_COST` and `FLEET_POOL_COST` (Fighter II, the TF
  fighter cards) fill ship capacity first; only the excess is priced by the
  fleet-pool driver. Capacity enforcement therefore EXCLUDES them from its
  cost total — counting them would evict other cargo (infantry) for an
  overflow the fleet pool already handles — and the fleet-pool driver
  measures the excess against the ships' PRINTED capacity even when the
  Capacity enforcement toggle is off (the toggle governs removal of illegal
  cargo, not how much capacity the ships have).

- **Sustain Damage has per-mode allow-lists.** A unit sustains only if its
  variant is in `SUSTAIN_DAMAGE.spacePriority` / `groundPriority` (sourced
  from `nonFighterShips` / `groundForces`). A unit added to combat outside
  those lists silently cannot sustain in that mode.

- **Hit-assignment order: the FRONT of `UNIT_PRIORITY.*UnitPriority` takes
  hits first.** The default list is worth-ascending, so fighters sit FIRST
  and die first. Prepend to make a unit the default hit-soaker; append to
  protect it. (Verified empirically — an earlier version of this entry had
  it backwards. Same direction in phase-priority overrides: GLS's
  `fightersLast` moves fighters to the end to PROTECT them.)

## Combat engine

- **Unlimited-use repair is the only thing that makes the state graph
  cyclic.** Without it, combat state decreases monotonically (units are
  damaged or destroyed, never restored), so the graph is a DAG and
  `subtreeCache` hits every state exactly once. Duranium Armor
  (`uses: Infinity` + `isDamaged: false`) can return the state to an earlier
  one, creating multi-node SCCs. Limited-use repair (Emergency Repairs) is
  safe — the use count strictly decreases. Before adding an always-on repair
  ability, expect a state-space cost.

- **A cached entry with non-empty `deferred` is context-dependent.**
  `deferred[k] = p` means "mass p re-enters ancestor k", so the entry is only
  usable while every such k is still in `inProgress` to absorb it. Self-loops
  resolve locally in `finalize`; longer cycles defer to a distant ancestor,
  and when that ancestor finalizes the entry goes stale. Do not simply
  discard it — `resolveEntry` substitutes the dependency's own distribution
  via `value(v) = outcomes(v) + Σ deferred(v)[k] · value(k)`, which is exact
  and, when nothing is left owing, makes the entry unconditional (so it is
  repaired at most once).

- **"Substitutable" is broader than "unconditional" — this distinction is the
  whole ballgame.** A dependency that owes mass _only to ancestors still in
  flight_ can be folded into its caller as-is: doing so hands that debt to
  the same ancestors the mass was already headed for. Treating such a
  dependency as unresolvable (because it is not yet unconditional) rejected
  83% of repairs and left a 1.41x re-expansion per state. Honouring it takes
  expansions to exactly one per unique state — the optimum a full SCC solve
  would reach, without the linear algebra.

## Dice-math kernel

- **All conditional ±1 flips resolve in ONE joint pass after the attacker ×
  defender cross-product.** Positive flips act on natural misses, negative
  on natural hits (disjoint pools); a die flipped once is never re-targeted.
  Never add a second sequential pass — it re-enumerates faces the first
  pass already resolved (the Heart of Ixth + Meddle 68%-vs-70% class of
  bug). Details in `docs/dice-math.md` §5c.

- **Reroll budgets are fungible within a pool; billing debits cards in
  sorted-key order.** A 2-use card may legally spend both uses on one die
  (Wrath of Kenara). Don't impose distinct-card constraints.

- **`abilityLog` does not capture dice-roll abilities.** Verify anything
  that feeds the kernel (rerolls, conditionals, roll triggers) via branch
  probabilities (`toHaveBranches`), not log entries.

## Test harness

- **Explicit test params for `declareParam` lists REPLACE the reconciled
  value.** `prepareSimulationConfig` snapshots user-supplied params before
  reconcile and restores them verbatim after, so a test passing
  `targets: [['FIGHTER', false]]` gets exactly that one-entry list — the
  other fielded types are NOT appended with their defaults. Always pass the
  COMPLETE list when overriding a synced list param in a test.

- **`advanceRound` hit specs are hits RECEIVED, not produced.**
  `advanceRound({ attacker: 2 })` picks the branch where the attacker's
  units take 2 hits. Same convention in `DICE_HITS` log entries.

- **Unit ids are non-printable characters.** `JSON.stringify` /
  assertion-diff dumps of `participatingUnits`, `unitType`, etc. render as
  empty strings and duplicate-looking keys. Probe with `.length`, or map
  ids through `unitType` to readable names.

- **`t.attacker.units` reads only pooled units.** A unit removed from both
  `participatingUnits` and `nonParticipatingUnits` vanishes from the side
  view even though stale `unitType` entries remain — absence from the view
  does not mean the unit was destroyed.

- **`console.log` is swallowed by the vitest config.** For one-off probes,
  assert `expect(payload).toEqual('SHOW')` and read the diff, or write a
  temporary `_probe.test.ts` (delete it afterwards).

## UI config and data modules

- **`select` uiConfig item values must be NON-EMPTY strings.** Store the
  param as a string union (`'1' | '2' | '3'`) and `Number()` it at the use
  site (see Bone Picked Clean's spend threshold). Radix Select throws on
  `value: ''` the moment the panel renders — use a sentinel like `'none'`
  for a "nothing selected" option (see TF Supercharge, Clever Genome).

- **`UnitList` entries are flat keys or tuples — match the existing shape
  when appending**, and remember `unwrapUnitListKeys` decides tuple-ness
  from the FIRST entry.

- **Inherit printed upgrade stats, not runtime unit stats.** TF Janovet reads
  the native stat blocks exposed by `createStatsInvoke` through the runtime
  `UNIT_UPGRADE_<TYPE>` lookups — one slot per unit type (`isStatsInvoke`
  narrows the tagged entries). Reading
  `getUnitStats` instead would also copy unrelated PREPARE modifiers. Keep
  shared text helpers independent of faction/deck modules to avoid import
  cycles (see `faces-of-janovet.ts` and `janovet-inherits.ts`).
