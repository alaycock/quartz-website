import type { SummaryType } from "../../types";
import { evaluate } from "../../compiler";
import { Duration, isDuration } from "../../compiler/duration";
import { formatValue } from "./cell";

// Site patch: sums and ranges are rounded to the most decimal places in the inputs, hiding
// floating-point noise (e.g. 55.300000000000004)
function decimalPlaces(value: number): number {
  const [, fraction = ""] = String(value).split(".");
  return fraction.length;
}

function roundToInputs(result: number, inputs: number[]): number {
  const places = Math.max(0, ...inputs.map(decimalPlaces));
  return Number(result.toFixed(places));
}

/**
 * Site patch: a summary that isn't built in is looked up in the .base file's top-level
 * `summaries` and evaluated as a formula with `values` bound to the column's values, e.g.
 * `Days: -values.reduce(value + acc, duration('0s')).days.ceil()`
 */
function customSummary(values: unknown[], expression: string): string {
  const result = evaluate(expression, {
    note: {},
    file: { name: "", basename: "", path: "", folder: "", ext: "", tags: [], links: [] },
    formula: {},
    _values: values,
  });
  return formatValue(result);
}

// Site patch: Sum/Average/Min/Max/Range of durations stay durations ("5 days")
function durationSummary(values: Duration[], summary: SummaryType): string | undefined {
  const ms = values.map((value) => value.ms);
  const total = ms.reduce((acc, value) => acc + value, 0);
  const result =
    summary === "Sum" ? total
    : summary === "Average" ? total / ms.length
    : summary === "Min" ? Math.min(...ms)
    : summary === "Max" ? Math.max(...ms)
    : summary === "Range" ? Math.max(...ms) - Math.min(...ms)
    : undefined;
  return result === undefined ? undefined : new Duration(result).toString();
}

export function computeSummary(
  values: unknown[],
  summary: SummaryType,
  formulas?: Record<string, string>,
): string {
  const formula = formulas?.[summary];
  if (formula) return customSummary(values, formula);
  const nonEmpty = values.filter((value) => value !== undefined && value !== null && value !== "");
  if (nonEmpty.length > 0 && nonEmpty.every(isDuration)) {
    const durationResult = durationSummary(nonEmpty, summary);
    if (durationResult !== undefined) return durationResult;
  }
  if (summary === "Empty") return String(values.length - nonEmpty.length);
  if (summary === "Filled") return String(nonEmpty.length);
  if (summary === "Checked") return String(values.filter((value) => value === true).length);
  if (summary === "Unchecked") return String(values.filter((value) => value === false).length);
  if (summary === "Unique") return String(new Set(values.map((value) => String(value))).size);

  const numeric = nonEmpty
    .map((value) => (typeof value === "number" ? value : Number(value)))
    .filter((value) => !Number.isNaN(value));

  if (numeric.length === 0) return summary;
  if (summary === "Sum")
    return String(roundToInputs(numeric.reduce((acc, value) => acc + value, 0), numeric));
  if (summary === "Average")
    return String(numeric.reduce((acc, value) => acc + value, 0) / numeric.length);
  if (summary === "Min") return String(Math.min(...numeric));
  if (summary === "Max") return String(Math.max(...numeric));
  if (summary === "Range")
    return String(roundToInputs(Math.max(...numeric) - Math.min(...numeric), numeric));
  if (summary === "Median") {
    const sorted = [...numeric].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const upper = sorted[mid] ?? 0;
    const lower = sorted[mid - 1] ?? upper;
    const median = sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
    return String(median);
  }
  if (summary === "Stddev") {
    const mean = numeric.reduce((acc, value) => acc + value, 0) / numeric.length;
    const variance =
      numeric.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / numeric.length;
    return String(Math.sqrt(variance));
  }

  return summary;
}
