import type { Ability } from '@/combat'

export const disablePlanetaryShield: Ability = {
  key: 'DISABLE_PLANETARY_SHIELD',
  name: 'Disable Planetary Shield',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  invoke: [
    {
      timing: 'PREPARE',
      // Fire only when carried by a unit on the field (a war sun). The engine
      // runs GENERAL-slot abilities as always-on config candidates for any
      // faction whose unit DEFINITIONS never mention the key — true for every
      // Twilight's Fall faction, where the default war sun keeps shields up —
      // and an unconditional PREPARE would strip the opponent's Planetary
      // Shield in every TF combat.
      isCallable: (_params, ctx) => ctx.unitSource !== undefined,
      call: ctx => {
        ctx.api.opponent.setUnitAbilityLost('PLANETARY_SHIELD', ctx.this.key)
      },
    },
  ],
}
