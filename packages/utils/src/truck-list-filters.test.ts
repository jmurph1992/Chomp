import { describe, it, expect } from 'vitest'
import {
  sortTrucks,
  filterTrucksByCuisine,
  filterTrucksByMinRating,
  getDistinctCuisines,
} from './truck-list-filters'

const truckA = { id: 'a', distanceMeters: 500, averageRating: 4.2, cuisineType: ['mexican'] }
const truckB = { id: 'b', distanceMeters: 100, averageRating: null, cuisineType: ['bbq', 'mexican'] }
const truckC = { id: 'c', distanceMeters: 900, averageRating: 4.8, cuisineType: ['thai'] }

describe('sortTrucks', () => {
  it('sorts by distance ascending', () => {
    const result = sortTrucks([truckA, truckB, truckC], 'distance')
    expect(result.map((t) => t.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts by rating descending, with no-reviews trucks always last', () => {
    const result = sortTrucks([truckA, truckB, truckC], 'rating')
    expect(result.map((t) => t.id)).toEqual(['c', 'a', 'b'])
  })

  it('does not mutate the input array', () => {
    const input = [truckA, truckB, truckC]
    const copy = [...input]
    sortTrucks(input, 'distance')
    expect(input).toEqual(copy)
  })

  it('keeps two no-reviews trucks stable relative to each other', () => {
    const noReviews1 = { ...truckB, id: 'x' }
    const noReviews2 = { ...truckB, id: 'y' }
    const result = sortTrucks([noReviews1, noReviews2], 'rating')
    expect(result.map((t) => t.id)).toEqual(['x', 'y'])
  })
})

describe('filterTrucksByCuisine', () => {
  it('returns all trucks unchanged when selection is empty', () => {
    expect(filterTrucksByCuisine([truckA, truckB, truckC], [])).toEqual([truckA, truckB, truckC])
  })

  it('OR-matches: a truck with any selected cuisine passes', () => {
    const result = filterTrucksByCuisine([truckA, truckB, truckC], ['bbq'])
    expect(result.map((t) => t.id)).toEqual(['b'])
  })

  it('matches a multi-cuisine truck under either selected filter', () => {
    const result = filterTrucksByCuisine([truckA, truckB, truckC], ['mexican'])
    expect(result.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('returns nothing when no truck matches', () => {
    expect(filterTrucksByCuisine([truckA, truckB, truckC], ['korean'])).toEqual([])
  })
})

describe('filterTrucksByMinRating', () => {
  it('returns all trucks unchanged when minRating is null', () => {
    expect(filterTrucksByMinRating([truckA, truckB, truckC], null)).toEqual([truckA, truckB, truckC])
  })

  it('excludes trucks with no reviews yet', () => {
    const result = filterTrucksByMinRating([truckA, truckB, truckC], 3)
    expect(result.map((t) => t.id)).not.toContain('b')
  })

  it('is inclusive at the boundary', () => {
    const result = filterTrucksByMinRating([truckA], 4.2)
    expect(result.map((t) => t.id)).toEqual(['a'])
  })

  it('excludes a truck below the threshold', () => {
    const result = filterTrucksByMinRating([truckA], 4.5)
    expect(result).toEqual([])
  })
})

describe('getDistinctCuisines', () => {
  it('dedupes and sorts alphabetically', () => {
    expect(getDistinctCuisines([truckA, truckB, truckC])).toEqual(['bbq', 'mexican', 'thai'])
  })

  it('returns an empty array for no trucks', () => {
    expect(getDistinctCuisines([])).toEqual([])
  })
})
