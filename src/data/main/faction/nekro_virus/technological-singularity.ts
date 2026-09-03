import { extractDefaults } from '@/combat/abilities-engine/declare-param'
import type {
  Ability,
  AbilityCallContext,
  AbilityReadContext,
  SelectGroup,
  SelectItem,
} from '@/combat/abilities-engine/types'

type SingularityAbilityEntry = {
  key: string
  name: string
  subcategory?: string
  prepareCalls: ((ctx: AbilityCallContext, ...rest: unknown[]) => void)[]
}

type TSParams = {
  enableAbilityKey: string
  disableAbilityKey: string
  enableMordred: boolean
  disableMordred: boolean
  opponentDestroyed?: boolean
}

type TaggedAbility = {
  ability: Ability
  subcategory:
    | 'TECHNOLOGY'
    | 'UNIT_UPGRADE'
    | 'FACTION_TECHNOLOGY'
    | 'FACTION_UNIT'
    | 'FLAGSHIP'
}

export function createTechnologicalSingularity(
  enableAbilityList: TaggedAbility[],
  disableAbilityList: TaggedAbility[],
  mordredAbility: Ability,
): Ability<TSParams> {
  const NONE = 'none'
  const enableAbilities = enableAbilityList.map(t =>
    collectInvokes(t.ability, t.subcategory),
  )
  const disableAbilities = disableAbilityList.map(t =>
    collectInvokes(t.ability, t.subcategory),
  )

  const abilityLookup = new Map<string, SingularityAbilityEntry>(
    [...enableAbilities, ...disableAbilities].map(e => [e.key, e]),
  )

  // Map of enable-list keys → original ability, used to forward
  // declareParamChange / declareSubtype at setup so the picked ability's
  // declarations propagate (e.g. Hel Titan II → PDS as ground force).
  const enableAbilityByKey = new Map<string, Ability>(
    enableAbilityList.map(t => [t.ability.key, t.ability]),
  )

  const mordredEntry = collectInvokes(mordredAbility)

  return {
    key: 'TECHNOLOGICAL_SINGULARITY',
    name: 'Technological Singularity',
    description:
      "Once per combat, after 1 of your opponent's units is destroyed, you may gain 1 technology that is owned by that player.",
    params: {
      isEnabled: false,
      uses: Infinity,
      enableAbilityKey: NONE,
      disableAbilityKey: NONE,
      enableMordred: false,
      disableMordred: false,
    },
    headerUI: 'isEnabled',
    declareParamChange: (params, settings) => {
      if (!params.isEnabled) return []
      if (params.enableAbilityKey === NONE) return []
      const target = enableAbilityByKey.get(params.enableAbilityKey)
      if (!target?.declareParamChange) return []
      const synth = {
        ...extractDefaults(target),
        [target.headerUI ?? 'isEnabled']: true,
      } as Parameters<NonNullable<typeof target.declareParamChange>>[0]
      return target.declareParamChange(synth, settings)
    },
    uiConfig: ctx => {
      const disableGroups = buildSelectGroups(
        disableAbilities,
        ctx,
        enabled => enabled,
      )
      const mordredEnabled = !!ctx.api.own.getAbilityConfig(
        'MORDRED' as keyof AbilityConfigMap,
      )?.isEnabled
      return [
        {
          key: 'enableAbilityKey' as const,
          label: 'Enable ability',
          type: 'select' as const,
          items: [
            { label: 'None', value: NONE } satisfies SelectItem,
            ...buildSelectGroups(enableAbilities, ctx, enabled => !enabled),
          ],
        },
        ...(disableGroups.length > 0
          ? [
              {
                key: 'disableAbilityKey' as const,
                label: 'Disable ability',
                type: 'select' as const,
                items: [
                  { label: 'None', value: NONE } satisfies SelectItem,
                  ...disableGroups,
                ],
              },
            ]
          : []),
        mordredEnabled
          ? {
              key: 'disableMordred' as const,
              label: 'Disable Mordred',
              type: 'checkbox' as const,
            }
          : {
              key: 'enableMordred' as const,
              label: 'Enable Mordred',
              type: 'checkbox' as const,
            },
      ]
    },
    onParamSet: (currentParams, key, value) => {
      if (
        key === 'enableAbilityKey' &&
        value !== NONE &&
        value === currentParams.disableAbilityKey
      ) {
        return { ...currentParams, disableAbilityKey: NONE }
      }
      if (
        key === 'disableAbilityKey' &&
        value !== NONE &&
        value === currentParams.enableAbilityKey
      ) {
        return { ...currentParams, enableAbilityKey: NONE }
      }
      return currentParams
    },
    invoke: [
      {
        timing: 'AFTER_DESTROY',
        context: ['SPACE_COMBAT', 'GROUND_COMBAT'],
        isCallable: (params, ctx, ids) => {
          if (params.opponentDestroyed) return false
          return ids.some(id => !!ctx.api.opponent.getUnitVariantKey(id))
        },
        call: (ctx, params) => {
          ctx.api.own.updateAbilityConfig({ opponentDestroyed: true })

          // Run disables first so their reset reverts don't overwrite
          // newly applied PREPARE stats
          if (params.disableAbilityKey !== NONE) {
            const config = ctx.api.own.getAbilityConfig(
              params.disableAbilityKey as keyof AbilityConfigMap,
            ) as unknown as { reset: (ctx: AbilityCallContext) => void }
            if (config.reset) {
              config.reset(ctx)
            }
          }

          if (params.enableAbilityKey !== NONE) {
            const entry = abilityLookup.get(params.enableAbilityKey)
            if (entry) {
              const abilityParams =
                ctx.api.own.getAbilityConfig(
                  entry.key as keyof AbilityConfigMap,
                ) ?? {}
              for (const call of entry.prepareCalls) call(ctx, abilityParams)
              ctx.api.own.updateAbilityConfig(params.enableAbilityKey, {
                isEnabled: true,
              })
            }
          }

          if (params.enableMordred) {
            for (const call of mordredEntry.prepareCalls)
              call(
                ctx,
                ctx.api.own.getAbilityConfig(
                  'MORDRED' as keyof AbilityConfigMap,
                ) ?? {},
              )
            ctx.api.own.updateAbilityConfig('MORDRED', { isEnabled: true })
          }
          if (params.disableMordred) {
            ctx.api.own.updateAbilityConfig('MORDRED', { isEnabled: false })
          }
        },
      },
    ],
  }
}

