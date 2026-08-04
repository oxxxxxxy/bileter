import type { HallPreviewRow, SeatItem, SeatRow } from '../types';

type ActivityState = 'active' | 'inactive' | 'mixed';

export function buildDisplayHall(seats: SeatItem[]): SeatRow[] {
  const grouped = new Map<string, SeatItem[]>();
  for (const seat of seats) {
    const list = grouped.get(seat.row_label) || [];
    list.push(seat);
    grouped.set(seat.row_label, list);
  }

  return Array.from(grouped.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([label, items]) => {
      const sortedSeats = items.sort((a, b) => Number(b.seat_label) - Number(a.seat_label));
      let visibleSeatNumber = 1;
      const displayLabels = new Map<string, string>();

      for (let seatIndex = sortedSeats.length - 1; seatIndex >= 0; seatIndex -= 1) {
        const seat = sortedSeats[seatIndex];
        if (!seat.active) {
          displayLabels.set(seat.seat_label, '');
          continue;
        }
        displayLabels.set(seat.seat_label, String(visibleSeatNumber));
        visibleSeatNumber += 1;
      }

      return {
        label,
        seats: sortedSeats.map((seat) => ({
          ...seat,
          display_label: displayLabels.get(seat.seat_label) ?? '',
        })),
      };
    });
}

export function buildHallPreview(rowsValue: string, seatsValue: string, inactiveSeats: string[]): HallPreviewRow[] {
  const rows = Math.max(1, Number(rowsValue || 20));
  const seatsCount = Math.max(1, Number(seatsValue || 20));
  const inactive = new Set(inactiveSeats);

  return Array.from({ length: rows }, (_, index) => {
    const rowLabel = String(index + 1);
    const seats = Array.from({ length: seatsCount }, (_, seatIndex) => {
      const seatLabel = String(seatsCount - seatIndex);
      return {
        label: seatLabel,
        active: !inactive.has(`${rowLabel}-${seatLabel}`),
      };
    });

    let visibleSeatNumber = 1;
    const displayLabels = new Map<string, string>();

    for (let seatIndex = seats.length - 1; seatIndex >= 0; seatIndex -= 1) {
      const seat = seats[seatIndex];
      if (!seat.active) {
        displayLabels.set(seat.label, '');
        continue;
      }
      displayLabels.set(seat.label, String(visibleSeatNumber));
      visibleSeatNumber += 1;
    }

    return {
      label: rowLabel,
      seats: seats.map((seat) => ({
        ...seat,
        displayLabel: displayLabels.get(seat.label) ?? '',
      })),
    };
  });
}

export function getHallPreviewRowState(rows: HallPreviewRow[], rowLabel: string): ActivityState {
  const rowSeats = rows.find((row) => row.label === rowLabel)?.seats || [];
  return getActivityState(rowSeats.map((seat) => seat.active));
}

export function getHallPreviewColumnState(rows: HallPreviewRow[], seatLabel: string): ActivityState {
  const columnSeats = rows.flatMap((row) => row.seats.filter((seat) => seat.label === seatLabel));
  return getActivityState(columnSeats.map((seat) => seat.active));
}

export function getSeatRowState(seats: SeatItem[], rowLabel: string): ActivityState {
  const rowSeats = seats.filter((seat) => seat.row_label === rowLabel);
  return getActivityState(rowSeats.map((seat) => seat.active));
}

export function getSeatColumnState(seats: SeatItem[], seatLabel: string): ActivityState {
  const columnSeats = seats.filter((seat) => seat.seat_label === seatLabel);
  return getActivityState(columnSeats.map((seat) => seat.active));
}

function getActivityState(values: boolean[]): ActivityState {
  if (values.length === 0) {
    return 'inactive';
  }

  const activeCount = values.filter(Boolean).length;
  if (activeCount === values.length) {
    return 'active';
  }
  if (activeCount === 0) {
    return 'inactive';
  }
  return 'mixed';
}
