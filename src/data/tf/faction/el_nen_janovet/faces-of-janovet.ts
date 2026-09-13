import { type Ability, hasStaticInvokes } from '@/combat'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { UnitBaseType } from '@/types'
import { isStatsInvoke } from '@/utils/is-stats-invoke'

// Only these upgrade types contribute unit abilities to the flagship.
const INHERITABLE_TYPES: readonly UnitBaseType[] = [
  'CRUISER',
  'DESTROYER',
  'DREADNOUGHT',
]

// El Nen Janovet flagship. "This unit gains the unit abilities and text
// abilities of your destroyer, cruiser, and dreadnought unit upgrade
// technologies." At PREPARE, merge the enabled cards' unit abilities (AFB,
// Bombardment, Sustain Damage) and Spark immunity onto the flagship's stats.
// The invoke-based text abilities extend to the flagship inside their own
// cards (see strike-wing-alpha.ts / linkship.ts). Exotrireme's
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
        // Read the cards' stat blocks, not the units' runtime stats (which
        // may also contain changes from unrelated abilities).
        // Each unit type's upgrade cards live in their own slot; read only
        // the three the flagship inherits from, in inheritance order.
        const enabled = INHERITABLE_TYPES.flatMap(unitType =>
          ctx.abilities.own.get(`TF_UNIT_UPGRADE_${unitType}`),
        )
          .flatMap(card => {
            const config = ctx.api.own.getAbilityConfig(
              card.key as keyof AbilityConfigMap,
            )
            if (config?.isEnabled !== true || !hasStaticInvokes(card)) return []
            return card.invoke.filter(isStatsInvoke)
          })
          .filter(inv => INHERITABLE_TYPES.includes(inv.unitType))
          .sort(
            (a, b) =>
              INHERITABLE_TYPES.indexOf(a.unitType) -
              INHERITABLE_TYPES.indexOf(b.unitType),
          )
        if (enabled.length === 0) return

        const current = ctx.api.own.getUnitStats('FLAGSHIP')
        if (!current) return
        const unitAbilities = { ...current.UNIT_ABILITIES }
        const abilities = [...(current.ABILITIES ?? [])]
        let directHitImmune = current.DIRECT_HIT_IMMUNE === true

        for (const { stats } of enabled) {
          const inherited = stats.UNIT_ABILITIES
          if (inherited?.AFB) unitAbilities.AFB = inherited.AFB
          if (inherited?.BOMBARDMENT)
            unitAbilities.BOMBARDMENT = inherited.BOMBARDMENT
          if (inherited?.SPACE_CANNON)
            unitAbilities.SPACE_CANNON = inherited.SPACE_CANNON
          if (inherited?.SUSTAIN_DAMAGE && !unitAbilities.SUSTAIN_DAMAGE) {
            unitAbilities.SUSTAIN_DAMAGE = true
            abilities.push(sustainDamage)
          }
          if (stats.DIRECT_HIT_IMMUNE) directHitImmune = true
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
