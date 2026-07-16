import arborecIcon from '@/assets/faction/arborec.svg?raw'
import argentFlightIcon from '@/assets/faction/argent_flight.svg?raw'
import baronyOfLetnevIcon from '@/assets/faction/barony_of_letnev.svg?raw'
import councilKeleresIcon from '@/assets/faction/council_keleres.svg?raw'
import crimsonRebellionIcon from '@/assets/faction/crimson_rebellion.svg?raw'
import deepwroughtScholarateIcon from '@/assets/faction/deepwrought_scholarate.svg?raw'
import embersOfMuaatIcon from '@/assets/faction/embers_of_muaat.svg?raw'
import empyreanIcon from '@/assets/faction/empyrean.svg?raw'
import federationOfSolIcon from '@/assets/faction/federation_of_sol.svg?raw'
import ghostsOfCreussIcon from '@/assets/faction/ghosts_of_creuss.svg?raw'
import l1z1xMindnetIcon from '@/assets/faction/l1z1x_mindnet.svg?raw'
import mentakCoalitionIcon from '@/assets/faction/mentak_coalition.svg?raw'
import naaluCollectiveIcon from '@/assets/faction/naalu_collective.svg?raw'
import naazRokhaAllianceIcon from '@/assets/faction/naaz_rokha_alliance.svg?raw'
import nomadIcon from '@/assets/faction/nomad.svg?raw'
import obsidianIcon from '@/assets/faction/obsidian.svg?raw'
import ralNelIcon from '@/assets/faction/ral_nel.svg?raw'
import sardakkNorrIcon from '@/assets/faction/sardakk_norr.svg?raw'
import titansOfUlIcon from '@/assets/faction/titans_of_ul.svg?raw'
import universitiesOfJolNarIcon from '@/assets/faction/universities_of_jol_nar.svg?raw'
import vuilraithCabalIcon from '@/assets/faction/vuilraith_cabal.svg?raw'
import winnuIcon from '@/assets/faction/winnu.svg?raw'
import xxchaKingdomIcon from '@/assets/faction/xxcha_kingdom.svg?raw'
import yinBrotherhoodIcon from '@/assets/faction/yin_brotherhood.svg?raw'
import yssarilTribesIcon from '@/assets/faction/yssaril_tribes.svg?raw'
import type { Ability } from '@/combat'

import {
  createTfUnitUpgrade,
  type TfUnitUpgradeConfig,
} from './create-tf-unit-upgrade'
import { exotriremeSelfDestructInvoke } from './exotrireme'
import { helTitanDeclareParamChange, helTitanOnPrepare } from './hel-titan'
import { linkshipRetreatInvoke } from './linkship-retreat'
import { strikeWingAlphaAfbInvoke } from './strike-wing-alpha'

