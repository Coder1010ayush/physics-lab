import classes from './ReadoutGroup.module.css';

export interface ReadoutItem {
  label: string;
  value: number | string;
  unit?: string;
  /** semantic dot color (a --vec-* token) */
  color?: string;
  precision?: number;
}

export default function ReadoutGroup({ items }: { items: ReadoutItem[] }) {
  return (
    <div className={classes.chips}>
      {items.map((item) => {
        const text =
          typeof item.value === 'number'
            ? item.value.toFixed(item.precision ?? 2)
            : item.value;
        return (
          <div key={item.label} className={classes.chip}>
            <div className={classes.dotRow}>
              {item.color ? (
                <span
                  className={classes.dot}
                  style={{ background: item.color }}
                  aria-hidden="true"
                />
              ) : null}
              <span className={classes.label}>{item.label}</span>
            </div>
            <div className={classes.valueRow}>
              <span className={`${classes.value} tnum`}>{text}</span>
              {item.unit ? <span className={classes.unit}>{item.unit}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
