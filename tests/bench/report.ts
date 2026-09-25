import { styleText } from 'node:util'

import type { ScenarioComparison, Verdict } from './stats.ts'

const HEADER = ['Scenario', 'Base', 'Head', 'Change', '90% CI']

function ms(value: number): string {
  return `${value.toFixed(1)}ms`
}

function pct(value: number): string {
  const rounded = Math.round(value * 1000) / 10
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`
}

function cells(row: ScenarioComparison): string[] {
  return [
    row.name,
    ms(row.base),
    ms(row.head),
    pct(row.change),
    `${pct(row.interval[0])} … ${pct(row.interval[1])}`,
  ]
}

const CONSOLE_VERDICT: Record<Verdict, string> = {
  slower: styleText(['bold', 'red'], 'slower'),
  faster: styleText(['bold', 'green'], 'faster'),
  same: '',
}

export function formatTable(rows: ScenarioComparison[]): string {
  const table = [HEADER, ...rows.map(cells)]
  const widths = HEADER.map((_, i) =>
    Math.max(...table.map(line => line[i].length)),
  )
  return table
    .map((line, r) => {
      const padded = line.map((cell, i) =>
        i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]),
      )
      const verdict = r === 0 ? '' : CONSOLE_VERDICT[rows[r - 1].verdict]
      return [...padded, verdict].join('   ').trimEnd()
    })
    .join('\n')
}

const MARKDOWN_VERDICT: Record<Verdict, string> = {
  slower: '🔴 slower',
  faster: '🟢 faster',
  same: '',
}

export function formatMarkdown(
  title: string,
  rows: ScenarioComparison[],
  footer: string,
): string {
  const lines = [
    `### ${title}`,
    '',
    `| ${HEADER.join(' | ')} | |`,
    '| :-- | --: | --: | --: | --: | :-- |',
    ...rows.map(
      row =>
        `| ${[...cells(row), MARKDOWN_VERDICT[row.verdict]].join(' | ')} |`,
    ),
    '',
    footer,
    '',
  ]
  return lines.join('\n')
}
