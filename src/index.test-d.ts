import { describe, expectTypeOf, it } from 'vitest'
import { DimGrid, dimgrid } from './index.js'

describe('dim', () => {
  it('initial grid has empty type', () => {
    expectTypeOf(dimgrid()).toEqualTypeOf<DimGrid<{}>>()
  })

  it('new dimension infers literal value types', () => {
    expectTypeOf(dimgrid().dim('color', ['red', 'green']))
      .toEqualTypeOf<DimGrid<{ color: 'red' | 'green' }>>()
  })

  it('second new dimension is added to the type', () => {
    expectTypeOf(dimgrid().dim('color', ['red', 'green']).dim('size', ['S', 'M']))
      .toEqualTypeOf<DimGrid<{ color: 'red' | 'green'; size: 'S' | 'M' }>>()
  })

  it('extending existing dimension widens its value type', () => {
    expectTypeOf(dimgrid().dim('color', ['red', 'green']).dim('color', ['blue']))
      .toEqualTypeOf<DimGrid<{ color: 'red' | 'green' | 'blue' }>>()
  })

  it('extending a dimension does not affect other dimensions', () => {
    expectTypeOf(
      dimgrid().dim('color', ['red']).dim('size', ['S']).dim('color', ['green'])
    ).toEqualTypeOf<DimGrid<{ color: 'red' | 'green'; size: 'S' }>>()
  })

  it('toArray returns correctly typed array', () => {
    expectTypeOf(dimgrid().dim('x', [1, 2]).toArray())
      .toEqualTypeOf<{ x: 1 | 2 }[]>()
  })

  it('iterator yields correctly typed points', () => {
    expectTypeOf(dimgrid().dim('x', [1, 2])[Symbol.iterator]())
      .toEqualTypeOf<Iterator<{ x: 1 | 2 }>>()
  })
})
