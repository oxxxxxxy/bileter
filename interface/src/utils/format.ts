import type { SeatItem } from '../types';

export function formatMoney(cents: number): string {
  return `${Math.round(cents)} ₽`;
}

export function seatStateLabel(status: SeatItem['status']): string {
  if (status === 'sold') return 'Продано';
  if (status === 'reserved') return 'Бронь';
  return 'Свободно';
}
