import type { Ability } from '@/combat'

export const conventionsOfWar: Ability = {
  key: 'CONVENTIONS_OF_WAR',
  name: 'Conventions of War',
  description:
    'Players cannot use Bombardment against units that are on cultural planets.',
  context: 'GROUND',
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
        ctx.api.own.setUnitAbilityCannotBeUsed('BOMBARDMENT', ctx.this.key)
      },
    },
  ],
}
