import type { SideApi } from '@/combat'

/** Whether an enabled upgrade extends its text to The Faces of Janovet.
 *  Kept independent of the flagship and deck modules so cards can use it
 *  without importing the faction back into the shared deck. */
export function janovetInherits(api: SideApi, upgradeKey: string): boolean {
  const janovet = api.getAbilityConfig(
    'TF_FACES_OF_JANOVET' as keyof AbilityConfigMap,
  ) as { isEnabled?: boolean } | undefined
  if (janovet?.isEnabled !== true) return false
  const card = api.getAbilityConfig(upgradeKey as keyof AbilityConfigMap) as
    | { isEnabled?: boolean }
    | undefined
  return card?.isEnabled === true
}
