import nomadIcon from '@/assets/faction/nomad.svg?raw'
import type { Ability } from '@/combat/abilities-engine/types'
import {
  buildCombatDiceRollGroup,
  buildUnitAbilityDiceRollGroup,
} from '@/combat/combat-state'
import {
  buildRerollStrategy,
  type RerollStrategy,
  rerollStrategyConfig,
  strategyToPredicate,
} from '@/combat/dice-math/reroll-strategy'

type Params = {
  ownStrategyKind: RerollStrategy['kind']
  ownStrategyThreshold: number
  opponentStrategyKind: RerollStrategy['kind']
  opponentStrategyThreshold: number
  combinator: 'AND' | 'OR'
}

declare global {
  interface AbilityConfigMap {
    THUNDARIAN: Params
  }
}

export const thundarian: Ability<Params> = {
  key: 'THUNDARIAN',
  name: 'The Thundarian',
  description:
    'After the "Roll Dice" step of combat: You may exhaust this card. If you do, hits are not assigned to either player\'s units. Return to the start of this combat round\'s "Roll Dice" step.',
  icon: nomadIcon,
  params: {
    isEnabled: false,
    uses: 1,
    ownStrategyKind: 'IF_HITS_PERCENT_LE',
    ownStrategyThreshold: 50,
    opponentStrategyKind: 'IF_HITS_PERCENT_GE',
    opponentStrategyThreshold: 50,
    combinator: 'OR',
  },
  headerUI: 'isEnabled',
  uiConfig: (_ctx, params) => [
    ...rerollStrategyConfig<Params>(
      'ownStrategyKind',
      'ownStrategyThreshold',
      params.ownStrategyKind,
      'Own dice',
    ),
    {
      type: 'select',
      key: 'combinator',
      items: [
        { label: 'AND', value: 'AND' },
        { label: 'OR', value: 'OR' },
      ],
    },
    ...rerollStrategyConfig<Params>(
      'opponentStrategyKind',
      'opponentStrategyThreshold',
      params.opponentStrategyKind,
      'Opponent dice',
    ),
  ],
  invoke: [
    {
      timing: 'AFTER_DICE_ROLL_STEP',
      isCallable: (params, ctx) => {
        if (!params.isEnabled || params.uses <= 0) return false
        const { own, opponent } = ctx.getPostRollSides()
        const ownMatch = strategyToPredicate(
          buildRerollStrategy(
            params.ownStrategyKind,
            params.ownStrategyThreshold,
          ),
        )(own)
        const opponentMatch = strategyToPredicate(
          buildRerollStrategy(
            params.opponentStrategyKind,
            params.opponentStrategyThreshold,
          ),
        )(opponent)
        return params.combinator === 'AND'
          ? ownMatch && opponentMatch
          : ownMatch || opponentMatch
      },
      call: ctx => {
        const group = ctx.currentDiceRollIsUnitAbility
          ? buildUnitAbilityDiceRollGroup({
              phase: ctx.currentDiceRollPhase,
              firing: ctx.currentDiceRollFiring,
              hitSource: ctx.currentDiceRollHitSource,
              selfTarget: ctx.currentDiceRollSelfTarget,
            })
          : buildCombatDiceRollGroup({ phase: ctx.currentDiceRollPhase })
        ctx.api.own.discardCurrentGroupScript()
        ctx.api.own.pushSteps([group])
        ctx.logger?.child('THUNDARIAN').child('RESTART').log()
      },
    },
  ],
}
