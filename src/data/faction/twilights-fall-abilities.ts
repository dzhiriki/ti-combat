import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import ghostsOfCreussIcon from '@/assets/faction/ghosts_of_creuss.svg?raw'
import l1z1xMindnetIcon from '@/assets/faction/l1z1x_mindnet.svg?raw'
import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import mentakCoalitionIcon from '@/assets/faction/mentak_coalition.svg?raw'
import nekroVirusIcon from '@/assets/faction/nekro_virus.svg?raw'
import obsidianIcon from '@/assets/faction/obsidian.svg?raw'
import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import titansOfUlIcon from '@/assets/faction/titans_of_ul.svg?raw'
import universitiesOfJolNarIcon from '@/assets/faction/universities_of_jol_nar.svg?raw'
import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import type { Ability, RegisteredAbility } from '@/combat'
import { solarFlare } from '@/data/abilities/action-card/solar-flare'
import { heartOfIxth } from '@/data/abilities/relic/heart-of-ixth'
import {
  collectCopyable,
  createTfSingularity,
} from '@/data/abilities/tf-ability/create-tf-singularity'
import { atomize } from '@/data/abilities/tf-action-card/atomize'
import { converge } from '@/data/abilities/tf-action-card/converge'
import { divinity } from '@/data/abilities/tf-action-card/divinity'
import { hardlight } from '@/data/abilities/tf-action-card/hardlight'
import { lash } from '@/data/abilities/tf-action-card/lash'
import { spark } from '@/data/abilities/tf-action-card/spark'
import { mirrorGenome } from '@/data/abilities/tf-genome/mirror-genome'
import { splittingGenome } from '@/data/abilities/tf-genome/splitting-genome'
import { valiantGenome } from '@/data/abilities/tf-genome/valiant-genome'
import { intelligenceUnshackled } from '@/data/abilities/tf-paradigm/intelligence-unshackled'
import { TF_UNIT_UPGRADES } from '@/data/abilities/tf-unit-upgrade'

import { raidFormation } from './argent_flight/raid-formation'
import { trrakanAunZulok } from './argent_flight/trrakan-aun-zulok'
import { munitionsReserves } from './barony_of_letnev/munitions-reserves'
import { nonEuclideanShielding } from './barony_of_letnev/non-euclidean-shielding'
import { viscountUnlenn } from './barony_of_letnev/viscount-unlenn'
import { evelynDelouis } from './federation_of_sol/evelyn-delouis'
import { dimensionalSplicer } from './ghosts_of_creuss/dimensional-splicer'
import { harrow } from './l1z1x_mindnet/harrow'
import { ambush } from './mentak_coalition/ambush'
import { sleeperCell } from './mentak_coalition/sleeper-cell'
import { unrelenting } from './sardakk_norr/unrelenting'
import { valkyrieParticleWeave } from './sardakk_norr/valkyrie-particle-weave'
import { tellurian } from './titans_of_ul/tellurian'
import { agnlanOln } from './universities_of_jol_nar/agnlan-oln'
import { devotion } from './yin_brotherhood/devotion'

// Twilight's Fall replaces TI4's faction-locked kit with shared draw decks —
// Abilities, Genomes, Paradigms, Action Cards, Unit Upgrades — that any TF
// faction can hold. Mechanically most combat-relevant TF cards mirror an
// existing TI4 ability *exactly* (same effect AND timing window), so we reuse
// that implementation under the TF name. Only reuse when the timing window
// also matches; TF cards whose window differs (e.g. Hardlight vs Shields
// Holding) need their own implementation and are intentionally not here yet.
// `icon` is the ORIGINATING TI4/TE faction's logo (per the ti4lookup CSVs'
// faction id column) — TF's shared decks are drawn from those factions' kits,
// and the logo shows a card's provenance at a glance.
function brand(
  ability: Ability,
  name: string,
  description: string,
  icon?: string,
): Ability {
  const branded: Ability = { ...ability, name, description, icon }
  // TF abilities are optional draws from a shared deck — unlike their TI4
  // counterparts, none are always-on. Strip read-only locks and, unless the
  // card is a uses-counter (0 = unused), give it a simple on/off toggle that
  // defaults to off so it only applies when the player has enabled it. Many
  // TI4 faction abilities are force-on (Unrelenting) or have no header at all
  // (Raid Formation) — both must become opt-in here.
  if (branded.readOnly) branded.readOnly = false
  if (branded.headerUI !== 'uses') {
    branded.headerUI = 'isEnabled'
    if (branded.params.isEnabled) {
      branded.params = { ...branded.params, isEnabled: false }
    }
  }
  return branded
}

