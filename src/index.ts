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

export class DimGrid<T extends object = {}> {
  private readonly _dims: readonly Dim[]
  private _cachedSize: number | null = null

  private constructor(dims: readonly Dim[]) {
    this._dims = dims
  }

  static create(): DimGrid<{}> {
    return new DimGrid<{}>([])
  }

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

  toArray(): T[] {
    return [...this]
  }

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

export function dimgrid(): DimGrid<{}> {
  return DimGrid.create()
}
