// Twilight's Fall: the faction roster, the generic unit roster, and the
// shared draw-deck ability pool (Abilities, Genomes, Paradigms, Action Cards,
// Unit Upgrades). Same shape as `src/data/main`; code outside `src/data`
// must import only these index modules.

export { TF_SHARED_REGISTERED as abilities } from './abilities'
export { default as baseUnits } from './base-units'
export { default as factions } from './faction'
