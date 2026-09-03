import type { Ability } from '@/combat'

export const publicizeWeaponSchematics: Ability = {
  key: 'PUBLICIZE_WEAPON_SCHEMATICS',
  name: 'Publicize Weapon Schematics',
  description: 'All war suns lose Sustain Damage.',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: Infinity,
  },
  sync: true,
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        ctx.api.own.setUnitAbilityLost(
          'SUSTAIN_DAMAGE',
          ctx.this.key,
          'WAR_SUN',
        )
      },
    },
  ],
}
