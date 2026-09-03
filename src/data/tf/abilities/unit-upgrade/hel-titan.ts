import type { Ability, AbilityCallContext } from '@/combat'
import type { UnitBaseType } from '@/types'

export const helTitanDeclareParamChange: NonNullable<
  Ability['declareParamChange']
> = () => [{ key: 'groundForces', value: 'PDS' }]

export const helTitanOnPrepare = (ctx: AbilityCallContext): void => {
  ctx.api.own.updateAbilityConfig('SETTINGS', {
    groundForces: (current: UnitBaseType[]) => [...current, 'PDS'],
  })
}
