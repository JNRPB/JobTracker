import { useState } from "react";

function MonthlyCashflow({ jobs }) {
  const [month, setMonth] = useState(new Date().getMonth()); // 0 = Jan
  const [year, setYear] = useState(new Date().getFullYear());

  // Outgoings: array of {id, description, amount}
  const [outgoings, setOutgoings] = useState([]);

  // Temp fields for new outgoing entry
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");

  // Filter jobs finishing in the selected month/year
  const jobsThisMonth = jobs.filter((job) => {
    if (!job.finishDate) return false;
    const date = new Date(job.finishDate);
    return date.getMonth() === month && date.getFullYear() === year;
  });

  const expectedIncome = jobsThisMonth.reduce(
    (sum, job) => sum + (job.agreedPrice || job.totalExpectedCost || 0),
    0,
  );

  const totalOutgoings = outgoings.reduce((sum, o) => sum + o.amount, 0);

  function addOutgoing() {
    if (!newDesc || !newAmount) return;
    const entry = {
      id: Date.now(),
      description: newDesc,
      amount: Number(newAmount),
    };
    setOutgoings([...outgoings, entry]);
    setNewDesc("");
    setNewAmount("");
  }

  function removeOutgoing(id) {
    setOutgoings(outgoings.filter((o) => o.id !== id));
  }

  return (
    <>
      <div>
        <h1>Monthly Cashflow</h1>
      </div>
      <div className="month-selector">
        <label>
          Month:
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {[
              "January",
              "February",
              "March",
              "April",
              "May",
              "June",
              "July",
              "August",
              "September",
              "October",
              "November",
              "December",
            ].map((m, i) => (
              <option key={i} value={i}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label>
          Year:
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="cashflowWrapper">
        <div className="bubbleBox">
          <h1>Jobs finishing this month</h1>
          {jobsThisMonth.length === 0 ? (
            <p>No jobs finishing.</p>
          ) : (
            <ul>
              {jobsThisMonth.map((job) => (
                <li key={job.id}>
                  {job.name} — £{job.agreedPrice || job.totalExpectedCost || 0}
                </li>
              ))}
            </ul>
          )}
          <p>
            <strong>Total Expected Income: £{expectedIncome}</strong>
          </p>
        </div>
        <div className="bubbleBox">
          {/* RIGHT COLUMN: Outgoings */}

          <h2>Expected Outgoings</h2>
          <ul className="monthly-outgoings">
            {outgoings.map((o) => (
              <li key={o.id}>
                {o.description} — £{o.amount}{" "}
                <button
                  className="delete-small"
                  onClick={() => removeOutgoing(o.id)}
                >
                  ❌
                </button>
              </li>
            ))}
          </ul>
          <div className="add-outgoing">
            <input
              type="text"
              placeholder="Description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <input
              type="number"
              placeholder="Amount"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
            <button onClick={addOutgoing}>Add</button>
          </div>
          <p>
            <strong>Total Outgoings: £{totalOutgoings}</strong>
          </p>
        </div>
      </div>

      <div className="net-cashflow">
        <h2>Net Cashflow: £{expectedIncome - totalOutgoings}</h2>
      </div>
    </>
  );
}

export default MonthlyCashflow;
