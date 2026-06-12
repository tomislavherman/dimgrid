export class DimGrid<T extends object = {}> {
  private readonly _points: readonly T[]

  private constructor(points: readonly T[]) {
    this._points = points
  }

  static create(): DimGrid<{}> {
    return new DimGrid<{}>([{}])
  }

  dim<K extends string, const V>(
    key: K,
    values: readonly V[] | ((point: T) => readonly V[]),
  ): DimGrid<T & Record<K, V>> {
    const next: Array<T & Record<K, V>> = []
    const resolve = typeof values === 'function' ? values : () => values
    for (const point of this._points) {
      for (const value of resolve(point)) {
        next.push({ ...point, [key]: value } as T & Record<K, V>)
      }
    }
    return new DimGrid<T & Record<K, V>>(next)
  }

  toArray(): T[] {
    return [...this._points]
  }

  get size(): number {
    return this._points.length
  }

  *[Symbol.iterator](): Iterator<T> {
    yield* this._points
  }
}

export function dimgrid(): DimGrid<{}> {
  return DimGrid.create()
}
