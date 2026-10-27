import classes from './FormulaBar.module.css';

/** One live equation, e.g. v = u + at → 3 + 1.5×2 → 6.00 m/s */
export interface FormulaItem {
  label?: string;
  /** the symbolic form, e.g. "v = u + at" */
  formula: string;
  /** the substituted numbers, e.g. "3 + 1.5×2" */
  substitution?: string;
  /** the computed result, e.g. "6.00" */
  result: string;
  unit?: string;
}

export default function FormulaBar({ items }: { items: FormulaItem[] }) {
  return (
    <div className={classes.strip} role="group" aria-label="Live formulas">
      <div className={classes.row}>
        {items.map((item, i) => (
          <div key={i} className={classes.chip}>
            {item.label ? <span className={classes.label}>{item.label}</span> : null}
            <span className={classes.math}>
              <var className={classes.formula}>{item.formula}</var>
              {item.substitution ? (
                <span className={classes.substitution}>{item.substitution}</span>
              ) : null}
              <span className={classes.result}>{item.result}</span>
              {item.unit ? <span className={classes.unit}>{item.unit}</span> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
