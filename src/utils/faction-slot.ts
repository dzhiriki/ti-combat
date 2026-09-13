/**
 * The ability slot a faction-owned entry lives in. Both faction ability group
 * keys and unit types map onto `FACTION_<NAME>` (`hero` → `FACTION_HERO`, a
 * dreadnought → `FACTION_DREADNOUGHT`), so systems declare the slot instead of
 * a key→slot table — and an ability group named after a unit type shares that
 * unit's slot.
 */
export function factionSlot(name: string): string {
  return `FACTION_${name.toUpperCase()}`
}