function collectInvokes(
  ability: Ability,
  subcategory?:
    | 'TECHNOLOGY'
    | 'UNIT_UPGRADE'
    | 'FACTION_TECHNOLOGY'
    | 'FACTION_UNIT'
    | 'FLAGSHIP'
    | 'ABILITY',
): SingularityAbilityEntry {
  const prepareCalls: ((
    ctx: AbilityCallContext,
    ...rest: unknown[]
  ) => void)[] = []
  for (const inv of ability.invoke) {
    if (inv.timing === 'PREPARE')
      prepareCalls.push(
        inv.call as (ctx: AbilityCallContext, ...rest: unknown[]) => void,
      )
  }
  return {
    key: ability.key,
    name: ability.name,
    subcategory,
    prepareCalls,
  }
}

function buildSelectGroups(
  entries: SingularityAbilityEntry[],
  ctx: AbilityReadContext,
  filter: (isEnabled: boolean) => boolean,
): SelectGroup[] {
  const SUBCATEGORY_LABELS: Record<string, string> = {
    TECHNOLOGY: 'Technology',
    UNIT_UPGRADE: 'Unit Upgrade',
    FACTION_TECHNOLOGY: 'Faction Technology',
    FACTION_UNIT: 'Faction Unit',
    FLAGSHIP: 'Flagship',
  }
  const grouped = new Map<string, { label: string; value: string }[]>()
  for (const entry of entries) {
    const config = ctx.api.own.getAbilityConfig(
      entry.key as keyof AbilityConfigMap,
    )
    const isEnabled = !!config?.isEnabled
    if (!filter(isEnabled)) continue
    const sub = entry.subcategory ?? 'ABILITY'
    if (!grouped.has(sub)) grouped.set(sub, [])
    grouped.get(sub)!.push({ label: entry.name, value: entry.key })
  }
  return [...grouped.entries()].map(([sub, items]) => ({
    group: SUBCATEGORY_LABELS[sub] ?? sub,
    items,
  }))
}
