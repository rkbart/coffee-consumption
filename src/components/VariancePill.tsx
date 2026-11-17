import { fmtSigned, unitLabel, varianceStatus } from "../lib";
import type { Unit } from "../types";

const labels = {
  over: "Over use",
  under: "Under use",
  "on-target": "On target",
};

const pillStyles: Record<string, string> = {
  over: "bg-red-soft text-red flex items-center gap-1.5",
  under: "bg-green-soft text-green flex items-center gap-1.5",
  "on-target": "bg-accent-soft text-accent-dark flex items-center gap-1.5",
};

export default function VariancePill({
  variance,
  theoretical,
  unit,
  showValue = true,
}: {
  variance: number;
  theoretical: number;
  unit: Unit;
  showValue?: boolean;
}) {
  const status = varianceStatus({ theoretical, variance });
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${pillStyles[status]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {showValue ? (
        <>
          {fmtSigned(variance)} {unitLabel(unit)}
        </>
      ) : (
        labels[status]
      )}
    </span>
  );
}
