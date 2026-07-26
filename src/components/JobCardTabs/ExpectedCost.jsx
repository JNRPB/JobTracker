import JobCard from "../JobCard";

function ExpectedCost({ job, onUpdate, editing, setEditing }) {
  const phases = job.phases || [];

  function updateCell(phaseID, field, value, rowIndex) {
    const updatedPhases = phases.map((p) => {
      if (p.id === phaseID) {
        const updatedRows = [...(p.rows || [])];
        updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
        return { ...p, rows: updatedRows };
      }
      return p;
    });

    onUpdate({ ...job, phases: updatedPhases });
  }

  const totalExpectedCost = phases.reduce((sum, phase) => {
    const materialTotal = phase.rows?.reduce(
      (s, row) => s + Number(row.materialCost || 0),
      0,
    );
    const labourTotal = phase.rows?.reduce(
      (s, row) => s + Number(row.labourCost || 0),
      0,
    );
    return sum + materialTotal + labourTotal;
  }, 0);

  return (
    <>
      <div>
        <h1>Expected Cost</h1> <br />
        {editing ? (
          <button onClick={() => setEditing(false)}>💾 Save</button>
        ) : (
          <button onClick={() => setEditing(true)}>✏️ Edit</button>
        )}
      </div>

      {editing && (
        <div className="bubbleBox">
          {phases.map((phase) => {
            const materialTotal = phase.rows?.reduce(
              (sum, row) => sum + Number(row.materialCost || 0),
              0,
            );
            const labourTotal = phase.rows?.reduce(
              (sum, row) => sum + Number(row.labourCost || 0),
              0,
            );

            return (
              <div key={phase.id} className="phase">
                <h2
                  contentEditable
                  suppressContentEditableWarning={true}
                  onBlur={(e) => {
                    const updatedPhases = phases.map((p) =>
                      p.id === phase.id
                        ? { ...p, name: e.target.innerText }
                        : p,
                    );
                    onUpdate({ ...job, phases: updatedPhases });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault(); // prevent newline
                      e.target.blur(); // trigger onBlur -> submit
                    }
                  }}
                >
                  {phase.name}
                </h2>

                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Material Cost</th>
                      <th>Labour</th>
                      <th>Labour Cost</th>
                      <th>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {phase.rows.map((row, rowIndex) => (
                      <tr key={row.id || rowIndex}>
                        <td
                          contentEditable
                          suppressContentEditableWarning={true}
                          onBlur={(e) =>
                            updateCell(
                              phase.id,
                              "material",
                              e.target.innerText,
                              rowIndex,
                            )
                          }
                        >
                          {row.material}
                        </td>

                        <td
                          contentEditable
                          suppressContentEditableWarning={true}
                          onBlur={(e) => {
                            let val = e.target.innerText.replace(
                              /[^0-9.]/g,
                              "",
                            ); // strip non-numbers
                            updateCell(
                              phase.id,
                              "materialCost",
                              Number(val),
                              rowIndex,
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault(); // prevent newline
                              e.target.blur(); // trigger onBlur -> submit
                            }
                          }}
                        >
                          £{row.materialCost || 0}
                        </td>

                        <td
                          contentEditable
                          suppressContentEditableWarning={true}
                          onBlur={(e) =>
                            updateCell(
                              phase.id,
                              "labour",
                              e.target.innerText,
                              rowIndex,
                            )
                          }
                        >
                          {row.labour}
                        </td>

                        <td
                          contentEditable
                          suppressContentEditableWarning={true}
                          onBlur={(e) => {
                            let val = e.target.innerText.replace(
                              /[^0-9.]/g,
                              "",
                            ); // strip non-numbers
                            updateCell(
                              phase.id,
                              "labourCost",
                              Number(val),
                              rowIndex,
                            );
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault(); // prevent newline
                              e.target.blur(); // trigger onBlur -> submit
                            }
                          }}
                        >
                          £{row.labourCost || 0}
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              const updatedRows = (phase.rows || []).filter(
                                (_, i) => i !== rowIndex,
                              );
                              const updatedPhases = phases.map((p) =>
                                p.id === phase.id
                                  ? { ...p, rows: updatedRows }
                                  : p,
                              );
                              onUpdate({ ...job, phases: updatedPhases });
                            }}
                            style={{
                              cursor: "pointer",
                              backgroundColor: "transparent",
                              color: "#fff",
                              border: "none",
                              borderRadius: "4px",
                            }}
                          >
                            ❌
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Totals row */}
                    <tr className="totals-row">
                      <td>
                        <strong>Totals</strong>
                      </td>
                      <td>
                        <strong>£{materialTotal}</strong>
                      </td>
                      <td></td>
                      <td>
                        <strong>£{labourTotal}</strong>
                      </td>
                      <td></td>
                    </tr>
                    <tr className="total-phase-cost">
                      <td>
                        <strong>Total Phase Cost</strong>
                      </td>
                      <td colSpan={3}>
                        <strong>£{materialTotal + labourTotal}</strong>
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>

                {/* Add Row button outside the table */}
                <div style={{ textAlign: "center", marginTop: "1rem" }}>
                  <button
                    onClick={() => {
                      const newRow = {
                        id: Date.now(),
                        material: "",
                        materialCost: "",
                        labour: "",
                        labourCost: "",
                      };

                      const updatedPhases = phases.map((p) =>
                        p.id === phase.id
                          ? { ...p, rows: [...(p.rows || []), newRow] }
                          : p,
                      );

                      onUpdate({
                        ...job,
                        phases: updatedPhases,
                      });
                    }}
                  >
                    Add Row
                  </button>
                </div>

                <button
                  onClick={() => {
                    const updatedPhases = phases.filter(
                      (p) => p.id !== phase.id,
                    );

                    onUpdate({
                      ...job,
                      phases: updatedPhases,
                    });
                  }}
                >
                  Delete Phase
                </button>
              </div>
            );
          })}

          <button
            onClick={() => {
              const newPhase = {
                id: Date.now(),
                name: "New Phase",
                rows: [],
              };

              const updatedJob = {
                ...job,
                phases: [...phases, newPhase],
              };

              onUpdate(updatedJob);
              console.log(updatedJob.phases[updatedJob.phases.length - 1].rows);
            }}
          >
            ➕ Add Phase
          </button>
        </div>
      )}

      {!editing && (
        <div className="summaryBox">
          <div
            style={{
              textAlign: "center",
              margin: "1rem 0",
              padding: "0.5rem 1rem",
              backgroundColor: "rgba(0,123,255,0.25)",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "1.2rem",
            }}
          >
            Total Expected Cost: £{totalExpectedCost}
          </div>

          {phases.map((phase) => {
            const phaseTotal = (phase.rows || []).reduce(
              (s, r) =>
                s + Number(r.materialCost || 0) + Number(r.labourCost || 0),
              0,
            );

            return (
              <div key={phase.id} className="phaseLine">
                <span>{phase.name}</span>
                <br />
                <strong>£{phaseTotal}</strong>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default ExpectedCost;

