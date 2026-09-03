import type { Ability, AbilityCallContext } from '@/combat'

// A copyable Abilities-deck entry: its key/name plus any PREPARE-timing invokes
// (so a mid-combat copy can apply stat-style effects that normally run once at
// setup). Most Abilities apply at combat timings (BEFORE_DICE_ROLL, etc.) and
// just need their config enabled — their own invokes then fire from that point.
export interface SingularityCopyable {
  key: string
  name: string
  prepareCalls: ((
    ctx: AbilityCallContext,
    params: Record<string, unknown>,
  ) => void)[]
}

export function collectCopyable(ability: Ability): SingularityCopyable {
  const prepareCalls: SingularityCopyable['prepareCalls'] = []
  for (const inv of ability.invoke) {
    if (inv.timing === 'PREPARE') {
      prepareCalls.push(
        inv.call as (
          ctx: AbilityCallContext,
          p: Record<string, unknown>,
        ) => void,
      )
    }
  }
  return { key: ability.key, name: ability.name, prepareCalls }
}

const NONE = 'none'

type SingularityParams = {
  copyKey: string
  triggered: boolean
}

/**
 * Twilight's Fall Singularity X / Y / Z. Once per combat, after one of your
 * opponent's units is destroyed, this "gains the text" of one of your
 * opponent's Abilities for the rest of the combat — modeled by enabling the
 * chosen Ability on your side at that moment (so it applies mid-combat, not
 * from the start). Copies Abilities only (never unit upgrades or singularities).
 */
export function createTfSingularity(
  letter: 'X' | 'Y' | 'Z',
  copyables: readonly SingularityCopyable[],
): Ability<SingularityParams> {
  const lookup = new Map(copyables.map(c => [c.key, c]))
  return {
    key: `TF_SINGULARITY_${letter}`,
    name: `Singularity ${letter}`,
    description:
      "Once per combat, after 1 of your opponent's units is destroyed: gain the text of one of your opponent's abilities for the rest of the combat.",
    params: {
      isEnabled: false,
      uses: Infinity,
      copyKey: NONE,
      triggered: false,
    },
    headerUI: 'isEnabled',
    uiConfig: () => [
      {
        key: 'copyKey',
        label: 'Copy ability',
        type: 'select',
        items: [
          { label: 'None', value: NONE },
          ...copyables.map(c => ({ label: c.name, value: c.key })),
        ],
      },
    ],
    invoke: [
      {
        timing: 'AFTER_DESTROY',
        context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
        isCallable: (params, ctx, ids) => {
          if (params.triggered) return false
          if (params.copyKey === NONE) return false
          // Fires only when one of the OPPONENT's units was destroyed.
          return ids.some(id => !!ctx.api.opponent.getUnitVariantKey(id))
        },
        call: (ctx: AbilityCallContext, params) => {
          ctx.api.own.updateAbilityConfig({ triggered: true })
          const entry = lookup.get(params.copyKey)
          if (!entry) return
          const copiedParams =
            (ctx.api.own.getAbilityConfig(
              entry.key as Parameters<typeof ctx.api.own.getAbilityConfig>[0],
            ) as Record<string, unknown>) ?? {}
          for (const call of entry.prepareCalls) call(ctx, copiedParams)
          ctx.api.own.updateAbilityConfig(entry.key, { isEnabled: true })
        },
      },
    ],
  }
}
