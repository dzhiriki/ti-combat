import titansOfUlIcon from '@/assets/faction/titans_of_ul.svg?raw'
import type { Ability } from '@/combat'
import { planetaryShield } from '@/data/main/abilities/general/planetary-shield'
import { sustainDamage } from '@/data/main/abilities/general/sustain-damage'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

const statsInvoke = createStatsInvoke('PDS', {
  COMBAT: [5, 1],
  CATEGORIES: ['STRUCTURES', 'GROUND_FORCES'],
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
  exclusiveGroup: 'UNIT_UPGRADE_PDS',
  invoke: [statsInvoke],
}
