import { describe, expect, it } from 'vitest'
import { DimGrid, dimgrid } from './index.js'

describe('dimgrid', () => {
  it('starts with a single empty point', () => {
    const grid = dimgrid()
    expect(grid.size).toBe(1)
    expect(grid.toArray()).toEqual([{}])
  })

  it('expands one dimension', () => {
    const grid = dimgrid().dim('color', ['red', 'green', 'blue'])
    expect(grid.size).toBe(3)
    expect(grid.toArray()).toEqual([
      { color: 'red' },
      { color: 'green' },
      { color: 'blue' },
    ])
  })

  it('produces cartesian product across two dimensions', () => {
    const grid = dimgrid().dim('x', [1, 2]).dim('y', ['a', 'b'])
    expect(grid.size).toBe(4)
    expect(grid.toArray()).toEqual([
      { x: 1, y: 'a' },
      { x: 1, y: 'b' },
      { x: 2, y: 'a' },
      { x: 2, y: 'b' },
    ])
  })

  it('produces cartesian product across three dimensions', () => {
    const grid = dimgrid().dim('a', [0, 1]).dim('b', [0, 1]).dim('c', [0, 1])
    expect(grid.size).toBe(8)
  })

  it('returns cached size on repeated calls for static grids', () => {
    const grid = dimgrid().dim('a', [1, 2, 3]).dim('b', ['x', 'y'])
    expect(grid.size).toBe(6)
    expect(grid.size).toBe(6)
  })

  it('returns empty grid when a dimension has no values', () => {
    const grid = dimgrid().dim('x', []).dim('y', [1, 2])
    expect(grid.size).toBe(0)
    expect(grid.toArray()).toEqual([])
  })

  it('is iterable', () => {
    const grid = dimgrid().dim('n', [10, 20])
    const points = [...grid]
    expect(points).toEqual([{ n: 10 }, { n: 20 }])
  })

  it('DimGrid.create() is equivalent to dimgrid()', () => {
    expect(DimGrid.create().toArray()).toEqual(dimgrid().toArray())
  })

  describe('extending an existing dimension', () => {
    it('appends new values instead of multiplying', () => {
      const grid = dimgrid().dim('a', [1, 2]).dim('a', [3])
      expect(grid.size).toBe(3)
      expect(grid.toArray()).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }])
    })

    it('preserves other dimensions when extending', () => {
      const grid = dimgrid()
        .dim('color', ['red', 'green'])
        .dim('size', ['S', 'M'])
        .dim('color', ['blue'])
      expect(grid.size).toBe(6)
      expect(grid.toArray()).toEqual([
        { color: 'red', size: 'S' },
        { color: 'red', size: 'M' },
        { color: 'green', size: 'S' },
        { color: 'green', size: 'M' },
        { color: 'blue', size: 'S' },
        { color: 'blue', size: 'M' },
      ])
    })

    it('is equivalent to declaring all values upfront', () => {
      const extended = dimgrid().dim('a', [1, 2]).dim('b', ['x', 'y']).dim('a', [2, 3])
      const upfront = dimgrid().dim('a', [1, 2, 3]).dim('b', ['x', 'y'])
      expect(extended.size).toBe(upfront.size)
      expect(extended.toArray()).toEqual(upfront.toArray())
    })

    it('extends a static dimension with a dynamic resolver', () => {
      const grid = dimgrid().dim('x', [1, 2]).dim('x', () => [3])
      expect(grid.size).toBe(3)
      expect(grid.toArray()).toEqual([{ x: 1 }, { x: 2 }, { x: 3 }])
    })
  })

  describe('add with function', () => {
    it('uses parent point to derive values', () => {
      const grid = dimgrid()
        .dim('sign', [-1, 1])
        .dim('magnitude', ({ sign }) => (sign > 0 ? [1, 2, 3] : [1]))
      expect(grid.size).toBe(4)
      expect(grid.toArray()).toEqual([
        { sign: -1, magnitude: 1 },
        { sign: 1, magnitude: 1 },
        { sign: 1, magnitude: 2 },
        { sign: 1, magnitude: 3 },
      ])
    })

    it('can skip a point entirely by returning an empty array', () => {
      const grid = dimgrid()
        .dim('x', [1, 2, 3])
        .dim('y', ({ x }) => (x % 2 === 0 ? [] : [10, 20]))
      expect(grid.toArray()).toEqual([
        { x: 1, y: 10 },
        { x: 1, y: 20 },
        { x: 3, y: 10 },
        { x: 3, y: 20 },
      ])
    })
  })

  describe('seeding with a single point', () => {
    it('starts with the given point', () => {
      const grid = dimgrid({ mode: 'fast' })
      expect(grid.size).toBe(1)
      expect(grid.toArray()).toEqual([{ mode: 'fast' }])
    })

    it('multiplies dimensions from the seed point', () => {
      const grid = dimgrid({ mode: 'fast' }).dim('n', [1, 2])
      expect(grid.size).toBe(2)
      expect(grid.toArray()).toEqual([
        { mode: 'fast', n: 1 },
        { mode: 'fast', n: 2 },
      ])
    })

    it('caches size for a point-seeded static grid', () => {
      const grid = dimgrid({ a: 1 }).dim('b', ['x', 'y'])
      expect(grid.size).toBe(2)
      expect(grid.size).toBe(2)
    })

    it('yields a copy, not the original seed object', () => {
      const point = { mode: 'fast' }
      const grid = dimgrid(point)
      expect(grid.toArray()[0]).toEqual(point)
      expect(grid.toArray()[0]).not.toBe(point)
    })

    it('DimGrid.create(point) is equivalent to dimgrid(point)', () => {
      expect(DimGrid.create({ a: 1 }).toArray()).toEqual(dimgrid({ a: 1 }).toArray())
    })
  })

  describe('seeding with an iterable', () => {
    it('starts with the given points', () => {
      const grid = dimgrid([{ a: 1 }, { a: 2 }])
      expect(grid.size).toBe(2)
      expect(grid.toArray()).toEqual([{ a: 1 }, { a: 2 }])
    })

    it('multiplies dimensions from each seed point', () => {
      const grid = dimgrid([{ a: 1 }, { a: 2 }]).dim('b', ['x', 'y'])
      expect(grid.toArray()).toEqual([
        { a: 1, b: 'x' },
        { a: 1, b: 'y' },
        { a: 2, b: 'x' },
        { a: 2, b: 'y' },
      ])
    })

    it('yields nothing for an empty seed', () => {
      const grid = dimgrid([] as { a: number }[]).dim('b', [1, 2])
      expect(grid.size).toBe(0)
      expect(grid.toArray()).toEqual([])
    })

    it('does not dedupe duplicate seed points', () => {
      const grid = dimgrid([{ a: 1 }, { a: 1 }])
      expect(grid.toArray()).toEqual([{ a: 1 }, { a: 1 }])
    })

    it('seeds from another grid', () => {
      const inner = dimgrid().dim('a', [1, 2])
      const grid = dimgrid(inner).dim('b', ['x'])
      expect(grid.toArray()).toEqual([
        { a: 1, b: 'x' },
        { a: 2, b: 'x' },
      ])
    })

    it("re-resolves a seeding grid's dynamic dimensions on each iteration", () => {
      let limit = 1
      const inner = dimgrid().dim('n', () => (limit === 1 ? [1] : [1, 2]))
      const outer = dimgrid(inner).dim('m', ['x'])
      expect(outer.toArray()).toEqual([{ n: 1, m: 'x' }])
      limit = 2
      expect(outer.toArray()).toEqual([
        { n: 1, m: 'x' },
        { n: 2, m: 'x' },
      ])
    })

    it('recomputes size on every call for iterable seeds', () => {
      const points = [{ a: 1 }]
      const grid = dimgrid(points)
      expect(grid.size).toBe(1)
      points.push({ a: 2 })
      expect(grid.size).toBe(2)
    })

    it('a one-shot generator seed is exhausted after the first iteration', () => {
      function* points() {
        yield { a: 1 }
        yield { a: 2 }
      }
      const grid = dimgrid(points())
      expect(grid.toArray()).toEqual([{ a: 1 }, { a: 2 }])
      expect(grid.toArray()).toEqual([])
    })
  })
})
