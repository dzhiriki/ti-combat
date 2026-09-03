import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import councilKeleresIcon from '@/assets/faction/council_keleres.svg?raw'
import crimsonRebellionIcon from '@/assets/faction/crimson_rebellion.svg?raw'
import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import ghostsOfCreussIcon from '@/assets/faction/ghosts_of_creuss.svg?raw'
import l1z1xMindnetIcon from '@/assets/faction/l1z1x_mindnet.svg?raw'
import lastBastionIcon from '@/assets/faction/last_bastion.svg?raw'
import mentakCoalitionIcon from '@/assets/faction/mentak_coalition.svg?raw'
import naazRokhaAllianceIcon from '@/assets/faction/naaz_rokha_alliance.svg?raw'
import nekroVirusIcon from '@/assets/faction/nekro_virus.svg?raw'
import nomadIcon from '@/assets/faction/nomad.svg?raw'
import obsidianIcon from '@/assets/faction/obsidian.svg?raw'
import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import titansOfUlIcon from '@/assets/faction/titans_of_ul.svg?raw'
import universitiesOfJolNarIcon from '@/assets/faction/universities_of_jol_nar.svg?raw'
import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import yssarilTribesIcon from '@/assets/faction/yssaril_tribes.svg?raw'
import {
  type Ability,
  hasStaticInvokes,
  type RegisteredAbility,
} from '@/combat'
import { UNIT_DISPLAY_NAMES } from '@/constants/units'
import { solarFlare } from '@/data/main/abilities/action-card/solar-flare'
import { heartOfIxth } from '@/data/main/abilities/relic/heart-of-ixth'
import { raidFormation } from '@/data/main/faction/argent_flight/raid-formation'
import { trrakanAunZulok } from '@/data/main/faction/argent_flight/trrakan-aun-zulok'
import { munitionsReserves } from '@/data/main/faction/barony_of_letnev/munitions-reserves'
import { nonEuclideanShielding } from '@/data/main/faction/barony_of_letnev/non-euclidean-shielding'
import { viscountUnlenn } from '@/data/main/faction/barony_of_letnev/viscount-unlenn'
import { overwingZeta } from '@/data/main/faction/council_keleres/overwing-zeta'
import { fragmentReality } from '@/data/main/faction/crimson_rebellion/fragment-reality'
import { evelynDelouis } from '@/data/main/faction/federation_of_sol/evelyn-delouis'
import { dimensionalSplicer } from '@/data/main/faction/ghosts_of_creuss/dimensional-splicer'
import { harrow } from '@/data/main/faction/l1z1x_mindnet/harrow'
import { ambush } from '@/data/main/faction/mentak_coalition/ambush'
import { sleeperCell } from '@/data/main/faction/mentak_coalition/sleeper-cell'
import { thundarian } from '@/data/main/faction/nomad/thundarian'
import { ghomSekkus } from '@/data/main/faction/sardakk_norr/ghom-sekkus'
import { unrelenting } from '@/data/main/faction/sardakk_norr/unrelenting'
import { valkyrieParticleWeave } from '@/data/main/faction/sardakk_norr/valkyrie-particle-weave'
import { tellurian } from '@/data/main/faction/titans_of_ul/tellurian'
import { agnlanOln } from '@/data/main/faction/universities_of_jol_nar/agnlan-oln'
import { devotion } from '@/data/main/faction/yin_brotherhood/devotion'
import { indoctrination } from '@/data/main/faction/yin_brotherhood/indoctrination'
import { createTfSingularity } from '@/data/tf/abilities/ability/create-tf-singularity'
import { planesplitter } from '@/data/tf/abilities/ability/planesplitter'
import { proximaTargetingVi } from '@/data/tf/abilities/ability/proxima-targeting-vi'
import { smotheringPresence } from '@/data/tf/abilities/ability/smothering-presence'
import { supercharge } from '@/data/tf/abilities/ability/supercharge'
import { tfTemporalCommandSuite } from '@/data/tf/abilities/ability/temporal-command-suite'
import { atomize } from '@/data/tf/abilities/action-card/atomize'
import { converge } from '@/data/tf/abilities/action-card/converge'
import { divinity } from '@/data/tf/abilities/action-card/divinity'
import { feint } from '@/data/tf/abilities/action-card/feint'
import { hardlight } from '@/data/tf/abilities/action-card/hardlight'
import { lash } from '@/data/tf/abilities/action-card/lash'
import { meld } from '@/data/tf/abilities/action-card/meld'
import { spark } from '@/data/tf/abilities/action-card/spark'
import { cleverGenome } from '@/data/tf/abilities/genome/clever-genome'
import { mirrorGenome } from '@/data/tf/abilities/genome/mirror-genome'
import { splittingGenome } from '@/data/tf/abilities/genome/splitting-genome'
import { valiantGenome } from '@/data/tf/abilities/genome/valiant-genome'
import { intelligenceUnshackled } from '@/data/tf/abilities/paradigm/intelligence-unshackled'
import { TF_UNIT_UPGRADE_ENTRIES } from '@/data/tf/abilities/unit-upgrade'

