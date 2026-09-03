import ralNelIcon from '@/assets/faction/ral_nel.svg?raw'
import { type Ability, declareParam } from '@/combat'
import type { UnitList, UnitType } from '@/types'

import { retreatUnits } from '../../abilities/advanced/retreat'

type Params = {
  isEnabled: boolean
  shipConfig: UnitList<number>
}

export const watchfulOjz: Ability<Params> = {
  key: 'WATCHFUL_OJZ',
  name: 'Watchful Ojz',
  description:
    'When you declare a retreat: Immediately retreat up to 2 of your ships from the active system.',
  icon: ralNelIcon,
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
    shipConfig: declareParam<UnitList<number>>({
      default: [],
      source: 'spaceCombatParticipating',
      defaultItemValue: 0,
      filter: { combatMode: 'SPACE' },
      limit: 'IN_COMBAT',
    }),
  },
  headerUI: 'isEnabled',
  uiConfig: ctx => [
    {
      key: 'shipConfig',
      label: 'Ships',
      type: 'unit-list',
      mode: 'number',
      sortable: true,
      items: ctx.api.own.getUnitVariantsOptions('shipConfig'),
    },
  ],
  invoke: [
    {
      timing: 'ANNOUNCE_RETREAT',
      call: (ctx, params) => {
        const toRetreat = []
        for (const [variantId, maxCount] of params.shipConfig) {
          if (toRetreat.length >= 2) break
          if (maxCount <= 0) continue
          let retreatedForType = 0
          const ids = ctx.api.own.getUnits(variantId as UnitType, {
            includeVariants: false,
          })
          for (const id of ids) {
            if (toRetreat.length >= 2) break
            if (retreatedForType >= maxCount) break
            toRetreat.push(id)
            retreatedForType++
          }
        }

        if (toRetreat.length === 0) return

        retreatUnits(ctx, toRetreat)
      },
    },
  ],
}
