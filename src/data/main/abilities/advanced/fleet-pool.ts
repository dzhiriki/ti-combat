import { type Ability, enforceFleetPool } from '@/combat'
import { declareParam } from '@/combat/abilities-engine/declare-param'
import type { UnitList } from '@/types'

type Params = {
  fleetPool: number
  shipPriority: UnitList
}

declare global {
  interface AbilityConfigMap {
    FLEET_POOL: Params
  }
}

export const fleetPool: Ability<Params> = {
  key: 'FLEET_POOL',
  name: 'Enforce Fleet Pool',
  context: 'SPACE',
  neutral: false,
  params: {
    isEnabled: false,
    uses: Infinity,
    fleetPool: 8,
    shipPriority: declareParam<UnitList>({
      default: [],
      source: 'spaceCombatParticipating',
      side: 'own',
      sort: 'worth-desc',
      filter: {
        combatMode: 'SPACE',
      },
    }),
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        enforceFleetPool(ctx.api.own)
      },
    },
  ],
  uiConfig: ctx => [
    {
      key: 'fleetPool',
      label: 'Fleet Pool',
      type: 'number',
      min: 1,
      max: 20,
    },
    {
      key: 'shipPriority',
      label: 'Ship Keep Priority',
      type: 'unit-list',
      mode: 'order',
      items: ctx.api.own.getUnitVariantsOptions('shipPriority'),
    },
  ],
}
