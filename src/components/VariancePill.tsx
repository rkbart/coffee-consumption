import { fmtSigned, unitLabel, varianceStatus } from "../lib";
import type { Unit } from "../types";

const labels = {
  over: "Over use",
  under: "Under use",
  "on-target": "On target",
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
    <span className={`pill pill-${status}`}>
      <span className="pill-dot" />
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
