import nekroVirusIcon from '@/assets/faction/nekro_virus.svg?raw'
import type {
  Ability,
  AbilityCallContext,
  AbilityLookupContext,
} from '@/combat'
import { resolveInvokes } from '@/combat'

const NONE = 'none'

type SingularityParams = {
  copyKey: string
  triggered: boolean
}

/** The Abilities deck minus the singularities themselves (they copy
 *  Abilities only, never each other). */
function copyables(ctx: AbilityLookupContext): readonly Ability[] {
  return ctx.abilities.own
    .get('ABILITY')
    .filter(a => !a.key.startsWith('TF_SINGULARITY_'))
}

/**
 * Twilight's Fall Singularity X / Y / Z. Once per combat, after one of your
 * opponent's units is destroyed, this "gains the text" of one of your
 * opponent's Abilities for the rest of the combat — modeled by enabling the
 * chosen Ability on your side at that moment (so it applies mid-combat, not
 * from the start). Copies Abilities only (never unit upgrades or singularities).
 */
export function createSingularity(
  letter: 'X' | 'Y' | 'Z',
): Ability<SingularityParams> {
  return {
    key: `TF_SINGULARITY_${letter}`,
    name: `Singularity ${letter}`,
    description:
      "Once per combat, after 1 of your opponent's units is destroyed: gain the text of one of your opponent's abilities for the rest of the combat.",
    icon: nekroVirusIcon,
    params: {
      isEnabled: false,
      uses: Infinity,
      copyKey: NONE,
      triggered: false,
    },
    headerUI: 'isEnabled',
    uiConfig: ctx => [
      {
        key: 'copyKey',
        label: 'Copy ability',
        type: 'select',
        items: [
          { label: 'None', value: NONE },
          ...copyables(ctx).map(c => ({ label: c.name, value: c.key })),
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
          const target = copyables(ctx).find(a => a.key === params.copyKey)
          if (!target) return
          const copiedParams =
            (ctx.api.own.getAbilityConfig(
              target.key as Parameters<typeof ctx.api.own.getAbilityConfig>[0],
            ) as Record<string, unknown>) ?? {}
          // Apply any PREPARE-timing effect the copied card would normally
          // run once at setup, then enable it so its combat-timing invokes
          // fire from here on.
          for (const inv of resolveInvokes(target, copiedParams, ctx)) {
            if (inv.timing !== 'PREPARE') continue
            ;(inv.call as (c: typeof ctx, p: Record<string, unknown>) => void)(
              ctx,
              copiedParams,
            )
          }
          ctx.api.own.updateAbilityConfig(target.key, { isEnabled: true })
        },
      },
    ],
  }
}
