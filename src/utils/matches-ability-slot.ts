import type { CollectedAbility, SlotConfig } from '@/types'

/** Match a registered ability against a system's slot config for this faction. */
export function matchesAbilitySlot(
  ability: Pick<CollectedAbility, 'slot' | 'factionKey'>,
  config: SlotConfig,
  factionKey: string,
  inheritedNeutral = true,
): boolean {
  const slots = typeof config.slot === 'string' ? [config.slot] : config.slot
  if (!slots.includes(ability.slot)) return false
  if (factionKey === 'NEUTRAL' && !(config.neutral ?? inheritedNeutral)) {
    return false
  }
  switch (config.strategy) {
    case 'OWN':
      return ability.factionKey === factionKey
    case 'OTHER':
      return (
        ability.factionKey !== undefined && ability.factionKey !== factionKey
      )
    case 'ALL':
      return ability.factionKey !== undefined
    default:
      return ability.factionKey === undefined
  }
}
