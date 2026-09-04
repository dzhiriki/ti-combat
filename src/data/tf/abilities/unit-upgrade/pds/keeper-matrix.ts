import xxchaKingdomIcon from '@/assets/faction/xxcha_kingdom.svg?raw'
import type { Ability } from '@/combat'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

export const keeperMatrix: Ability = createTfUnitUpgrade({
  key: 'TF_UPGRADE_KEEPER_MATRIX',
  icon: xxchaKingdomIcon,
  name: 'Keeper Matrix',
  description:
    'You may use this unit’s Space Cannon against ships in adjacent systems.',
  unitType: 'PDS',
  spaceCannon: [5, 2],
  planetaryShield: true,
})
