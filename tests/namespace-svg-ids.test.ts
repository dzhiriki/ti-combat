import { describe, expect, it } from 'vitest'

import { namespaceSvgIds } from '@/utils/namespace-svg-ids'

describe('namespaceSvgIds', () => {
  it('prefixes id definitions and url(#...) references together', () => {
    const svg =
      '<svg><defs><clipPath id="a"><path d="M0 0"/></clipPath></defs>' +
      '<g clip-path="url(#a)"><use href="#a"/></g></svg>'
    const out = namespaceSvgIds(svg, 'p1')
    expect(out).toContain('id="p1-a"')
    expect(out).toContain('url(#p1-a)')
    expect(out).toContain('href="#p1-a"')
    expect(out).not.toContain('id="a"')
  })

  it('rewrites xlink:href references', () => {
    const svg = '<svg><use xlink:href="#b"/><path id="b"/></svg>'
    const out = namespaceSvgIds(svg, 'p2')
    expect(out).toContain('xlink:href="#p2-b"')
    expect(out).toContain('id="p2-b"')
  })

  it('strips unsafe characters from the prefix (React useId colons/guillemets)', () => {
    const out = namespaceSvgIds('<path id="a"/>', '«r1»')
    expect(out).toContain('id="r1-a"')
  })

  it('two icons namespaced with different prefixes share no ids', () => {
    const svg = '<svg><clipPath id="a"/><g clip-path="url(#a)"/></svg>'
    const one = namespaceSvgIds(svg, 'x1')
    const two = namespaceSvgIds(svg, 'x2')
    const ids = (s: string) => [...s.matchAll(/id="([^"]+)"/g)].map(m => m[1])
    expect(ids(one)).not.toEqual(ids(two))
  })
})