// The Abilities deck (what Singularity may copy from), alphabetized.
const tfAbilities: RegisteredAbility[] = [
  {
    slot: 'TF_ABILITY',
    ability: brand(
      ambush,
      'Ambush',
      'At the start of a space combat: You may roll 1 die for each of up to 2 of your cruisers or destroyers in the system. For each result equal to or greater than that ship’s combat value, produce 1 hit; your opponent must assign it to 1 of their ships.',
      mentakCoalitionIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      devotion,
      'Devotion',
      'After each space combat round: You may destroy 1 of your cruisers or destroyers in the active system to produce 1 hit and assign it to 1 of your opponent’s ships.',
      yinBrotherhoodIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      dimensionalSplicer,
      'Dimensional Splicer',
      'At the start of a space combat in a system that contains a wormhole and 1 or more of your ships: You may produce 1 hit and assign it to 1 of your opponent’s ships.',
      ghostsOfCreussIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      harrow,
      'Harrow',
      'At the end of each round of ground combat: Your ships in the active system may use their Bombardment abilities against your opponent’s ground forces.',
      l1z1xMindnetIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      munitionsReserves,
      'Munitions Reserves',
      'At the start of each round of space combat: You may spend 2 trade goods; you may reroll any number of your dice during that combat round.',
      baronyOfLetnevIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      nonEuclideanShielding,
      'Non-Euclidean Shielding',
      'When 1 of your units uses Sustain Damage: Cancel 2 hits instead of 1.',
      baronyOfLetnevIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      raidFormation,
      'Raid Formation',
      'When 1 or more of your units use Anti-Fighter Barrage: For each hit produced in excess of your opponent’s fighters, choose 1 of your opponent’s ships that has Sustain Damage to become damaged.',
      argentFlightIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      agnlanOln,
      'Tactical Brilliance',
      'After you roll dice for a unit ability: You may reroll any of those dice.',
      universitiesOfJolNarIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      unrelenting,
      'Unrelenting',
      "Apply +1 to the result of each of your unit's combat rolls.",
      sardakkNorrIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      valkyrieParticleWeave,
      'Valkyrie Particle Weave',
      'After making combat rolls during a round of ground combat: If your opponent produced 1 or more hits, you produce 1 additional hit.',
      sardakkNorrIcon,
    ),
  },
  {
    slot: 'TF_ABILITY',
    ability: brand(
      trrakanAunZulok,
      'Zealous',
      'When 1 or more of your units roll dice for a unit ability: You may choose 1 of those units to roll 1 additional die.',
      argentFlightIcon,
    ),
  },
]

// Singularity X / Y / Z copy from the Abilities deck only (never unit upgrades,
// and — since they are built from `tfAbilities` — never each other).
const tfSingularities: RegisteredAbility[] = (['X', 'Y', 'Z'] as const).map(
  letter => ({
    slot: 'TF_ABILITY' as const,
    ability: {
      ...createTfSingularity(
        letter,
        tfAbilities.map(r => collectCopyable(r.ability)),
      ),
      icon: nekroVirusIcon,
    },
  }),
)

const byName = (a: RegisteredAbility, b: RegisteredAbility) =>
  a.ability.name.localeCompare(b.ability.name)

