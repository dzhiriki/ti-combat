import { extractSyncSources, withRunningAbility } from '@/combat'
import type { CombatSetup } from '@/hooks/combat-setup'
import type { CombatSide } from '@/types'

/** The options a setup control shows for a synced param. Stored lists may
 *  hold more: reconcile keeps entries for absent units hidden. */
export function setupOptions(
  setup: CombatSetup,
  abilityKey: string,
  param: string,
  side: CombatSide = 'attacker',
) {
  const ability = setup
    .getAvailableAbilities(side)
    .find(item => item.key === abilityKey)!
  const ctx = setup.getReadContext(side)
  const spec = extractSyncSources(ability)?.find(item => item.key === param)
  return withRunningAbility(ctx, ability, () =>
    ctx.api[spec?.side ?? 'own'].getUnitVariantsOptions(param),
  )
}

/** The unit locators Assign Hits Order offers in `mode`. */
export function hitOrderUnits(
  setup: CombatSetup,
  mode: 'SPACE' | 'GROUND',
  side: CombatSide = 'attacker',
): string[] {
  const param = mode === 'SPACE' ? 'spaceUnitPriority' : 'groundUnitPriority'
  return setupOptions(setup, 'UNIT_PRIORITY', param, side).map(
    item => item.value,
  )
}

/** Update an ability as the panel does: with its complete params. */
export function setAbility(
  setup: CombatSetup,
  side: CombatSide,
  abilityKey: string,
  params: Record<string, unknown>,
): void {
  setup.setAbilityParam(side, abilityKey, {
    ...setup.abilities[side][abilityKey],
    ...params,
  })
}
