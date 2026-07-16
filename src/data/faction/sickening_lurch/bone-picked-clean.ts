import { z } from 'zod/mini'

import type { Ability } from '@/combat'
import type { UnitType } from '@/types'

type Params = {
  spendThreshold: '1' | '2' | '3'
}

declare global {
  interface AbilityConfigMap {
    TF_BONE_PICKED_CLEAN: Params
  }
}

// A Sickening Lurch mech. "…you can spend 1 captured infantry after rolling
// during combat to reroll this unit's dice." The uses counter is the number
// of captured infantry available: each ground-combat round, every mech whose
// missed dice count reaches the spend threshold spends 1 infantry to reroll
// ITS missed dice (worst rolls first when infantry run short). Two missing
// mechs cost two infantry; a mech that hit everything spends nothing.
export const bonePickedClean: Ability<Params> = {
  key: 'TF_BONE_PICKED_CLEAN',
  name: 'Bone Picked Clean',
  description:
    "Spend 1 captured infantry after rolling during combat to reroll this unit's dice.",
  context: 'GROUND',
  paramsSchema: z.object({
    spendThreshold: z.union([z.literal('1'), z.literal('2'), z.literal('3')]),
  }),
  params: {
    isEnabled: true,
    uses: 0,
    spendThreshold: '1',
  },
  headerUI: 'uses',
  uiConfig: [
    {
      key: 'spendThreshold',
      label: 'Spend when a mech has at least this many misses',
      type: 'select',
      items: [
        { label: '1 miss', value: '1' },
        { label: '2 misses', value: '2' },
        { label: '3 misses (Eidolon Landwaster)', value: '3' },
      ],
    },
  ],
  invoke: [
    {
      timing: 'REROLL_DICE_ROLL',
      system: true,
      isCallable: params => params.isEnabled && params.uses > 0,
      call: (ctx, params) => {
        const [mech] = ctx.api.own.getUnits('MECH', { includeVariants: true })
        if (!mech) return
        const variantKey = (ctx.api.own.getUnitVariantKey(mech) ??
          'MECH') as UnitType
        ctx.api.own.declareReroll({
          target: 'MISSES',
          unitType: [variantKey],
          perUnit: { threshold: Number(params.spendThreshold) },
        })
      },
    },
  ],
}
