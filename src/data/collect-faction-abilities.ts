import type { Ability } from '@/combat'
import type { CollectedAbility, Faction, UnitBaseType } from '@/types'
import { factionSlot } from '@/utils/faction-slot'

function hasUI(ability: Ability): boolean {
  return Boolean(ability.headerUI || ability.uiConfig)
}

/** Collect the registered shape of abilities owned by one resolved faction. */
export function collectFactionAbilities(
  factionKey: string,
  faction: Faction,
  genericKeys: ReadonlySet<string>,
  requestedSlot?: string,
): CollectedAbility[] {
  const result: CollectedAbility[] = []
  const register = (
    ability: Ability,
    slot: string,
    deploy?: CollectedAbility['deploy'],
  ): CollectedAbility => ({
    ...ability,
    ...(ability.icon === undefined && faction.icon !== undefined
      ? { icon: faction.icon }
      : {}),
    slot,
    factionKey,
    ...(deploy && { deploy }),
  })

  for (const [group, list] of Object.entries(faction.abilities ?? {})) {
    const slot = factionSlot(group)
    if (requestedSlot !== undefined && requestedSlot !== slot) continue
    for (const ability of list) result.push(register(ability, slot))
  }

  const seen = new Set<string>()
  for (const [unitTypeKey, unit] of Object.entries(faction.units)) {
    if (!unit) continue
    const unitType = unitTypeKey as UnitBaseType
    const slot = factionSlot(unitType)
    if (requestedSlot !== undefined && requestedSlot !== slot) continue
    for (const ability of [
      ...(unit.BASE.ABILITIES ?? []),
      ...(unit.UPGRADED?.ABILITIES ?? []),
    ]) {
      if (genericKeys.has(ability.key)) continue
      if (seen.has(ability.key) || !hasUI(ability)) continue
      seen.add(ability.key)
      result.push(register(ability, slot))
    }

    const base = unit.BASE.UNIT_ABILITIES?.DEPLOY
    const upgraded = unit.UPGRADED?.UNIT_ABILITIES?.DEPLOY
    for (const [ability, deploy] of [
      [base, { unitType, base: true, upgraded: !upgraded }],
      [upgraded, { unitType, base: false, upgraded: true }],
    ] as const) {
      if (!ability || seen.has(ability.key) || !hasUI(ability)) continue
      seen.add(ability.key)
      result.push(register(ability, slot, deploy))
    }
  }
  return result
}
