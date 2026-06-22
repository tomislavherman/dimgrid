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
  for (const value of dim.resolve(point)) {
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
  private _cachedSize: number | null = null

  private constructor(dims: readonly Dim[]) {
    this._dims = dims
  }

  /** Creates an empty grid with no dimensions. Equivalent to calling {@link dimgrid}. */
  static create(): DimGrid<{}> {
    return new DimGrid<{}>([])
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

      return new DimGrid(newDims) as any
    }

    return new DimGrid([...this._dims, { key, staticValues, resolve: newResolve }]) as any
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

    let product = 1
    for (const dim of this._dims) {
      if (dim.staticValues === null) {
        // Dynamic dimension — don't cache, external state may change between calls.
        let count = 0
        for (const _ of this) count++
        return count
      }
      product *= dim.staticValues.length
    }
    return (this._cachedSize = product)
  }

  *[Symbol.iterator](): Iterator<T> {
    yield* generate(this._dims, 0, {}) as Generator<T>
  }
}

/** Creates an empty {@link DimGrid}. Chain {@link DimGrid.dim} calls to add dimensions. */
export function dimgrid(): DimGrid<{}> {
  return DimGrid.create()
}