// ── Genomes (agent-style exhaust effects), alphabetized ────────────────
const tfGenomesUnsorted: RegisteredAbility[] = [
  {
    slot: 'TF_GENOME',
    ability: brand(
      tellurian,
      'Altruistic Genome',
      'When a hit is produced against a unit: You may exhaust this card to cancel that hit.',
      titansOfUlIcon,
    ),
  },
  {
    slot: 'TF_GENOME',
    ability: brand(
      viscountUnlenn,
      'Aristocratic Genome',
      'At the start of a space combat round: You may exhaust this card to choose 1 ship in the active system; that ship rolls 1 additional die during this combat round.',
      baronyOfLetnevIcon,
    ),
  },
  {
    slot: 'TF_GENOME',
    ability: brand(
      evelynDelouis,
      'Human Genome',
      'At the start of a round of ground combat: You may exhaust this card to choose 1 ground force in the active system; that ground force rolls 1 additional die during this combat round.',
      federationOfSolIcon,
    ),
  },
  { slot: 'TF_GENOME', ability: { ...mirrorGenome, icon: obsidianIcon } },
  {
    slot: 'TF_GENOME',
    ability: { ...splittingGenome, icon: yinBrotherhoodIcon },
  },
  { slot: 'TF_GENOME', ability: { ...valiantGenome, icon: lastBastionIcon } },
]
const tfGenomes = tfGenomesUnsorted.sort(byName)

export const TF_SHARED_REGISTERED: readonly RegisteredAbility[] = [
  ...[...tfAbilities, ...tfSingularities].sort(byName),
  ...tfGenomes,

  // ── Paradigms (hero-style, once per combat) ──────────────────────────
  // Ship-placement paradigms (Artemiris Ascendant, Dimensional Reflection) are
  // omitted — they just add ships, which is expressed by the starting fleet.
  {
    slot: 'TF_PARADIGM',
    ability: brand(
      sleeperCell,
      'Insurrection',
      "At the start of a space combat you are participating in: For each other player's ship destroyed during this combat, place 1 ship of that type from your reinforcements in the active system.",
      mentakCoalitionIcon,
    ),
  },
  {
    slot: 'TF_PARADIGM',
    ability: { ...intelligenceUnshackled, icon: lastBastionIcon },
  },

  // ── Action Cards ─────────────────────────────────────────────────────
  // Bespoke TF implementations (timing windows / combat modes differ from any
  // TI4 card).
  { slot: 'TF_ACTION_CARD', ability: atomize },
  // Reused where the TI4 analog matches mechanic AND timing exactly.
  {
    slot: 'TF_ACTION_CARD',
    ability: brand(
      solarFlare,
      'Cloak',
      'After you activate a system: Space Cannon cannot be used against your ships during this movement.',
    ),
  },
  { slot: 'TF_ACTION_CARD', ability: converge },
  { slot: 'TF_ACTION_CARD', ability: divinity },
  { slot: 'TF_ACTION_CARD', ability: hardlight },
  { slot: 'TF_ACTION_CARD', ability: lash },
  {
    slot: 'TF_ACTION_CARD',
    // Same effect as the Heart of Ixth relic, but a distinct key so a faction
    // may hold both Meddle (action card) and Heart of Ixth (relic). The invoke
    // entries are cloned so each has its own object identity — the engine dedups
    // "already invoked" by invoke identity, so sharing them would let only one
    // of the two ±1 flips fire.
    ability: {
      ...heartOfIxth,
      key: 'TF_MEDDLE',
      name: 'Meddle',
      description: 'When any die is rolled: Add or subtract 1 from its result.',
      invoke: heartOfIxth.invoke.map(inv => ({ ...inv })),
    },
  },
  { slot: 'TF_ACTION_CARD', ability: spark },

  // ── Unit Upgrades ────────────────────────────────────────────────────
  ...TF_UNIT_UPGRADES.map(
    ability => ({ slot: 'TF_UNIT_UPGRADE', ability }) as RegisteredAbility,
  ),
]
