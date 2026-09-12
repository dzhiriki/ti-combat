import titansOfUlIcon from '@/assets/faction/titans_of_ul.svg?raw'
import type { Ability } from '@/combat'
import { planetaryShield } from '@/data/main/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import type { UnitBaseType } from '@/types'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

const statsInvoke = createStatsInvoke('PDS', {
  COMBAT: [5, 1],
  UNIT_ABILITIES: {
    SUSTAIN_DAMAGE: true,
    SPACE_CANNON: [5, 1],
    PLANETARY_SHIELD: true,
    PRODUCTION: 1,
  },
  ABILITIES: [sustainDamage, planetaryShield],
})

export const helTitan: Ability = {
  key: 'TF_UPGRADE_HEL_TITAN',
  icon: titansOfUlIcon,
  name: 'Hel-Titan',
  description:
    'This unit is treated as both a structure and a ground force. You may use its Space Cannon against ships in adjacent systems.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'TF_UNIT_UPGRADE_PDS',
  declareParamChange: () => [{ key: 'groundForces', value: 'PDS' }],
  invoke: [
    {
      timing: 'PREPARE',
      system: true,
      // A single PREPARE must both upgrade the PDS and restore its ground
      // participation after simulation setup resets SETTINGS.
      call: (ctx, params) => {
        statsInvoke.call(ctx, params)
        ctx.api.own.updateAbilityConfig('SETTINGS', {
          groundForces: (current: UnitBaseType[]) => [...current, 'PDS'],
        })
      },
    },
  ],
}
