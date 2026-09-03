import type { Ability } from '@/combat'

type Params = {
  isEnabled: boolean
  rounds: number
  _currentRound: number
}

export const skilledRetreat: Ability<Params> = {
  key: 'SKILLED_RETREAT',
  name: 'Skilled Retreat',
  description:
    'At the start of a combat round: Move all of your ships from the active system into an adjacent system; the space combat ends in a draw.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
    rounds: 1,
    _currentRound: 1,
  },
  headerUI: 'isEnabled',
  uiConfig: [
    { key: 'rounds', label: 'In round', type: 'number', min: 1, max: 99 },
  ],
  invoke: [
    {
      timing: 'START_OF_COMBAT_ROUND',
      isCallable: params => params._currentRound >= params.rounds,
      call: ctx => {
        ctx.transitionTo('COMPLETE', 'DRAW')
      },
    },
    {
      timing: 'CLEANUP_ROUND',
      call: (ctx, params) => {
        ctx.api.own.updateAbilityConfig({
          _currentRound: params._currentRound + 1,
        })
      },
    },
  ],
}
