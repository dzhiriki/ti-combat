import type { Ability } from '@/combat'

export const waylay: Ability = {
  key: 'WAYLAY',
  name: 'Waylay',
  description:
    'Before you roll dice for Anti-Fighter Barrage: Hits from this roll are produced against all ships (not just fighters).',
  context: 'SPACE',
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_UNIT_ABILITY_ROLL',
      context: 'AFB',
      call: ctx => {
        ctx.api.own.updateAbilityConfig('ANTI_FIGHTER_BARRAGE', {
          customPriority: true,
          unitPriority:
            ctx.api.opponent.getAbilityConfig('UNIT_PRIORITY')
              .spaceUnitPriority ?? [],
        })
      },
    },
  ],
}
