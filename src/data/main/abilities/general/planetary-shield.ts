import type { Ability, AbilityCallContext } from '@/combat'

/** Only a shield on the planet under attack stops bombardment. The
 *  restriction is side-wide, so it follows the active planet: set while an
 *  own working shield stands there, lifted otherwise. Every shield unit
 *  reaches the same answer. */
function syncShield(ctx: AbilityCallContext): void {
  const own = ctx.api.own
  const shielded = own.surface
    .getUnits()
    .some(
      id =>
        !!own.getUnitStats(id)?.UNIT_ABILITIES?.PLANETARY_SHIELD &&
        !own.isUnitAbilityDisabled('PLANETARY_SHIELD', id),
    )
  if (shielded)
    ctx.api.opponent.setUnitAbilityCannotBeUsed('BOMBARDMENT', ctx.this.key)
  else
    ctx.api.opponent.removeUnitAbilityCannotBeUsed('BOMBARDMENT', ctx.this.key)
}

export const planetaryShield: Ability = {
  key: 'PLANETARY_SHIELD',
  name: 'Planetary Shield',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  side: 'defender',
  // Bombardment moves between planets (a split bombardment, Harrow during
  // each planet's combat), so each roll re-checks its planet.
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'BOMBARDMENT',
      isCallable: (_params, ctx) => ctx.unitSource !== undefined,
      call: syncShield,
    },
  ],
}
