// Compares engine performance of the working tree against a git ref.
//
// Absolute timings depend on the machine, so there is no stored baseline:
// `src/` of the base ref is extracted next to the working tree, both are
// bundled with the same harness, and the two bundles are run in alternating
// rounds on the same machine. Only the per-round head/base ratio is judged.
//
//   npm run bench                 # working tree vs HEAD
//   npm run bench -- main         # working tree vs main
//   npm run bench -- --help

import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { build } from 'vite'

import { formatMarkdown, formatTable } from './report.ts'
import type { RunnerOptions, RunnerResult } from './runner.ts'
import { compareScenario, median } from './stats.ts'

type Side = 'base' | 'head'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CACHE_DIR = path.join(ROOT, 'node_modules/.cache/bench')
const RUNNER = path.join(import.meta.dirname, 'runner.ts')
const SCENARIOS = readdirSync(path.join(import.meta.dirname, 'scenarios'))
  .filter(file => file.endsWith('.ts'))
  .map(file => path.basename(file, '.ts'))
  .sort()

const USAGE = `Usage: npm run bench -- [base-ref] [options]

Compares src/ in the working tree against [base-ref] (default: HEAD).

Options:
  --rounds <n>       base/head process pairs to run (default: 10)
  --warmup <n>       unmeasured iterations per process (default: 1)
  --iterations <n>   measured iterations per process (default: 2)
  --threshold <pct>  smallest change reported as slower/faster (default: 5)
  --only <names>     comma-separated scenarios (${SCENARIOS.join(', ')})
  -h, --help         show this help

Exits with code 1 when any scenario is slower.`

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function intOption(name: string, value: string, min: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`--${name} must be an integer >= ${min}, got "${value}"`)
  }
  return parsed
}

function extractSource(sha: string): string {
  const dir = path.join(CACHE_DIR, 'base-src')
  const archive = path.join(CACHE_DIR, 'base-src.tar')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  git('archive', '--output', archive, sha, 'src')
  execFileSync('tar', ['-xf', archive, '-C', dir])
  return path.join(dir, 'src')
}

async function bundle(side: Side, srcDir: string): Promise<string> {
  const outDir = path.join(CACHE_DIR, side)
  await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    publicDir: false,
    resolve: { alias: { '@': srcDir } },
    ssr: { noExternal: true },
    build: {
      ssr: RUNNER,
      outDir,
      emptyOutDir: true,
      minify: false,
      target: 'esnext',
      rolldownOptions: { output: { entryFileNames: 'runner.mjs' } },
    },
  })
  return path.join(outDir, 'runner.mjs')
}

function run(side: Side, file: string, options: RunnerOptions): RunnerResult {
  try {
    const output = execFileSync(
      process.execPath,
      [file, JSON.stringify(options)],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    )
    return JSON.parse(output)
  } catch (error) {
    throw new Error(`Benchmark run failed for ${side}`, { cause: error })
  }
}

function progress(message: string | null) {
  if (process.stdout.isTTY) process.stdout.write(`\r\x1b[K${message ?? ''}`)
  else if (message) console.info(message)
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      rounds: { type: 'string', default: '10' },
      warmup: { type: 'string', default: '1' },
      iterations: { type: 'string', default: '2' },
      threshold: { type: 'string', default: '5' },
      only: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })

  if (values.help) {
    console.info(USAGE)
    return
  }

  // 5 is the fewest paired samples that can yield a 90% median interval.
  const rounds = intOption('rounds', values.rounds, 5)
  const threshold = Number(values.threshold) / 100
  if (!(threshold >= 0)) {
    throw new Error(
      `--threshold must be a percentage, got "${values.threshold}"`,
    )
  }
  const names = values.only?.split(',') ?? SCENARIOS
  const unknown = names.filter(name => !SCENARIOS.includes(name))
  if (unknown.length > 0) throw new Error(`Unknown scenario: ${unknown}`)
  const options: RunnerOptions = {
    names,
    warmup: intOption('warmup', values.warmup, 0),
    iterations: intOption('iterations', values.iterations, 1),
  }

  const baseRef = positionals[0] ?? 'HEAD'
  const baseSha = git('rev-parse', '--verify', `${baseRef}^{commit}`)
  const shortSha = baseSha.slice(0, 7)
  const baseLabel = baseSha.startsWith(baseRef)
    ? shortSha
    : `${baseRef} (${shortSha})`
  const headLabel = git('status', '--porcelain', '--', 'src')
    ? 'working tree'
    : git('rev-parse', '--short', 'HEAD')
  const title = `Performance: ${baseLabel} → ${headLabel}`

  console.info(title)
  const identical =
    git('diff', '--stat', baseSha, '--', 'src') === '' &&
    git('ls-files', '--others', '--exclude-standard', '--', 'src') === ''
  if (identical) {
    console.info(
      `src/ is identical to ${baseLabel}, so this run only measures noise.`,
    )
  }

  const bundles: Record<Side, string> = {
    base: await bundle('base', extractSource(baseSha)),
    head: await bundle('head', path.join(ROOT, 'src')),
  }

  const samples: Record<Side, Record<string, number[]>> = {
    base: Object.fromEntries(names.map(name => [name, []])),
    head: Object.fromEntries(names.map(name => [name, []])),
  }
  for (let round = 0; round < rounds; round++) {
    progress(`Round ${round + 1}/${rounds}`)
    // Alternate which side goes first so neither systematically benefits
    // from running right after an idle period or a warm cache.
    const order: Side[] = round % 2 ? ['head', 'base'] : ['base', 'head']
    for (const side of order) {
      const result = run(side, bundles[side], options)
      for (const name of names) samples[side][name].push(median(result[name]))
    }
  }
  progress(null)

  const rows = names.map(name =>
    compareScenario(name, samples.base[name], samples.head[name], threshold),
  )
  const footer =
    `Rounds: ${rounds}, iterations: ${options.iterations} ` +
    `(+${options.warmup} warmup). Changes under ±${values.threshold}% ` +
    'or with a 90% CI crossing zero are treated as noise.'

  console.info(`\n${formatTable(rows)}\n\n${footer}`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      formatMarkdown(title, rows, footer),
    )
  }

  if (rows.some(row => row.verdict === 'slower')) process.exitCode = 1
}

await main()
