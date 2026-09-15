import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const srcDirectory = fileURLToPath(new URL('../src', import.meta.url))
const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const errors = []

function isIgnored(relativePath) {
  const normalizedPath = relativePath.split(path.sep).join('/')
  return (
    normalizedPath === 'tests' ||
    normalizedPath.startsWith('tests/') ||
    /^data\/[^/]+\/faction(?:\/|$)/.test(normalizedPath)
  )
}

function checkDirectory(directory, relativeDirectory = '') {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.join(relativeDirectory, entry.name)
    if (isIgnored(relativePath)) continue

    if (entry.isDirectory()) {
      if (!kebabCasePattern.test(entry.name)) {
        errors.push(`Directory must use kebab-case: src/${relativePath}`)
      }
      checkDirectory(path.join(directory, entry.name), relativePath)
      continue
    }

    if (!/\.(?:css|tsx?)$/.test(entry.name)) continue

    const baseName = entry.name.split('.')[0]
    if (!kebabCasePattern.test(baseName)) {
      errors.push(`File must use kebab-case: src/${relativePath}`)
    }
  }
}

checkDirectory(srcDirectory)

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
