import type { Ability } from '@/combat'

/** Anomaly abilities whose effects the Enigma ignores. Only sources that
 *  restrict unit abilities belong here — the immunity is keyed by the
 *  restriction's `reason` (i.e. the anomaly's ability key). */
const ANOMALY_RESTRICTION_SOURCES = ['ENTROPIC_SCAR'] as const

// Il Na Viroset flagship. "This unit ignores the effects of all anomalies."
// The card says "effects", not "movement effects", so it also ignores the
// nebula's combat effect: when this side defends in a nebula, every other
// ship gets the +1 to its combat rolls but the Enigma does not — cancelled
// here with a -1 scoped to the flagship. It is likewise immune to the
// Entropic Scar's unit-ability lockout, so it keeps sustaining (and keeps
// any other unit ability it gains) while the rest of the side is stripped.
// The move-value clause is out of combat scope.
export const enigma: Ability = {
  key: 'TF_ENIGMA',
  name: 'Enigma',
  description: 'This unit ignores the effects of all anomalies.',
  context: 'SPACE',
  params: {
    isEnabled: true,
    uses: Infinity,
  },
  // The flagship's printed text — always on while the flagship is fielded.
  headerUI: 'isEnabled',
  readOnly: true,
  invoke: [
    {
      timing: 'PREPARE',
      call: ctx => {
        for (const reason of ANOMALY_RESTRICTION_SOURCES) {
          ctx.api.own.setUnitAbilityRestrictionImmunity(reason, 'FLAGSHIP')
        }
      },
    },
    {
      timing: 'BEFORE_DICE_ROLL',
      context: 'SPACE_COMBAT',
      isCallable: (_params, ctx) =>
        ctx.side === 'defender' &&
        ctx.api.own.getAbilityConfig('NEBULA' as keyof AbilityConfigMap)
          ?.isEnabled === true,
      call: ctx => {
        ctx.api.own.applyBonusToResult(-1, 'FLAGSHIP')
      },
    },
  ],
}
