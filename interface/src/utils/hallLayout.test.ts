import { describe, expect, it } from 'vitest';

import { buildDisplayHall, buildHallPreview, getHallPreviewColumnState, getHallPreviewRowState, getSeatColumnState, getSeatRowState } from './hallLayout';

describe('hall layout utils', () => {
  it('builds preview with preserved gaps in numbering for inactive seats', () => {
    const preview = buildHallPreview('2', '3', ['1-2']);
    expect(preview[0].label).toBe('1');
    expect(preview[0].seats.map((seat) => seat.displayLabel)).toEqual(['2', '', '1']);
  });

  it('computes preview row and column states', () => {
    const preview = buildHallPreview('2', '2', ['1-1', '2-1']);
    expect(getHallPreviewRowState(preview, '1')).toBe('mixed');
    expect(getHallPreviewColumnState(preview, '1')).toBe('inactive');
    expect(getHallPreviewColumnState(preview, '2')).toBe('active');
    expect(getHallPreviewRowState(preview, 'missing')).toBe('inactive');
    expect(getHallPreviewColumnState(preview, 'missing')).toBe('inactive');
  });

  it('uses fallback dimensions and clamps zero dimensions', () => {
    expect(buildHallPreview('', '', [])).toHaveLength(20);
    expect(buildHallPreview('0', '0', [])[0].seats).toHaveLength(1);
  });

  it('builds display hall from seats and renumbers active seats only', () => {
    const hall = buildDisplayHall([
      { id: 1, row_label: '1', seat_label: '3', status: 'free' as const, active: true, sale_id: null, updated_at: '' },
      { id: 2, row_label: '1', seat_label: '2', status: 'free' as const, active: false, sale_id: null, updated_at: '' },
      { id: 3, row_label: '1', seat_label: '1', status: 'sold' as const, active: true, sale_id: 1, updated_at: '' },
    ]);
    expect(hall[0].seats.map((seat) => seat.display_label)).toEqual(['2', '', '1']);
  });

  it('groups several rows and sorts them numerically', () => {
    const hall = buildDisplayHall([
      { id: 1, row_label: '2', seat_label: '1', status: 'free' as const, active: true, sale_id: null, updated_at: '' },
      { id: 2, row_label: '1', seat_label: '1', status: 'free' as const, active: true, sale_id: null, updated_at: '' },
    ]);
    expect(hall.map((row) => row.label)).toEqual(['1', '2']);
    expect(hall[0].seats[0].display_label).toBe('1');
  });

  it('computes seat row and column activity states', () => {
    const seats = [
      { id: 1, row_label: '1', seat_label: '1', status: 'free' as const, active: true, sale_id: null, updated_at: '' },
      { id: 2, row_label: '1', seat_label: '2', status: 'free' as const, active: false, sale_id: null, updated_at: '' },
      { id: 3, row_label: '2', seat_label: '1', status: 'free' as const, active: false, sale_id: null, updated_at: '' },
    ];
    expect(getSeatRowState(seats, '1')).toBe('mixed');
    expect(getSeatColumnState(seats, '1')).toBe('mixed');
    expect(getSeatColumnState(seats, '2')).toBe('inactive');
    expect(getSeatRowState(seats, 'missing')).toBe('inactive');
    expect(getSeatColumnState(seats, 'missing')).toBe('inactive');
    expect(getSeatRowState(seats, '2')).toBe('inactive');
  });
});