// The Twilight's Fall unit-upgrade deck. Each card overrides the stats of one
// generic unit type. Non-mech upgrades are mutually exclusive per unit type
// (up to one cruiser card, one carrier card, etc. — enforced via a per-type
// exclusiveGroup); mech upgrades stack. Stats sourced from the ti4lookup CSVs
// (twilights fall unit variants).
//
// `description` is set only when a card has a combat-affecting rule *beyond*
// its stat/ability changes (e.g. Strike Wing Alpha's AFB bonus). Plain stat
// upgrades carry no description so the UI shows nothing redundant. Capacity
// changes count (the capacity phase reads them), so every carrier card is
// present; only cards whose sole differences are movement / production / cost
// are omitted: all space-dock variants and Valefar Prime (mech cost).
//
// Array order IS display order: buckets follow the UI's unit ordering
// (UNIT_TYPES — Flagship, War Sun, Dreadnought, Carrier, Cruiser, Destroyer,
// Fighter, Mech, Infantry, PDS), and cards are alphabetical within a bucket.
export const TF_UNIT_UPGRADE_CONFIGS: readonly TfUnitUpgradeConfig[] = [
  // ── Flagship ─────────────────────────────────────────────────────────
  // Relative to each faction's own flagship, so applied as adjustments
  // rather than a stat block.
  {
    key: 'TF_UPGRADE_ECHO_OF_ASCENSION',
    icon: nomadIcon,
    name: 'Echo of Ascension',
    description:
      'Adjust the printed values of your flagship: its MOVE value is increased by 1, its COMBAT value is reduced by 1, it rolls 1 additional die during combat, and its CAPACITY value is increased by 2.',
    unitType: 'FLAGSHIP',
    apply: ctx => {
      const stats = ctx.api.own.getUnitStats('FLAGSHIP')
      if (!stats?.COMBAT) return
      ctx.api.own.modifyUnitType('FLAGSHIP', {
        COMBAT: [Math.max(1, stats.COMBAT[0] - 1), (stats.COMBAT[1] ?? 1) + 1],
        MOVE: (stats.MOVE ?? 0) + 1,
        CAPACITY: (stats.CAPACITY ?? 0) + 2,
      })
    },
  },

  // ── War Suns ─────────────────────────────────────────────────────────
  {
    key: 'TF_UPGRADE_PROTOTYPE_WAR_SUN',
    icon: embersOfMuaatIcon,
    name: 'Prototype War Sun',
    description: "Other players' units in this system lose Planetary Shield.",
    unitType: 'WAR_SUN',
    cost: 12,
    combat: [3, 3],
    move: 2,
    capacity: 6,
    sustain: true,
    bombardment: [3, 3],
    disablePlanetaryShield: true,
  },
  {
    key: 'TF_UPGRADE_THE_DRAGON_FREED',
    icon: obsidianIcon,
    name: 'The Dragon, Freed',
    description:
      'When this unit uses Bombardment, it uses it against every planet in its system and adjacent systems, ignoring Planetary Shield.',
    unitType: 'WAR_SUN',
    cost: 12,
    combat: [3, 3],
    move: 2,
    capacity: 6,
    sustain: true,
    bombardment: [3, 3],
    disablePlanetaryShield: true,
  },
  {
    key: 'TF_UPGRADE_UNIVERSITY_WAR_SUN',
    icon: universitiesOfJolNarIcon,
    name: 'University War Sun',
    description: "Other players' units in this system lose Planetary Shield.",
    unitType: 'WAR_SUN',
    cost: 10,
    combat: [4, 3],
    move: 3,
    capacity: 6,
    sustain: true,
    bombardment: [4, 3],
    disablePlanetaryShield: true,
  },

  // ── Dreadnoughts ─────────────────────────────────────────────────────
  {
    key: 'TF_UPGRADE_DAWNCRUSHER',
    icon: baronyOfLetnevIcon,
    name: 'Dawncrusher',
    description: "This unit cannot be destroyed by 'Spark' action cards.",
    unitType: 'DREADNOUGHT',
    cost: 3,
    combat: [5, 1],
    move: 2,
    capacity: 1,
    sustain: true,
    bombardment: [4, 1],
    directHitImmune: true,
  },
  {
    key: 'TF_UPGRADE_EXOTRIREME',
    icon: sardakkNorrIcon,
    name: 'Exotrireme',
    description:
      "This unit cannot be destroyed by 'Spark' action cards. After a round of space combat, you may destroy this unit to destroy up to 2 ships in this system.",
    unitType: 'DREADNOUGHT',
    cost: 4,
    combat: [4, 1],
    move: 2,
    capacity: 1,
    sustain: true,
    bombardment: [4, 2],
    directHitImmune: true,
    extraParams: { selfDestruct: false, _exoDone: false },
    uiConfig: () => [
      {
        key: 'selfDestruct',
        label: 'Self-destruct after a round to destroy up to 2 ships',
        type: 'checkbox',
      },
    ],
    invokes: [exotriremeSelfDestructInvoke],
  },
  {
    key: 'TF_UPGRADE_SUPER_DREADNOUGHT',
    icon: l1z1xMindnetIcon,
    name: 'Super-Dreadnought',
    description: "This unit cannot be destroyed by 'Spark' action cards.",
    unitType: 'DREADNOUGHT',
    cost: 4,
    combat: [5, 1],
    move: 2,
    capacity: 2,
    sustain: true,
    bombardment: [4, 1],
    directHitImmune: true,
  },

  // ── Carriers ─────────────────────────────────────────────────────────
  {
    key: 'TF_UPGRADE_ADVANCED_CARRIER',
    icon: federationOfSolIcon,
    name: 'Advanced Carrier',
    unitType: 'CARRIER',
    cost: 3,
    combat: [9, 1],
    move: 2,
    capacity: 8,
    sustain: true,
  },
  // Ambassador's coexistence clause and Vortexer's capture clause are
  // out-of-combat effects — only their capacity bump matters here.
  {
    key: 'TF_UPGRADE_AMBASSADOR',
    icon: deepwroughtScholarateIcon,
    name: 'Ambassador',
    unitType: 'CARRIER',
    cost: 3,
    combat: [9, 1],
    move: 2,
    capacity: 6,
  },
  {
    key: 'TF_UPGRADE_VORTEXER',
    icon: vuilraithCabalIcon,
    name: 'Vortexer',
    unitType: 'CARRIER',
    cost: 3,
    combat: [9, 1],
    move: 2,
    capacity: 6,
  },

  // ── Cruisers ─────────────────────────────────────────────────────────
  {
    key: 'TF_UPGRADE_AHK_SYL_FIER',
    icon: ghostsOfCreussIcon,
    name: 'Ahk Syl Fier',
    unitType: 'CRUISER',
    cost: 2,
    combat: [6, 1],
    move: 3,
    capacity: 1,
  },
  {
    key: 'TF_UPGRADE_CORSAIR',
    icon: mentakCoalitionIcon,
    name: 'Corsair',
    unitType: 'CRUISER',
    cost: 2,
    combat: [6, 1],
    move: 3,
    capacity: 2,
  },
  {
    key: 'TF_UPGRADE_SAGGITARIA',
    icon: councilKeleresIcon,
    name: 'Saggitaria',
    unitType: 'CRUISER',
    cost: 2,
    combat: [6, 1],
    move: 3,
    capacity: 1,
    sustain: true,
  },

  // ── Destroyers ───────────────────────────────────────────────────────
  {
    key: 'TF_UPGRADE_EXILE',
    icon: crimsonRebellionIcon,
    name: 'Exile',
    unitType: 'DESTROYER',
    cost: 1,
    combat: [8, 1],
    move: 4,
    afb: [6, 3],
  },
  {
    key: 'TF_UPGRADE_LINKSHIP',
    icon: ralNelIcon,
    name: 'Linkship',
    description:
      'When this unit retreats, you may destroy 1 ship in the active system that is damaged or does not have Sustain Damage.',
    unitType: 'DESTROYER',
    cost: 1,
    combat: [8, 1],
    move: 2,
    afb: [6, 3],
    invokes: [linkshipRetreatInvoke],
  },
  {
    key: 'TF_UPGRADE_STRIKE_WING_ALPHA',
    icon: argentFlightIcon,
    name: 'Strike Wing Alpha',
    description:
      "When this unit uses Anti-Fighter Barrage, each result of 9 or 10 also destroys 1 of your opponent's infantry in the space area of the active system.",
    unitType: 'DESTROYER',
    cost: 1,
    combat: [7, 1],
    move: 2,
    capacity: 1,
    afb: [6, 3],
    invokes: [strikeWingAlphaAfbInvoke],
  },

  // ── Fighters ─────────────────────────────────────────────────────────
  {
    key: 'TF_UPGRADE_HYBRID_CRYSTAL_FIGHTER',
    icon: naaluCollectiveIcon,
    name: 'Hybrid Crystal Fighter',
    unitType: 'FIGHTER',
    cost: 0.5,
    combat: [7, 1],
    move: 2,
  },
  {
    key: 'TF_UPGRADE_MORPHWING',
    icon: naazRokhaAllianceIcon,
    name: 'Morphwing',
    unitType: 'FIGHTER',
    cost: 0.5,
    combat: [7, 1],
    move: 2,
  },
  {
    key: 'TF_UPGRADE_TRIUNE',
    icon: empyreanIcon,
    name: 'Triune',
    unitType: 'FIGHTER',
    cost: 0.5,
    combat: [7, 1],
    move: 2,
  },

  // ── Mech upgrades (stack — a faction may apply all of them) ───────────
  {
    key: 'TF_UPGRADE_EIDOLON_LANDWASTER',
    icon: naazRokhaAllianceIcon,
    name: 'Eidolon Landwaster (Mech)',
    description: 'Your mechs roll 1 additional die during combat.',
    unitType: 'MECH',
    stack: true,
    apply: ctx => {
      const combat = ctx.api.own.getUnitStats('MECH')?.COMBAT
      if (!combat) return
      ctx.api.own.modifyUnitType('MECH', {
        COMBAT: [combat[0], (combat[1] ?? 1) + 1],
      })
    },
  },
  {
    key: 'TF_UPGRADE_EIDOLON_TERMINUS',
    icon: vuilraithCabalIcon,
    name: 'Eidolon Terminus (Mech)',
    description:
      'The Combat value of your mechs is reduced by 1 (hits more easily).',
    unitType: 'MECH',
    stack: true,
    apply: ctx => {
      const combat = ctx.api.own.getUnitStats('MECH')?.COMBAT
      if (!combat) return
      ctx.api.own.modifyUnitType('MECH', {
        COMBAT: [Math.max(1, combat[0] - 1), combat[1]],
      })
    },
  },

  // ── Infantry ─────────────────────────────────────────────────────────
  {
    key: 'TF_UPGRADE_GUILD_AGENTS',
    icon: yssarilTribesIcon,
    name: 'Guild Agents',
    unitType: 'INFANTRY',
    cost: 0.5,
    combat: [7, 1],
  },
  {
    key: 'TF_UPGRADE_LETANI_WARRIOR',
    icon: arborecIcon,
    name: 'Letani Warrior',
    unitType: 'INFANTRY',
    cost: 0.5,
    combat: [7, 1],
    production: 2,
  },
  {
    key: 'TF_UPGRADE_YIN_CLONE',
    icon: yinBrotherhoodIcon,
    name: 'Yin Clone',
    unitType: 'INFANTRY',
    cost: 0.5,
    combat: [7, 1],
  },

  // ── PDS ──────────────────────────────────────────────────────────────
  {
    key: 'TF_UPGRADE_HEL_TITAN',
    icon: titansOfUlIcon,
    name: 'Hel-Titan',
    description:
      'This unit is treated as both a structure and a ground force. You may use its Space Cannon against ships in adjacent systems.',
    unitType: 'PDS',
    combat: [5, 1],
    sustain: true,
    spaceCannon: [5, 1],
    planetaryShield: true,
    production: 1,
    declareParamChange: helTitanDeclareParamChange,
    onPrepare: helTitanOnPrepare,
  },
  {
    key: 'TF_UPGRADE_JUSTICIAR_RAIL',
    icon: winnuIcon,
    name: 'Justiciar Rail',
    description:
      'You may use this unit’s Space Cannon against ships in adjacent systems. Hits it produces must be assigned to non-fighter ships, if able.',
    unitType: 'PDS',
    spaceCannon: [5, 1],
    planetaryShield: true,
  },
  {
    key: 'TF_UPGRADE_KEEPER_MATRIX',
    icon: xxchaKingdomIcon,
    name: 'Keeper Matrix',
    description:
      'You may use this unit’s Space Cannon against ships in adjacent systems.',
    unitType: 'PDS',
    spaceCannon: [5, 2],
    planetaryShield: true,
  },
]

export const TF_UNIT_UPGRADES: readonly Ability[] =
  TF_UNIT_UPGRADE_CONFIGS.map(createTfUnitUpgrade)
