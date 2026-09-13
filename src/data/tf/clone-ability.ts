import {
  type Ability,
  cloneAbility as cloneBaseAbility,
  isDeclaredParam,
} from '@/combat'

// Twilight's Fall replaces TI4's faction-locked kit with shared draw decks —
// Abilities, Genomes, Paradigms, Action Cards, Unit Upgrades — that any TF
// faction can hold. Mechanically most combat-relevant TF cards mirror an
// existing TI4 ability *exactly* (same effect AND timing window), so we reuse
// that implementation under the TF name. Only reuse when the timing window
// also matches; TF cards whose window differs (e.g. Hardlight vs Shields
// Holding) need their own implementation and are intentionally not cloned.
// `icon` is the ORIGINATING TI4/TE faction's logo — TF's shared decks are
// drawn from those factions' kits, and the logo shows a card's provenance at
// a glance — so pass it only when the source ability doesn't carry it yet.
//
// Every clone carries its own `TF_`-prefixed key (passed by the caller), so
// a TF card never shares a key with the TI4 ability it reuses. Invoke entries
// are cloned too: the engine dedups "already invoked" by invoke object
// identity, so a clone sharing them with its source (or with another clone)
// would let only one of them fire per window.
export function cloneAbility(
  ability: Ability,
  overrides: Partial<Ability> & { key: string },
): Ability {
  const cloned = cloneBaseAbility(ability, overrides)
  cloned.params = rekeySubtypeSources(cloned.params, ability.key, overrides.key)
  // TF abilities are optional draws from a shared deck — unlike their TI4
  // counterparts, none are always-on. Strip read-only locks and, unless the
  // card is a uses-counter (0 = unused), give it a simple on/off toggle that
  // defaults to off so it only applies when the player has enabled it. Many
  // TI4 faction abilities are force-on (Unrelenting) or have no header at all
  // (Raid Formation) — both must become opt-in here.
  if (cloned.readOnly) cloned.readOnly = false
  if (cloned.headerUI !== 'uses') {
    cloned.headerUI = 'isEnabled'
    if (cloned.params.isEnabled) {
      cloned.params = { ...cloned.params, isEnabled: false }
    }
  }
  return cloned
}

/** Declared subtypes are stamped with the declaring ability's key, and an
 *  ability that hides its own declarations does so by listing that key in
 *  `filter.excludeSubtypeSource` (Viscount Unlenn, Evelyn Delouis). Point
 *  such entries at the clone's key so it keeps hiding its own subtype. */
function rekeySubtypeSources(
  params: Ability['params'],
  from: string,
  to: string,
): Ability['params'] {
  let out = params
  for (const [paramKey, value] of Object.entries(params)) {
    if (!isDeclaredParam(value)) continue
    const sources = value.filter?.excludeSubtypeSource
    if (!sources?.includes(from)) continue
    out = {
      ...out,
      [paramKey]: {
        ...value,
        filter: {
          ...value.filter,
          excludeSubtypeSource: sources.map(s => (s === from ? to : s)),
        },
      },
    }
  }
  return out
}
