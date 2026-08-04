import { describe, expect, it } from 'vitest';

import { formatMoney, seatStateLabel } from './format';

describe('format utils', () => {
  it('formats money as rounded rubles', () => {
    expect(formatMoney(200)).toBe('200 ₽');
    expect(formatMoney(199.6)).toBe('200 ₽');
  });

  it('maps seat statuses to labels', () => {
    expect(seatStateLabel('sold')).toBe('Продано');
    expect(seatStateLabel('reserved')).toBe('Бронь');
    expect(seatStateLabel('free')).toBe('Свободно');
  });
});
