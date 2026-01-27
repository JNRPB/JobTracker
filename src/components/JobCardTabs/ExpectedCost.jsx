import JobCard from "../JobCard";

function ExpectedCost({ job, onUpdate }) {
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

  return (
    <>
      <div>
        <h1>Expected Cost</h1>
      </div>

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
              <h2>{phase.name}</h2>

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
                        onBlur={(e) =>
                          updateCell(
                            phase.id,
                            "materialCost",
                            e.target.innerText,
                            rowIndex,
                          )
                        }
                      >
                        {row.materialCost}
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
                        onBlur={(e) =>
                          updateCell(
                            phase.id,
                            "labourCost",
                            e.target.innerText,
                            rowIndex,
                          )
                        }
                      >
                        {row.labourCost}
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
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td>
                      <strong>{materialTotal}</strong>
                    </td>
                    <td></td>
                    <td>
                      <strong>{labourTotal}</strong>
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
                  const updatedPhases = phases.filter((p) => p.id !== phase.id);

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
    </>
  );
}

export default ExpectedCost;
