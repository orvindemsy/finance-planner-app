export function parsePeriod(periodStr: string | null | undefined): Date {
  if (periodStr) {
    const match = /^(\d{4})-(\d{2})$/.exec(periodStr);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) {
        return new Date(Date.UTC(year, month - 1, 1));
      }
    }
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function periodBounds(period: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1));
  const end = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

export function shiftPeriod(period: Date, deltaMonths: number): Date {
  return new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + deltaMonths, 1));
}
