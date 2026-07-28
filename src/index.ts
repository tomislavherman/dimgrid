type KeysOfUnion<T> = T extends unknown ? keyof T : never

// Deliberately non-homomorphic (the `in` source is not syntactically `keyof T`)
// so a union of same-shape seed points collapses into one object type instead
// of distributing: {mode:'fast'} | {mode:'slow'} → {mode:'fast' | 'slow'}.
// Also strips the readonly that `const` inference adds.
type Collapse<T> = { [K in keyof T & KeysOfUnion<T>]: T[K] }

// Keys that are required (non-optional) on a single object type.
type RequiredKeys<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? never : K }[keyof T]

// Union of required keys across all union members.
type AllRequiredKeys<T> = T extends unknown ? RequiredKeys<T> : never

// Distributes over T; `All` is precomputed so each member is compared against
// the union-wide key set rather than its own.
type EachHasAllKeys<T, All> = T extends unknown
  ? [All] extends [RequiredKeys<T>] ? true : false
  : never

// `unknown` (a no-op in an intersection) when every union member has the same
// required keys; `never` otherwise — rejects mixed-shape seed iterables at the
// call site. Compares required keys (not `keyof`) because TypeScript pads
// heterogeneous array literals with optional-undefined properties, which would
// defeat a plain `keyof` comparison.
type SameShape<T> = false extends EachHasAllKeys<T, AllRequiredKeys<T>> ? never : unknown

// Keeps arrays/grids (and mixed-shape arrays rejected by SameShape) from
// falling through to the single-point overload.
type NotIterable = { [Symbol.iterator]?: never }

type Dim = {
  key: string
  // Non-null only for static dimensions — used for O(D) size computation.
  // Null when a function resolver is involved (size requires iteration).
  staticValues: readonly unknown[] | null
  resolve: (point: Record<string, unknown>) => readonly unknown[]
}

function* generate(
  dims: readonly Dim[],
  index: number,
  point: Record<string, unknown>,
): Generator<Record<string, unknown>> {
  if (index === dims.length) {
    yield point
    return
  }
  const dim = dims[index]
  const resolved = dim.resolve(point)
  // A point can only carry this key already if it came from a seed (dimension
  // keys are unique) — union the point's own value with the dimension's values.
  const values = Object.prototype.hasOwnProperty.call(point, dim.key)
    ? deduped([point[dim.key], ...resolved])
    : resolved
  for (const value of values) {
    yield* generate(dims, index + 1, { ...point, [dim.key]: value })
  }
}

function deduped(values: readonly unknown[]): unknown[] {
  const seen = new Set<string>()
  const result: unknown[] = []
  for (const v of values) {
    const k = JSON.stringify(v)
    if (!seen.has(k)) {
      seen.add(k)
      result.push(v)
    }
  }
  return result
}

/**
 * A typed N-dimensional grid that generates the cartesian product of its dimensions.
 * Use the {@link dimgrid} factory or {@link DimGrid.create} to construct one.
 */
export class DimGrid<T extends object = {}> {
  private readonly _dims: readonly Dim[]
  private readonly _seed: Iterable<Record<string, unknown>>
  // Non-null when the seed is a fixed array of points (no-arg or single-point
  // construction) — enables O(D) size computation.
  private readonly _staticSeed: readonly Record<string, unknown>[] | null
  private _cachedSize: number | null = null

  private constructor(
    dims: readonly Dim[],
    seed: Iterable<Record<string, unknown>>,
    staticSeed: readonly Record<string, unknown>[] | null,
  ) {
    this._dims = dims
    this._seed = seed
    this._staticSeed = staticSeed
  }

  /** Creates an empty grid with no dimensions. Equivalent to calling {@link dimgrid}. */
  static create(): DimGrid<{}>
  static create<const T extends object>(
    points: Iterable<T> & SameShape<T>,
  ): DimGrid<Collapse<T>>
  static create<const T extends object>(point: T & NotIterable): DimGrid<Collapse<T>>
  static create(seed?: object): DimGrid<any> {
    if (seed === undefined) {
      const s = [{}]
      return new DimGrid<{}>([], s, s)
    }
    if (Symbol.iterator in seed) {
      return new DimGrid([], seed as Iterable<Record<string, unknown>>, null)
    }
    const s = [seed as Record<string, unknown>]
    return new DimGrid([], s, s)
  }

