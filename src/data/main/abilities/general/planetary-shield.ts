import type { Ability, AbilityReadContext } from '@/combat'

/** Only a shield on the planet under attack stops bombardment. */
const onActivePlanet = (_params: unknown, ctx: AbilityReadContext) =>
  ctx.unitSource !== undefined &&
  ctx.api.own.getUnitSurface(ctx.getUnit()) === ctx.api.own.getActiveSurfaceId()

export const planetaryShield: Ability = {
  key: 'PLANETARY_SHIELD',
  name: 'Planetary Shield',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  side: 'defender',
  // The restriction is side-wide, so it follows the planet being fought:
  // the first planet for the shared bombardment, then each planet's ground
  // combat (Harrow).
  invoke: [
    {
      timing: 'PREPARE',
      isCallable: onActivePlanet,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed('BOMBARDMENT', ctx.this.key)
      },
    },
    {
      timing: 'START_OF_COMBAT',
      context: 'GROUND_COMBAT',
      isCallable: onActivePlanet,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityCannotBeUsed('BOMBARDMENT', ctx.this.key)
      },
    },
    {
      timing: 'END_OF_COMBAT',
      isCallable: (_params, ctx) => ctx.unitSource !== undefined,
      call: ctx => {
        ctx.api.opponent.removeUnitAbilityCannotBeUsed(
          'BOMBARDMENT',
          ctx.this.key,
        )
      },
    },
  ],
}
