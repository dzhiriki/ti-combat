import xxchaKingdomIcon from '@/assets/faction/xxcha_kingdom.svg?raw'
import type { Ability } from '@/combat'
import { planetaryShield } from '@/data/main/abilities/general/planetary-shield'
import { createStatsInvoke } from '@/utils/create-stats-invoke'

export const keeperMatrix: Ability = {
  key: 'TF_UPGRADE_KEEPER_MATRIX',
  icon: xxchaKingdomIcon,
  name: 'Keeper Matrix',
  description:
    'You may use this unit’s Space Cannon against ships in adjacent systems.',
  params: { isEnabled: false, uses: Infinity },
  headerUI: 'isEnabled',
  exclusiveGroup: 'UNIT_UPGRADE_PDS',
  invoke: [
    createStatsInvoke('PDS', {
      UNIT_ABILITIES: { SPACE_CANNON: [5, 2], PLANETARY_SHIELD: true },
      ABILITIES: [planetaryShield],
    }),
  ],
}
