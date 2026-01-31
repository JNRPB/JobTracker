function ActualCost({ job, onUpdate }) {
  const actualCosts = job.actualCosts || [];

  function updateRow(index, field, value) {
    const updatedRows = [...actualCosts];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value,
    };

    onUpdate({
      ...job,
      actualCosts: updatedRows,
    });
  }

  function deleteRow(index) {
    const updatedRows = actualCosts.filter((_, i) => i !== index);

    onUpdate({
      ...job,
      actualCosts: updatedRows,
    });
  }

  const totalActualCost = actualCosts.reduce(
    (sum, row) => sum + Number(row.cost || 0),
    0,
  );

  return (
    <>
      <div>
        <h1>Actual Cost</h1>
      </div>

      <div
        style={{
          textAlign: "center",
          margin: "1rem 0",
          padding: "0.5rem 1rem",
          backgroundColor: "rgba(40,167,69,0.25)",
          borderRadius: "12px",
          fontWeight: "700",
          fontSize: "1.2rem",
        }}
      >
        Total Actual Cost: £{totalActualCost}
      </div>

      <div className="bubbleBox">
        <div className="phase">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Cost</th>
                <th>Phase</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {actualCosts.map((row, index) => (
                <tr key={row.id || index}>
                  {/* Date */}
                  <td
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateRow(index, "date", e.target.innerText)}
                  >
                    {row.date}
                  </td>

                  {/* Item */}
                  <td
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => updateRow(index, "item", e.target.innerText)}
                  >
                    {row.item}
                  </td>

                  {/* Cost */}
                  <td
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const val = e.target.innerText.replace(/[^0-9.]/g, "");
                      updateRow(index, "cost", Number(val));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.target.blur();
                      }
                    }}
                  >
                    £{row.cost || 0}
                  </td>

                  {/* Phase */}
                  <td
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      updateRow(index, "phase", e.target.innerText)
                    }
                  >
                    {row.phase}
                  </td>

                  {/* Delete */}
                  <td>
                    <button
                      onClick={() => deleteRow(index)}
                      style={{
                        cursor: "pointer",
                        background: "transparent",
                        border: "none",
                      }}
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ))}

              {/* TOTAL */}
              <tr className="totals-row">
                <td>
                  <strong>Total</strong>
                </td>
                <td></td>
                <td>
                  <strong>£{totalActualCost}</strong>
                </td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ADD ROW */}
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button
            onClick={() => {
              const newRow = {
                id: Date.now(),
                date: "",
                item: "",
                cost: "",
                phase: "",
              };

              onUpdate({
                ...job,
                actualCosts: [...actualCosts, newRow],
              });
            }}
          >
            ➕ Add Cost Entry
          </button>
        </div>
      </div>
    </>
  );
}

export default ActualCost;
