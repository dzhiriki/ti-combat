import type { Faction } from '@/types'

import { arborec } from './arborec'
import { argent_flight } from './argent_flight'
import { barony_of_letnev } from './barony_of_letnev'
import { clan_of_saar } from './clan_of_saar'
import { council_keleres } from './council_keleres'
import { crimson_rebellion } from './crimson_rebellion'
import { deepwrought_scholarate } from './deepwrought_scholarate'
import { embers_of_muaat } from './embers_of_muaat'
import { emirates_of_hacan } from './emirates_of_hacan'
import { empyrean } from './empyrean'
import { federation_of_sol } from './federation_of_sol'
import { firmament } from './firmament'
import { ghosts_of_creuss } from './ghosts_of_creuss'
import { l1z1x_mindnet } from './l1z1x_mindnet'
import { last_bastion } from './last_bastion'
import { mahact_gene_sorcerers } from './mahact_gene_sorcerers'
import { mentak_coalition } from './mentak_coalition'
import { naalu_collective } from './naalu_collective'
import { naaz_rokha_alliance } from './naaz_rokha_alliance'
import { neutral } from './neutral'
import { nomad } from './nomad'
import { obsidian } from './obsidian'
import { ral_nel } from './ral_nel'
import { sardakk_norr } from './sardakk_norr'
import { titans_of_ul } from './titans_of_ul'
import { universities_of_jol_nar } from './universities_of_jol_nar'
import { vuilraith_cabal } from './vuilraith_cabal'
import { winnu } from './winnu'
import { xxcha_kingdom } from './xxcha_kingdom'
import { yin_brotherhood } from './yin_brotherhood'

export const otherFactions = {
  ARBOREC: arborec,
  ARGENT_FLIGHT: argent_flight,
  BARONY_OF_LETNEV: barony_of_letnev,
  CLAN_OF_SAAR: clan_of_saar,
  COUNCIL_KELERES: council_keleres,
  CRIMSON_REBELLION: crimson_rebellion,
  DEEPWROUGHT_SCHOLARATE: deepwrought_scholarate,
  EMBERS_OF_MUAAT: embers_of_muaat,
  EMIRATES_OF_HACAN: emirates_of_hacan,
  EMPYREAN: empyrean,
  FEDERATION_OF_SOL: federation_of_sol,
  FIRMAMENT: firmament,
  GHOSTS_OF_CREUSS: ghosts_of_creuss,
  L1Z1X_MINDNET: l1z1x_mindnet,
  LAST_BASTION: last_bastion,
  MAHACT_GENE_SORCERERS: mahact_gene_sorcerers,
  MENTAK_COALITION: mentak_coalition,
  NAALU_COLLECTIVE: naalu_collective,
  NAAZ_ROKHA_ALLIANCE: naaz_rokha_alliance,
  NOMAD: nomad,
  OBSIDIAN: obsidian,
  RAL_NEL: ral_nel,
  SARDAKK_NORR: sardakk_norr,
  TITANS_OF_UL: titans_of_ul,
  UNIVERSITIES_OF_JOL_NAR: universities_of_jol_nar,
  VUILRAITH_CABAL: vuilraith_cabal,
  WINNU: winnu,
  XXCHA_KINGDOM: xxcha_kingdom,
  YIN_BROTHERHOOD: yin_brotherhood,
  NEUTRAL: neutral,
} satisfies Record<string, Faction>
