import type { Ability, SideApi } from '@/combat'
import { sustainDamage } from '@/data/abilities/general/sustain-damage'
import { TF_UNIT_UPGRADE_CONFIGS } from '@/data/abilities/tf-unit-upgrade'
import type { TfUnitUpgradeConfig } from '@/data/abilities/tf-unit-upgrade/create-tf-unit-upgrade'
import type { UnitBaseType } from '@/types'

// The card grants the abilities of the destroyer, cruiser, and dreadnought
// unit-upgrade technologies specifically — not carriers, PDS, or war suns.
const INHERIT_TYPES: ReadonlySet<UnitBaseType> = new Set<UnitBaseType>([
  'CRUISER',
  'DESTROYER',
  'DREADNOUGHT',
])

// Lazy: this module sits in an import cycle with the unit-upgrade deck (its
// card invokes call `janovetInherits`), so the configs must not be touched
// at module-evaluation time.
let inheritable: readonly TfUnitUpgradeConfig[] | undefined
const getInheritable = () =>
  (inheritable ??= TF_UNIT_UPGRADE_CONFIGS.filter(cfg =>
    INHERIT_TYPES.has(cfg.unitType),
  ))

/** Is the given inheritable upgrade card enabled on this side? Exposed for the
 *  card invokes that extend their text ability to the flagship (Strike Wing
 *  Alpha's AFB trigger, Linkship's retreat destroy). */
export function janovetInherits(api: SideApi, upgradeKey: string): boolean {
  const janovet = api.getAbilityConfig(
    'TF_FACES_OF_JANOVET' as keyof AbilityConfigMap,
  ) as { isEnabled?: boolean } | undefined
  if (janovet?.isEnabled !== true) return false
  const card = api.getAbilityConfig(upgradeKey as keyof AbilityConfigMap) as
    | { isEnabled?: boolean }
    | undefined
  return card?.isEnabled === true
}

// El Nen Janovet flagship. "This unit gains the unit abilities and text
// abilities of your destroyer, cruiser, and dreadnought unit upgrade
// technologies." At PREPARE, merge the enabled cards' unit abilities (AFB,
// Bombardment, Sustain Damage) and Spark immunity onto the flagship's stats.
// The invoke-based text abilities extend to the flagship inside their own
// cards (see strike-wing-alpha.ts / linkship-retreat.ts). Exotrireme's
// self-destruct stays dreadnought-only — "destroy this unit" sacrifices the
// dreadnought itself, which the Exotrireme invoke already covers.
export const facesOfJanovet: Ability = {
  key: 'TF_FACES_OF_JANOVET',
  name: 'The Faces of Janovet',
  description:
    'This unit gains the unit abilities and text abilities of your destroyer, cruiser, and dreadnought unit upgrade technologies.',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  // The flagship's printed text — always on while the flagship is fielded.
  readOnly: true,
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        const enabled = getInheritable().filter(
          cfg =>
            (
              ctx.api.own.getAbilityConfig(
                cfg.key as keyof AbilityConfigMap,
              ) as { isEnabled?: boolean } | undefined
            )?.isEnabled === true,
        )
        if (enabled.length === 0) return

        const current = ctx.api.own.getUnitStats('FLAGSHIP')
        if (!current) return
        const unitAbilities = { ...current.UNIT_ABILITIES }
        const abilities = [...(current.ABILITIES ?? [])]
        let directHitImmune = current.DIRECT_HIT_IMMUNE === true

        for (const cfg of enabled) {
          if (cfg.afb) unitAbilities.AFB = cfg.afb
          if (cfg.bombardment) unitAbilities.BOMBARDMENT = cfg.bombardment
          if (cfg.spaceCannon) unitAbilities.SPACE_CANNON = cfg.spaceCannon
          if (cfg.sustain && !unitAbilities.SUSTAIN_DAMAGE) {
            unitAbilities.SUSTAIN_DAMAGE = true
            abilities.push(sustainDamage)
          }
          if (cfg.directHitImmune) directHitImmune = true
        }

        ctx.api.own.modifyUnitType('FLAGSHIP', {
          UNIT_ABILITIES: unitAbilities,
          ABILITIES: abilities,
          ...(directHitImmune && { DIRECT_HIT_IMMUNE: true }),
        })
      },
    },
  ],
}
