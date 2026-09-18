import { z } from 'zod/mini'

import type { Ability } from '@/combat'

type Params = {
  anomalies: number
}

declare global {
  interface AbilityConfigMap {
    TF_STARLANCER_XI: Params
  }
}

export const starlancerXI: Ability<Params> = {
  key: 'TF_STARLANCER_XI',
  name: 'Starlancer XI',
  description:
    'This unit participates in space combat as if it were a ship. For each anomaly this unit is in or adjacent to, apply +1 to this unit’s rolls.',
  context: 'SPACE',
  paramsSchema: z.object({
    anomalies: z.number(),
  }),
  params: {
    isEnabled: true,
    uses: Infinity,
    anomalies: 0,
  },
  readOnly: true,
  headerUI: 'isEnabled',
  // Native stats provide membership; this declaration exposes setup options.
  declareParamChange: () => [{ key: 'ships', value: 'MECH' }],
  uiConfig: [
    {
      key: 'anomalies',
      label: 'Anomalies in or adjacent (+1 each)',
      type: 'number',
      min: 0,
      max: 6,
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      isCallable: params => params.anomalies > 0,
      call: (ctx, params) => {
        ctx.api.own.applyBonusToResult(params.anomalies, 'MECH')
      },
    },
  ],
}
