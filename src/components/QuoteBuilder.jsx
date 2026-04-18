import { useState, useMemo } from "react";

function QuoteBuilder({ navData, jobs, onUpdate, navigate }) {
  const job = useMemo(
    () => jobs.find((j) => j.id === navData?.jobId),
    [jobs, navData],
  );

  const [amount, setAmount] = useState(job?.quoteTotal || "");

  function handleSubmit(e) {
    e.preventDefault();

    if (!job) return;

    const updatedJob = {
      ...job,
      quoteTotal: Number(amount || 0),
    };

    onUpdate(updatedJob);
    navigate("JobCard", { jobId: job.id });
  }

  if (!job) {
    return (
      <div className="bubbleBox">
        <h1>Quote Builder</h1>
        <h2>Job not found</h2>
      </div>
    );
  }

  return (
    <div className="bubbleBox">
      <h1>Quote Builder</h1>
      <h2>{job.name}</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="number"
          placeholder="Enter total quote (£)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <button type="submit">Save Quote</button>
      </form>
    </div>
  );
}

export default QuoteBuilder;
