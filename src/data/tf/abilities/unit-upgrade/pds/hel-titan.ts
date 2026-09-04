import titansOfUlIcon from '@/assets/faction/titans_of_ul.svg?raw'
import type { Ability, AbilityCallContext } from '@/combat'
import type { UnitBaseType } from '@/types'

import { createTfUnitUpgrade } from '../create-tf-unit-upgrade'

const helTitanDeclareParamChange: NonNullable<
  Ability['declareParamChange']
> = () => [{ key: 'groundForces', value: 'PDS' }]

const helTitanOnPrepare = (ctx: AbilityCallContext): void => {
  ctx.api.own.updateAbilityConfig('SETTINGS', {
    groundForces: (current: UnitBaseType[]) => [...current, 'PDS'],
  })
}

export const helTitan: Ability = createTfUnitUpgrade({
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
})
