import type { Ability, AbilityCallContext } from '@/combat'
import { disablePlanetaryShield } from '@/data/abilities/general/disable-planetary-shield'
import { planetaryShield } from '@/data/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import type { DiceGroup, UnitBaseType, UnitStats } from '@/types'

// Twilight's Fall unit upgrades come from a shared deck rather than a fixed
// per-unit toggle. Up to ONE upgrade may be applied per unit type (one cruiser
// card AND one carrier card is fine; two cruiser cards is not), so non-mech
// upgrades share a per-unit-type exclusive group. Mech upgrades omit the group
// and therefore stack (a faction may apply all of them). The prefix keeps the
// groups clear of Nekro's raw-unit-type exclusive groups.
export const tfUnitUpgradeGroup = (unitType: UnitBaseType): string =>
  `TF_UNIT_UPGRADE_${unitType}`

export interface TfUnitUpgradeConfig {
  key: string
  name: string
  // Originating TI4/TE faction's logo (raw SVG) — shows card provenance.
  icon?: string
  // Only set when the card has a combat-affecting rule *beyond* its stat/ability
  // changes (e.g. Strike Wing Alpha's AFB bonus). Plain stat upgrades leave it
  // undefined so the UI shows no redundant text.
  description?: string
  unitType: UnitBaseType
  // Stat overrides for the unit type.
  cost?: number
  combat?: DiceGroup
  move?: number
  capacity?: number | null
  // Unit abilities — the factory attaches the matching ability objects.
  sustain?: boolean
  bombardment?: DiceGroup
  afb?: DiceGroup
  spaceCannon?: DiceGroup
  planetaryShield?: boolean
  production?: number
  disablePlanetaryShield?: boolean
  // Immune to "Spark" (Direct Hit) — e.g. the dreadnought upgrades.
  directHitImmune?: boolean
  // Custom apply for relative changes (e.g. mech +1 die). Takes precedence.
  apply?: (ctx: AbilityCallContext) => void
  // Extra work to run inside the same PREPARE invoke, after the stat
  // application (e.g. Hel-Titan adding PDS to groundForces). Kept in the one
  // PREPARE invoke because the engine runs a single invoke per (ability,
  // timing).
  onPrepare?: (ctx: AbilityCallContext) => void
  // Extra ability invokes beyond the PREPARE stat application (e.g. Linkship's
  // WHEN_RETREAT destroy). They fire only while the upgrade is enabled.
  invokes?: Ability['invoke']
  // Extra params merged onto { isEnabled, uses } — e.g. Exotrireme's opt-in
  // self-destruct checkbox.
  extraParams?: Record<string, unknown>
  uiConfig?: Ability['uiConfig']
  declareParamChange?: Ability['declareParamChange']
  // Mech upgrades stack; non-mech are mutually exclusive per unit type.
  stack?: boolean
}

function buildStats(cfg: TfUnitUpgradeConfig): Partial<UnitStats> {
  const unitAbilities: NonNullable<UnitStats['UNIT_ABILITIES']> = {}
  const abilities: Ability[] = []

  if (cfg.sustain) {
    unitAbilities.SUSTAIN_DAMAGE = true
    abilities.push(sustainDamage)
  }
  if (cfg.planetaryShield) {
    unitAbilities.PLANETARY_SHIELD = true
    abilities.push(planetaryShield)
  }
  if (cfg.disablePlanetaryShield) abilities.push(disablePlanetaryShield)
  if (cfg.bombardment) unitAbilities.BOMBARDMENT = cfg.bombardment
  if (cfg.afb) unitAbilities.AFB = cfg.afb
  if (cfg.spaceCannon) unitAbilities.SPACE_CANNON = cfg.spaceCannon
  if (cfg.production != null) unitAbilities.PRODUCTION = cfg.production

  const stats: Partial<UnitStats> = { UNIT_ABILITIES: unitAbilities }
  if (abilities.length) stats.ABILITIES = abilities
  if (cfg.directHitImmune) stats.DIRECT_HIT_IMMUNE = true
  if (cfg.cost != null) stats.COST = cfg.cost
  if (cfg.combat) stats.COMBAT = cfg.combat
  if (cfg.move != null) stats.MOVE = cfg.move
  if (cfg.capacity !== undefined) stats.CAPACITY = cfg.capacity

  return stats
}

export function createTfUnitUpgrade(cfg: TfUnitUpgradeConfig): Ability {
  const stats = cfg.apply ? undefined : buildStats(cfg)
  return {
    key: cfg.key,
    name: cfg.name,
    description: cfg.description,
    ...(cfg.icon && { icon: cfg.icon }),
    ...(cfg.stack ? {} : { exclusiveGroup: tfUnitUpgradeGroup(cfg.unitType) }),
    params: { isEnabled: false, uses: Infinity, ...cfg.extraParams },
    headerUI: 'isEnabled',
    ...(cfg.uiConfig && { uiConfig: cfg.uiConfig }),
    ...(cfg.declareParamChange && {
      declareParamChange: cfg.declareParamChange,
    }),
    invoke: [
      {
        timing: 'PREPARE',
        call: (ctx: AbilityCallContext) => {
          if (cfg.apply) cfg.apply(ctx)
          else if (stats) ctx.api.own.modifyUnitType(cfg.unitType, stats)
          cfg.onPrepare?.(ctx)
        },
      },
      ...(cfg.invokes ?? []),
    ],
  }
}
