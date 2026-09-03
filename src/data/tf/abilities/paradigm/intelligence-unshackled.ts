import type { Ability } from '@/combat'
import type { DiceGroup, UnitId } from '@/types'

type Params = { isEnabled: boolean }

// Twilight's Fall paradigm. When one of your units is destroyed, purge this card
// to designate that unit as the catalyst and roll 1 die for each of your
// opponent's units in the system; for each result ≥ the catalyst's combat
// value, destroy that unit. This is Last Bastion's "Apollo" hero without the
// galvanize requirement — any destroyed unit can be the catalyst. When multiple
// of your units die together, the lowest combat value (easiest threshold) is
// used, as the player would choose.
export const intelligenceUnshackled: Ability<Params> = {
  key: 'TF_INTELLIGENCE_UNSHACKLED',
  name: 'Intelligence Unshackled',
  description:
    "When one of your units is destroyed: Roll 1 die for each of your opponent's units in the system. For each result equal to or greater than the destroyed unit's combat value, destroy that unit.",
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'AFTER_DESTROY',
      isCallable: (_params, ctx, ids) => {
        const hasOwn = ids.some(id => ctx.api.own.getUnitVariantKey(id) != null)
        if (!hasOwn) return false
        return ctx.api.opponent.getActiveBaseTypes().length > 0
      },
      call: (ctx, _params, ids) => {
        // Catalyst = the destroyed own unit with the lowest combat value.
        let hitValue: number | undefined
        for (const id of ids) {
          const key = ctx.api.own.getUnitVariantKey(id)
          if (!key) continue
          const combat = ctx.api.own.getUnitStats(key)?.COMBAT?.[0]
          if (
            typeof combat === 'number' &&
            (hitValue === undefined || combat < hitValue)
          ) {
            hitValue = combat
          }
        }
        if (hitValue === undefined) return

        // Group identical opponent units into one dice group each (mirrors
        // Apollo) to avoid a 2^N branch explosion on large identical stacks.
        const opp = ctx.api.opponent
        const groups = new Map<string, UnitId[]>()
        for (const baseType of opp.getActiveBaseTypes()) {
          for (const id of opp.getUnits(baseType, { includeVariants: true })) {
            const variantKey = opp.getUnitVariantKey(id) ?? baseType
            const state = opp.getUnitState(id) ?? {}
            const stateKey = Object.keys(state)
              .sort()
              .map(k => `${k}=${(state as Record<string, unknown>)[k]}`)
              .join(',')
            const groupKey = `${variantKey}|${stateKey}`
            const bucket = groups.get(groupKey)
            if (bucket) bucket.push(id)
            else groups.set(groupKey, [id])
          }
        }
        if (groups.size === 0) return

        const groupOrder: UnitId[][] = [...groups.values()]
        const dice: DiceGroup[] = groupOrder.map(g => [hitValue!, g.length])

        ctx.rollDice(dice, (branchCtx, hits) => {
          const toDestroy: UnitId[] = []
          for (let i = 0; i < groupOrder.length; i++) {
            const n = Math.min(hits[i], groupOrder[i].length)
            for (let j = 0; j < n; j++) toDestroy.push(groupOrder[i][j])
          }
          if (toDestroy.length > 0)
            branchCtx.api.opponent.destroyUnits(toDestroy)
        })
      },
    },
  ],
}
