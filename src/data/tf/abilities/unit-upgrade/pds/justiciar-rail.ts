import winnuIcon from '@/assets/faction/winnu.svg?raw'
import { type Ability, parseVariantId } from '@/combat'
import { planetaryShield } from '@/data/main/abilities/general/planetary-shield'
import type { UnitType } from '@/types'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

// "Hits produced by this unit must be assigned to non-fighter ships, if
// able." Scoped to the PDS's own dice via a hit-pool transform ([0.0.1]'s
// pattern), NOT via the step-wide Graviton hook in the SCO phase driver —
// other Space Cannon sources on the same side (e.g. Lightrail Ordnance space
// docks) keep their unrestricted hits.
export const justiciarRail: Ability = {
  key: 'TF_UPGRADE_JUSTICIAR_RAIL',
  icon: winnuIcon,
  name: 'Justiciar Rail',
  description:
    'You may use this unit’s Space Cannon against ships in adjacent systems. Hits it produces must be assigned to non-fighter ships, if able.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'TF_UNIT_UPGRADE_PDS',
  invoke: [
    createStatsInvoke('PDS', {
      UNIT_ABILITIES: { SPACE_CANNON: [5, 1], PLANETARY_SHIELD: true },
      ABILITIES: [planetaryShield],
    }),
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'SPACE_CANNON_OFFENSE',
      call: ctx => {
        const { spaceUnitPriority: priority } =
          ctx.api.opponent.getAbilityConfig('UNIT_PRIORITY')
        const nonFighters: UnitType[] = []
        const fighters: UnitType[] = []
        for (const [key] of priority) {
          const target = key as UnitType
          if (parseVariantId(target).type === 'FIGHTER') {
            fighters.push(target)
          } else {
            nonFighters.push(target)
          }
        }
        const unitPriority = [...nonFighters, ...fighters]
        ctx.declareHitPoolTransform({
          OWN: {
            key: ctx.this.key,
            units: ['PDS'],
            transform: count => ({ base: count, unitPriority }),
          },
        })
      },
    },
  ],
}
