import type { FactionKey, UnitBaseType } from '@/types'

/** AsyncTI4 faction id → simulator `FactionKey`.
 *
 *  AsyncTI4 carries far more factions than this calculator models (Discordant
 *  Stars and a long tail of homebrew); anything absent here is reported as
 *  unmapped rather than guessed at. The Keleres flavours (Argent/Mentak/Xxcha)
 *  are separate ids upstream but share one faction sheet here. */
export const FACTION_BY_ASYNC_ID: Readonly<Record<string, FactionKey>> = {
  // Base game
  arborec: 'ARBOREC',
  ghost: 'GHOSTS_OF_CREUSS',
  hacan: 'EMIRATES_OF_HACAN',
  jolnar: 'UNIVERSITIES_OF_JOL_NAR',
  l1z1x: 'L1Z1X_MINDNET',
  letnev: 'BARONY_OF_LETNEV',
  mentak: 'MENTAK_COALITION',
  muaat: 'EMBERS_OF_MUAAT',
  naalu: 'NAALU_COLLECTIVE',
  nekro: 'NEKRO_VIRUS',
  saar: 'CLAN_OF_SAAR',
  sardakk: 'SARDAKK_NORR',
  sol: 'FEDERATION_OF_SOL',
  winnu: 'WINNU',
  xxcha: 'XXCHA_KINGDOM',
  yin: 'YIN_BROTHERHOOD',
  yssaril: 'YSSARIL_TRIBES',
  // Prophecy of Kings
  argent: 'ARGENT_FLIGHT',
  cabal: 'VUILRAITH_CABAL',
  empyrean: 'EMPYREAN',
  mahact: 'MAHACT_GENE_SORCERERS',
  naaz: 'NAAZ_ROKHA_ALLIANCE',
  nomad: 'NOMAD',
  titans: 'TITANS_OF_UL',
  // Codex III — one sheet per Keleres flavour upstream
  keleres: 'COUNCIL_KELERES',
  keleresa: 'COUNCIL_KELERES',
  keleresm: 'COUNCIL_KELERES',
  keleresx: 'COUNCIL_KELERES',
  // Thunder's Edge
  bastion: 'LAST_BASTION',
  crimson: 'CRIMSON_REBELLION',
  deepwrought: 'DEEPWROUGHT_SCHOLARATE',
  firmament: 'FIRMAMENT',
  obsidian: 'OBSIDIAN',
  ralnel: 'RAL_NEL',
  // Twilight's Fall — upstream ids are colours; matched by flagship/mech name
  blacktf: 'SICKENING_LURCH',
  bluetf: 'SAINT_OF_SWORDS',
  greentf: 'IL_SAI_LAKOE',
  orangetf: 'RADIANT_AUR',
  pinktf: 'EL_NEN_JANOVET',
  purpletf: 'IL_NA_VIROSET',
  redtf: 'RUBY_MONARCH',
  yellowtf: 'AVARICE_REX',
  // The unowned units AsyncTI4 parks on the map
  neutral: 'NEUTRAL',
}

/** AsyncTI4 unit `asyncId` → simulator `UnitBaseType`. The ids are naval hull
 *  codes, so `cv` is the carrier and `ca` the cruiser. Nomad's extra flagships
 *  (`cavalry`, `tyrantslament`) and the structures this calculator has no
 *  combat model for (`monument`, `plenaryorbital`) are deliberately absent. */
export const UNIT_TYPE_BY_ASYNC_ID: Readonly<Record<string, UnitBaseType>> = {
  fs: 'FLAGSHIP',
  ws: 'WAR_SUN',
  dn: 'DREADNOUGHT',
  cv: 'CARRIER',
  ca: 'CRUISER',
  dd: 'DESTROYER',
  ff: 'FIGHTER',
  mf: 'MECH',
  gf: 'INFANTRY',
  pd: 'PDS',
  sd: 'SPACE_DOCK',
}

/** Tech aliases that flip a unit type to its UPGRADED stat block, covering the
 *  generic upgrades plus every faction upgrade this calculator models.
 *
 *  `ws` (War Sun) is absent on purpose: it unlocks the unit rather than
 *  upgrading it, and War Sun count is imported from the map like any other. */
