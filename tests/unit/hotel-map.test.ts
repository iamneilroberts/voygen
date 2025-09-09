import { describe, it, expect } from 'vitest';
import { mapRowToDTO } from '../../src/wrappers/hotel-extract-helper';

describe('mapRowToDTO', () => {
  it('maps minimal row', () => {
    const dto = mapRowToDTO({ id: 'h1', name: 'Hotel A' });
    expect(dto).toEqual({ id: 'h1', name: 'Hotel A' });
  });
  it('parses numeric-like strings', () => {
    const dto = mapRowToDTO({ id: 'x', name: 'N', star_rating: '4.5', review_score: '8/10' } as any)!;
    expect(dto.starRating).toBe(4.5);
    expect(typeof dto.reviewScore).toBe('number');
  });
});

