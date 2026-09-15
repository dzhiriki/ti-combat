/// <reference types="vitest" />
import fs from 'node:fs'

import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import path from 'path'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { defineConfig } from 'vite'

const mdParser = unified().use(remarkParse).use(remarkGfm)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'markdown-ast',
      transform(_code, id) {
        if (!id.endsWith('.md')) return
        const content = fs.readFileSync(id, 'utf-8')
        return `export default ${JSON.stringify(mdParser.parse(content))}`
      },
    },
    {
      name: 'html-branch-title',
      apply: 'serve',
      transformIndexHtml(html) {
        const branch = execSync('git rev-parse --abbrev-ref HEAD')
          .toString()
          .trim()
        return html.replace(
          /<title>(.*?)<\/title>/,
          `<title>[${branch}] $1</title>`,
        )
      },
    },
    react(),
  ],
  experimental: {
    bundledDev: true,
  },
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  css: {
    modules: {
      generateScopedName: (name, filename) => {
        const srcDir = path.resolve(import.meta.dirname, 'src')
        const rel = path
          .relative(srcDir, filename)
          .replace(/\.module\.css$/, '')
          .replace(/[\\/]/g, '-')
        return `${rel}__${name}`
      },
    },
  },
  test: {
    globals: true,
    css: true,
    testTimeout: 10000,
    setupFiles: [
      'tests/utils/expect.ts',
      'tests/utils/for-each-side.ts',
      'tests/utils/shuffle-abilities.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      'tests/snapshots',
    ],
  },
})
