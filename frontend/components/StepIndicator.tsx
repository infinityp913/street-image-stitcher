"use client";

type Step = 1 | 2 | 3;

interface StepIndicatorProps {
  current: Step;
}

const STEPS: { num: Step; label: string }[] = [
  { num: 1, label: "Upload" },
  { num: 2, label: "Order" },
  { num: 3, label: "Result" },
];

export default function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2" role="navigation" aria-label="Steps">
      {STEPS.map((step, i) => {
        const done = step.num < current;
        const active = step.num === current;

        return (
          <span key={step.num} className="flex items-center gap-2">
            {i > 0 && (
              <span
                style={{ color: "var(--color-border)" }}
                aria-hidden="true"
              >
                ·
              </span>
            )}
            <span
              style={{
                fontFamily: "var(--font-inter)",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: done
                  ? "var(--color-step-done)"
                  : active
                  ? "var(--color-accent)"
                  : "var(--color-muted)",
              }}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓ " : `${step.num}. `}
              {step.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
