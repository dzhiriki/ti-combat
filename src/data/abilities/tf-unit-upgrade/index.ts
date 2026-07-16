import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from './create-tf-unit-upgrade'
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
// upgrades carry no description so the UI shows nothing redundant. Cards whose
// only differences are non-combat (extra movement / capacity / production /
// cost) are omitted entirely: Ambassador & Vortexer (carriers), all space-dock
// variants, and Valefar Prime (mech cost).
export const TF_UNIT_UPGRADES: readonly Ability[] = [
  // ── Carriers ─────────────────────────────────────────────────────────
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_ADVANCED_CARRIER',
    name: 'Advanced Carrier',
    unitType: 'CARRIER',
    cost: 3,
    combat: [9, 1],
    move: 2,
    capacity: 8,
    sustain: true,
  }),

  // ── Cruisers ─────────────────────────────────────────────────────────
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_AHK_SYL_FIER',
    name: 'Ahk Syl Fier',
    unitType: 'CRUISER',
    cost: 2,
    combat: [6, 1],
    move: 3,
    capacity: 1,
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_CORSAIR',
    name: 'Corsair',
    unitType: 'CRUISER',
    cost: 2,
    combat: [6, 1],
    move: 3,
    capacity: 2,
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_SAGGITARIA',
    name: 'Saggitaria',
    unitType: 'CRUISER',
    cost: 2,
    combat: [6, 1],
    move: 3,
    capacity: 1,
    sustain: true,
  }),

  // ── Destroyers ───────────────────────────────────────────────────────
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_EXILE',
    name: 'Exile',
    unitType: 'DESTROYER',
    cost: 1,
    combat: [8, 1],
    move: 4,
    afb: [6, 3],
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_LINKSHIP',
    name: 'Linkship',
    description:
      'When this unit retreats, you may destroy 1 ship in the active system that is damaged or does not have Sustain Damage.',
    unitType: 'DESTROYER',
    cost: 1,
    combat: [8, 1],
    move: 2,
    afb: [6, 3],
    invokes: [linkshipRetreatInvoke],
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_STRIKE_WING_ALPHA',
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
  }),

  // ── Dreadnoughts ─────────────────────────────────────────────────────
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_DAWNCRUSHER',
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
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_EXOTRIREME',
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
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_SUPER_DREADNOUGHT',
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
  }),

  // ── Fighters ─────────────────────────────────────────────────────────
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_HYBRID_CRYSTAL_FIGHTER',
    name: 'Hybrid Crystal Fighter',
    unitType: 'FIGHTER',
    cost: 0.5,
    combat: [7, 1],
    move: 2,
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_MORPHWING',
    name: 'Morphwing',
    unitType: 'FIGHTER',
    cost: 0.5,
    combat: [7, 1],
    move: 2,
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_TRIUNE',
    name: 'Triune',
    unitType: 'FIGHTER',
    cost: 0.5,
    combat: [7, 1],
    move: 2,
  }),

  // ── Infantry ─────────────────────────────────────────────────────────
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_GUILD_AGENTS',
    name: 'Guild Agents',
    unitType: 'INFANTRY',
    cost: 0.5,
    combat: [7, 1],
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_LETANI_WARRIOR',
    name: 'Letani Warrior',
    unitType: 'INFANTRY',
    cost: 0.5,
    combat: [7, 1],
    production: 2,
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_YIN_CLONE',
    name: 'Yin Clone',
    unitType: 'INFANTRY',
    cost: 0.5,
    combat: [7, 1],
  }),

  // ── PDS ──────────────────────────────────────────────────────────────
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_HEL_TITAN',
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
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_JUSTICIAR_RAIL',
    name: 'Justiciar Rail',
    description:
      'You may use this unit’s Space Cannon against ships in adjacent systems. Hits it produces must be assigned to non-fighter ships, if able.',
    unitType: 'PDS',
    spaceCannon: [5, 1],
    planetaryShield: true,
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_KEEPER_MATRIX',
    name: 'Keeper Matrix',
    description:
      'You may use this unit’s Space Cannon against ships in adjacent systems.',
    unitType: 'PDS',
    spaceCannon: [5, 2],
    planetaryShield: true,
  }),

  // ── War Suns ─────────────────────────────────────────────────────────
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_PROTOTYPE_WAR_SUN',
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
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_THE_DRAGON_FREED',
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
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_UNIVERSITY_WAR_SUN',
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
  }),

  // ── Flagship ─────────────────────────────────────────────────────────
  // Relative to each faction's own flagship, so applied as adjustments
  // rather than a stat block.
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_ECHO_OF_ASCENSION',
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
  }),

  // ── Mech upgrades (stack — a faction may apply all of them) ───────────
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_EIDOLON_LANDWASTER',
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
  }),
  createTfUnitUpgrade({
    key: 'TF_UPGRADE_EIDOLON_TERMINUS',
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
  }),
]
