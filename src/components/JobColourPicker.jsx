import { JOB_COLOUR_PALETTE, normaliseJobColour } from "./jobColour";
import "./JobColourPicker.css";

export default function JobColourPicker({ value, onChange, id = "job-colour" }) {
  const selected = normaliseJobColour(value) || JOB_COLOUR_PALETTE[0];

  return (
    <div className="job-colour-picker">
      <div className="job-colour-custom">
        <input
          id={id}
          type="color"
          value={selected}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Custom job colour"
        />
        <span>
          <strong>{selected.toUpperCase()}</strong>
          <small>Used as this job's identity across HQ</small>
        </span>
      </div>
      <div className="job-colour-swatches" aria-label="Suggested job colours">
        {JOB_COLOUR_PALETTE.map((colour) => (
          <button
            type="button"
            className={selected === colour ? "selected" : ""}
            style={{ "--swatch-colour": colour }}
            onClick={() => onChange(colour)}
            aria-label={`Use colour ${colour}`}
            aria-pressed={selected === colour}
            title={colour}
            key={colour}
          />
        ))}
      </div>
    </div>
  );
}
