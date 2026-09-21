import type { Ability } from '@/combat'

// Twilight's Fall action card. Resembles Shields Holding but with a much wider
// timing window: "Before hits are assigned to your units" applies in space
// combat AND ground combat, and against hits from Space Cannon / AFB /
// Bombardment — so, unlike Shields Holding, there is no ability-level combat
// mode restriction and no invoke-level meta-phase restriction. It fires at
// every BEFORE_ASSIGN_HITS window (gated by `uses`).
export const hardlight: Ability = {
  key: 'TF_HARDLIGHT',
  name: 'Hardlight',
  description: 'Before hits are assigned to your units: Cancel up to 2 hits.',
  params: {
    isEnabled: true,
    uses: 0,
  },
  headerUI: 'uses',
  invoke: [
    {
      timing: 'BEFORE_ASSIGN_HITS',
      isCallable: (_params, ctx) => ctx.api.own.getPendingHits() > 0,
      call: ctx => {
        const pending = ctx.api.own.getPendingHits()
        ctx.api.own.reduceHits(Math.min(2, pending))
      },
    },
  ],
}