  /**
   * Adds a new dimension or extends an existing one.
   *
   * **New dimension** — when `key` has not been used before, the dimension is appended at the end.
   * Every existing point is combined with every value in the new dimension, so the grid size
   * multiplies by the number of values provided.
   *
   * **Existing dimension** — when `key` matches a dimension that was already added, the new values
   * are merged into it (union, not a new axis). The grid size grows by the number of previously
   * unseen values rather than multiplying again.
   *
   * **Static values** — pass a plain array when the values are known upfront and do not depend on
   * other dimensions:
   * ```ts
   * dimgrid().dim('color', ['red', 'green', 'blue'])
   * ```
   *
   * **Dynamic values** — pass a function when the values for this dimension depend on values already
   * fixed in the current point. The function receives `point`, a partial object whose properties are
   * the dimensions declared *before* this one, each already resolved to a single value. Use it to
   * make values conditional or to filter combinations:
   * ```ts
   * dimgrid()
   *   .dim('sign', [-1, 1])
   *   .dim('magnitude', ({ sign }) => sign > 0 ? [1, 2, 3] : [1])
   * // point passed to the function looks like: { sign: -1 } or { sign: 1 }
   * ```
   * Returning an empty array from the function skips that combination entirely — it acts as a filter.
   *
   * @param key - The dimension name. Becomes the property key on every generated point.
   * @param values - A static array of values, or a function `(point: T) => values[]` where `point`
   *   contains one resolved value per dimension declared before this one.
   */
  dim<K extends string, const V>(
    key: K,
    values: readonly V[] | ((point: T) => readonly V[]),
  ): K extends keyof T
    ? DimGrid<{ [P in keyof T]: P extends K ? T[P] | V : T[P] }>
    : DimGrid<{ [P in keyof T | K]: P extends K ? V : P extends keyof T ? T[P] : never }> {
    const isStatic = typeof values !== 'function'
    const staticValues = isStatic ? (values as readonly unknown[]) : null
    const newResolve = (
      isStatic ? () => values : values
    ) as (point: Record<string, unknown>) => readonly unknown[]

    const existingIndex = this._dims.findIndex(d => d.key === key)

    if (existingIndex !== -1) {
      const existing = this._dims[existingIndex]
      const newDims = [...this._dims]

      if (existing.staticValues !== null && staticValues !== null) {
        // Both static: merge into a new static dimension.
        const merged = deduped([...existing.staticValues, ...staticValues])
        newDims[existingIndex] = { key, staticValues: merged, resolve: () => merged }
      } else {
        // At least one side is dynamic: merge resolvers, drop static size tracking.
        const prevResolve = existing.resolve
        newDims[existingIndex] = {
          key,
          staticValues: null,
          resolve: (point) => deduped([...prevResolve(point), ...newResolve(point)]),
        }
      }

      return new DimGrid(newDims, this._seed, this._staticSeed) as any
    }

    return new DimGrid(
      [...this._dims, { key, staticValues, resolve: newResolve }],
      this._seed,
      this._staticSeed,
    ) as any
  }

  /** Returns all points in the grid as an array. */
  toArray(): T[] {
    return [...this]
  }

  /**
   * The total number of points in the grid.
   *
   * For static grids (no function-based dimensions) the value is computed once and cached.
   * For grids with dynamic dimensions the grid is iterated on every call, since values may
   * depend on external state.
   */
  get size(): number {
    if (this._cachedSize !== null) return this._cachedSize

    if (this._staticSeed === null) {
      // Lazy iterable seed — contents may change between iterations, no caching.
      let count = 0
      for (const _ of this) count++
      return count
    }

    let product = this._staticSeed.length
    for (const dim of this._dims) {
      if (dim.staticValues === null) {
        // Dynamic dimension — don't cache, external state may change between calls.
        let count = 0
        for (const _ of this) count++
        return count
      }
      product *= dim.staticValues.length
    }

    const collides = this._staticSeed.some(p =>
      this._dims.some(d => Object.prototype.hasOwnProperty.call(p, d.key)),
    )
    if (collides) {
      // Seed/dimension key overlap — per-point unions break the product
      // formula. Everything is still static, so count once and cache.
      let count = 0
      for (const _ of this) count++
      return (this._cachedSize = count)
    }
    return (this._cachedSize = product)
  }

  *[Symbol.iterator](): Iterator<T> {
    for (const seedPoint of this._seed) {
      yield* generate(this._dims, 0, { ...seedPoint }) as Generator<T>
    }
  }
}

/** Creates an empty {@link DimGrid}. Chain {@link DimGrid.dim} calls to add dimensions. */
export function dimgrid(): DimGrid<{}>
export function dimgrid<const T extends object>(
  points: Iterable<T> & SameShape<T>,
): DimGrid<Collapse<T>>
export function dimgrid<const T extends object>(point: T & NotIterable): DimGrid<Collapse<T>>
export function dimgrid(seed?: object): DimGrid<any> {
  return seed === undefined ? DimGrid.create() : DimGrid.create(seed as any)
}
