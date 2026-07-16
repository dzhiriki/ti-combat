import type { Ability } from '@/combat'

// Twilight's Fall action card. "When 1 of your units would be destroyed: It is
// not destroyed instead." Modeled as a single-use cancellation of one incoming
// hit before it is assigned to your units — in this engine a pending hit is
// what destroys a (non-sustaining) unit, so cancelling one hit is exactly "one
// unit that would have died survives". Fires in any combat context (space,
// ground, or unit-ability hits like AFB / Space Cannon / Bombardment).
//
// Limitation: this covers destruction from hits. It does not counter
// direct-destroy effects that bypass the hit pool (e.g. Direct Hit / Spark),
// which would need a dedicated destroy-prevention hook.
export const divinity: Ability = {
  key: 'TF_DIVINITY',
  name: 'Divinity',
  description:
    'When 1 of your units would be destroyed: It is not destroyed instead.',
  // Single card in the deck — a one-shot toggle (uses: 1), so it can't be
  // bumped past a single save the way Hardlight's uses counter can.
  params: {
    isEnabled: false,
    uses: 1,
  },
  headerUI: 'isEnabled',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (_params, ctx) => ctx.api.own.getPendingHits() > 0,
      call: ctx => {
        ctx.api.own.reduceHits(1)
      },
    },
  ],
}
