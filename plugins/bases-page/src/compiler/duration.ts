// Site patch: Obsidian's duration type. Subtracting dates gives a duration, which can be added
// to dates, combined with other durations, and read as `.days`, `.hours`, etc. It displays
// humanized like Obsidian (moment.js), e.g. "a day", "3 days".

const MS_PER_DAY = 86_400_000;

export class Duration {
  constructor(readonly ms: number) {}

  // Lets Number(duration) and numeric summaries work on the underlying milliseconds
  valueOf(): number {
    return this.ms;
  }

  toString(): string {
    return humanizeDuration(this.ms);
  }
}

export function isDuration(value: unknown): value is Duration {
  return value instanceof Duration;
}

/** `.days`, `.hours`, ... as fractional amounts (moment's `duration.as(unit)`) */
export function durationField(duration: Duration, name: string): number | undefined {
  const { ms } = duration;
  const days = ms / MS_PER_DAY;
  const months = (days * 4800) / 146097;
  switch (name) {
    case "milliseconds":
      return ms;
    case "seconds":
      return ms / 1000;
    case "minutes":
      return ms / 60_000;
    case "hours":
      return ms / 3_600_000;
    case "days":
      return days;
    case "weeks":
      return days / 7;
    case "months":
      return months;
    case "years":
      return months / 12;
    default:
      return undefined;
  }
}

/** moment.js `duration.humanize()` (English, no suffix): the sign is ignored */
export function humanizeDuration(ms: number): string {
  const abs = Math.abs(ms);
  const days = abs / MS_PER_DAY;
  const seconds = Math.round(abs / 1000);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const wholeDays = Math.round(days);
  const months = Math.round((days * 4800) / 146097);
  const years = Math.round((days * 400) / 146097);

  if (seconds < 45) return "a few seconds";
  if (minutes <= 1) return "a minute";
  if (minutes < 45) return `${minutes} minutes`;
  if (hours <= 1) return "an hour";
  if (hours < 22) return `${hours} hours`;
  if (wholeDays <= 1) return "a day";
  if (wholeDays < 26) return `${wholeDays} days`;
  if (months <= 1) return "a month";
  if (months < 11) return `${months} months`;
  if (years <= 1) return "a year";
  return `${years} years`;
}