export const UNIT_UPGRADE_BY_TECH: Readonly<Record<string, UnitBaseType>> = {
  ac2: 'CARRIER', // Advanced Carrier II
  cl2: 'INFANTRY', // Crimson Legionnaire II
  cr2: 'CRUISER', // Cruiser II
  cv2: 'CARRIER', // Carrier II
  dd2: 'DESTROYER', // Destroyer II
  dn2: 'DREADNOUGHT', // Dreadnought II
  dt2: 'SPACE_DOCK', // Dimensional Tear II
  exile2: 'DESTROYER', // Exile II
  exo2: 'DREADNOUGHT', // Exotrireme II
  ff2: 'FIGHTER', // Fighter II
  ffac2: 'SPACE_DOCK', // Floating Factory II
  hcf2: 'FIGHTER', // Hybrid Crystal Fighter II
  helios2: 'SPACE_DOCK', // 4X41C "Helios" V2
  ht2: 'PDS', // Hel-Titan II
  inf2: 'INFANTRY', // Infantry II
  linkship2: 'DESTROYER', // Linkship II
  lw2: 'INFANTRY', // Letani Warrior II
  m2: 'FLAGSHIP', // Memoria II
  pds2: 'PDS', // PDS II
  pws2: 'WAR_SUN', // Prototype War Sun II
  sd2: 'SPACE_DOCK', // Space Dock II
  sdn2: 'DREADNOUGHT', // Super Dreadnought II
  se2: 'CRUISER', // Saturn Engine II
  so2: 'INFANTRY', // Spec Ops II
  swa2: 'DESTROYER', // Strike Wing Alpha II
}

/** Tech aliases that enable a modelled ability.
 *
 *  Codex revisions are separate aliases upstream and are only mapped where the
 *  revision matches the card this calculator implements. `md_base` and
 *  `x89`/`x89_base` are left out for that reason — the pre-Omega Magen and both
 *  earlier X-89 printings do something else entirely, so importing them would
 *  quietly simulate the wrong card. */
export const ABILITY_BY_TECH: Readonly<Record<string, string>> = {
  amd: 'ANTIMASS_DEFLECTORS',
  asc: 'ASSAULT_CANNON',
  da: 'DURANIUM_ARMOR',
  gls: 'GRAVITON_LASER_SYSTEM',
  md_c1: 'MAGEN_DEFENSE_GRID', // Magen Defense Grid Ω
  md: 'MAGEN_DEFENSE_GRID', // Magen Defense Grid ΩΩ
  ps: 'PLASMA_SCORING',
  x89c4: 'X_89_BACTERIAL_WEAPON', // X-89 Bacterial Weapon ΩΩ
  // Twilight's Fall shared deck
  'tf-ambush': 'AMBUSH',
  'tf-devotion': 'DEVOTION',
  'tf-ds': 'DIMENSIONAL_SPLICER',
  'tf-harrow': 'HARROW',
  'tf-indoctrination': 'INDOCTRINATION',
  'tf-munitions': 'MUNITIONS_RESERVES',
  'tf-nes': 'NON_EUCLIDEAN_SHIELDING',
  'tf-planesplitter': 'TF_PLANESPLITTER',
  'tf-proxima': 'TF_PROXIMA_TARGETING_VI',
  'tf-raidformation': 'RAID_FORMATION',
  'tf-singularityx': 'TF_SINGULARITY_X',
  'tf-singularityy': 'TF_SINGULARITY_Y',
  'tf-singularityz': 'TF_SINGULARITY_Z',
  'tf-smotheringpresence': 'TF_SMOTHERING_PRESENCE',
  'tf-supercharge': 'TF_SUPERCHARGE',
  'tf-tacticalbrilliance': 'AGNLAN_OLN',
  'tf-tcs': 'TF_TEMPORAL_COMMAND_SUITE',
  'tf-unrelenting': 'UNRELENTING',
  'tf-valkyrie': 'GHOM_SEKKUS',
  'tf-vpw': 'VALKYRIE_PARTICLE_WEAVE',
  'tf-zealous': 'TRRAKAN_AUN_ZULOK',
}

/** Cards this calculator knowingly does not model, kept so the import can say
 *  so instead of silently dropping them. Anything not listed here and not
 *  mapped above is an economy or movement tech with no effect on combat. */
export const UNMODELLED_TECHS: Readonly<Record<string, string>> = {
  md_base: 'Magen Defense Grid (pre-Ω printing)',
  x89_base: 'X-89 Bacterial Weapon (pre-Ω printing)',
  x89: 'X-89 Bacterial Weapon Ω',
}
