import { z } from 'zod/mini'

import type { Ability, AbilityCallContext } from '@/combat'

type Target = 'own' | 'opponent' | 'anyPreferOwn' | 'anyPreferOpponent'

type Params = {
  target: Target
}

function applyFlip(ctx: AbilityCallContext, params: Params): void {
  if (params.target === 'own') {
    ctx.api.own.applyConditionalBonusToResult({ amount: 1 })
  } else if (params.target === 'opponent') {
    ctx.api.opponent.applyConditionalBonusToResult({ amount: -1 })
  } else {
    // 'any*': declare both halves, sharing this card's single use. The kernel
    // applies at most `uses` flips total across the two sides; `preferred`
    // marks which flip wins when an outcome could take either.
    ctx.api.own.applyConditionalBonusToResult({
      amount: 1,
      preferred: params.target === 'anyPreferOwn',
    })
    ctx.api.opponent.applyConditionalBonusToResult({
      amount: -1,
      preferred: params.target === 'anyPreferOpponent',
    })
  }
}

export const heartOfIxth: Ability<Params> = {
  key: 'HEART_OF_IXTH',
  name: 'Heart of Ixth',
  description:
    'After any die is rolled, you may exhaust this card to add or subtract 1 from its result.',
  paramsSchema: z.object({
    target: z.union([
      z.literal('own'),
      z.literal('opponent'),
      z.literal('anyPreferOwn'),
      z.literal('anyPreferOpponent'),
    ]),
  }),
  params: {
    isEnabled: false,
    uses: 1,
    target: 'anyPreferOwn',
  },
  headerUI: 'isEnabled',
  uiConfig: [
    {
      key: 'target',
      label: 'Target',
      type: 'select',
      items: [
        { label: 'Any, prefer own (±1)', value: 'anyPreferOwn' },
        { label: 'Any, prefer opponent (±1)', value: 'anyPreferOpponent' },
        { label: 'Only own (+1)', value: 'own' },
        { label: 'Only opponent (-1)', value: 'opponent' },
      ],
    },
  ],
  invoke: [
    {
      timing: 'BEFORE_DICE_ROLL',
      system: true,
      isCallable: params => params.isEnabled && params.uses > 0,
      call: applyFlip,
    },
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      system: true,
      isCallable: params => params.isEnabled && params.uses > 0,
      call: applyFlip,
    },
  ],
}