// Twilight's Fall replaces TI4's faction-locked kit with shared draw decks —
// Abilities, Genomes, Paradigms, Action Cards, Unit Upgrades — that any TF
// faction can hold. Mechanically most combat-relevant TF cards mirror an
// existing TI4 ability *exactly* (same effect AND timing window), so we reuse
// that implementation under the TF name. Only reuse when the timing window
// also matches; TF cards whose window differs (e.g. Hardlight vs Shields
// Holding) need their own implementation and are intentionally not here yet.
// `icon` is the ORIGINATING TI4/TE faction's logo — TF's shared decks are
// drawn from those factions' kits, and the logo shows a card's provenance at
// a glance.
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
      indoctrination,
      'Indoctrination',
      "At the start of a ground combat: You may spend 2 influence to replace 1 of your opponent's participating infantry with 1 infantry from your reinforcements.",
      yinBrotherhoodIcon,
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
  // Bespoke TF implementations (mechanics differ from the TI4/TE cards of the
  // same name — see each file's header comment).
  {
    slot: 'TF_ABILITY',
    ability: { ...planesplitter, icon: obsidianIcon },
  },
  {
    slot: 'TF_ABILITY',
    ability: { ...proximaTargetingVi, icon: lastBastionIcon },
  },
  {
    slot: 'TF_ABILITY',
    ability: { ...smotheringPresence, icon: crimsonRebellionIcon },
  },
  {
    slot: 'TF_ABILITY',
    ability: { ...supercharge, icon: naazRokhaAllianceIcon },
  },
  {
    slot: 'TF_ABILITY',
    // Clever Genome IS a row of its own: as a separate ability instance it
    // fires the copied text a SECOND time in the same timing window (2×
    // Splitting Genome on one destruction), which extra uses on the copied
    // genome cannot do — the engine runs a config ability once per pass.
    // Its tokens ready the Clever card itself; which text it fires stays
    // governed by the Clever panel's own genome dropdown.
    ability: { ...tfTemporalCommandSuite, icon: nomadIcon },
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
      ghomSekkus,
      'Valkyrie Vanguard',
      'During the "Commit Ground Forces" step: You can commit up to 1 ground force from each planet in the active system and each planet in adjacent systems that do not contain 1 of your command tokens.',
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

// Singularity X / Y / Z copy from the Abilities deck only (never unit
// upgrades or singularities themselves — see `copyables` in
// create-tf-singularity.ts).
const tfSingularities: RegisteredAbility[] = (['X', 'Y', 'Z'] as const).map(
  letter => ({
    slot: 'TF_ABILITY' as const,
    ability: { ...createTfSingularity(letter), icon: nekroVirusIcon },
  }),
)

const byName = (a: RegisteredAbility, b: RegisteredAbility) =>
  a.ability.name.localeCompare(b.ability.name)

// ── Genomes (agent-style exhaust effects), alphabetized ────────────────
// Clever Genome (the TF Ssruu) copies the text of one other genome from the
// side's registered TF_GENOME abilities at runtime, so it joins the deck
// alongside them like any other genome.
const tfGenomes: RegisteredAbility[] = [
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
    ability: { ...cleverGenome, icon: yssarilTribesIcon },
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
  {
    slot: 'TF_GENOME',
    ability: brand(
      thundarian,
      'Temporal Genome',
      'After the "Roll Dice" step of combat: You may exhaust this card. If you do, hits are not assigned to either player\'s units. Return to the start of this combat round\'s "Roll Dice" step.',
      nomadIcon,
    ),
  },
  { slot: 'TF_GENOME', ability: { ...valiantGenome, icon: lastBastionIcon } },
]
tfGenomes.sort(byName)

export const TF_SHARED_REGISTERED: readonly RegisteredAbility[] = [
  ...[...tfAbilities, ...tfSingularities].sort(byName),
  ...tfGenomes,

  // ── Paradigms (hero-style, once per combat) ──────────────────────────
  // The ship-placement paradigms reuse the matching hero implementations:
  // placing ships at the start of combat differs from fielding them from the
  // outset (they dodge Space Cannon Offense and other pre-combat effects).
  {
    slot: 'TF_PARADIGM',
    ability: brand(
      overwingZeta,
      'Artemiris Ascendant',
      'At the start of a round of space combat in a system that contains a planet you control: Place your flagship and any combination of up to 2 cruisers or destroyers from your reinforcements into the active system. Then, purge this card.',
      councilKeleresIcon,
    ),
  },
  {
    slot: 'TF_PARADIGM',
    ability: brand(
      fragmentReality,
      'Dimensional Reflection',
      'When you produce ships: You may place any of those ships onto this card. At the start of combat, you may purge this card to place all ships from this card into the active system.',
      crimsonRebellionIcon,
    ),
  },
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
  { slot: 'TF_ACTION_CARD', ability: feint },
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
      invoke: hasStaticInvokes(heartOfIxth)
        ? heartOfIxth.invoke.map(inv => ({ ...inv }))
        : heartOfIxth.invoke,
    },
  },
  { slot: 'TF_ACTION_CARD', ability: meld },
  { slot: 'TF_ACTION_CARD', ability: spark },

  // ── Unit Upgrades ────────────────────────────────────────────────────
  // The deck spans every unit type, so each card carries its unit type as the
  // panel sub-header (the list is already ordered by unit type — see the deck).
  ...TF_UNIT_UPGRADE_ENTRIES.map(
    ({ unitType, ability }) =>
      ({
        slot: 'TF_UNIT_UPGRADE',
        subcategory: UNIT_DISPLAY_NAMES[unitType],
        ability,
      }) as RegisteredAbility,
  ),
]
