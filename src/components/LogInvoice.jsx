import { useState } from "react";
import { useMainProvider } from "./Provider";

function LogInvoice({ navigate, addInvoice, jobs, invoices = [] }) {
  const { penis } = useMainProvider();

  console.log(penis);

  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const [formData, setFormData] = useState({
    item: "",
    amount: "",
    payee: "",
    dateIssued: "",
    jobLink: "",
  });

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    setDuplicateWarning(null);
  }

  function resetForm() {
    setFormData({
      item: "",
      amount: "",
      payee: "",
      dateIssued: "",
      jobLink: "",
    });

    setDuplicateWarning(null);
  }

  function findPossibleDuplicate(newInvoice) {
    return invoices.find((invoice) => {
      const samePayee =
        invoice.payee?.toLowerCase().trim() ===
        newInvoice.payee?.toLowerCase().trim();

      const sameDate = invoice.dateIssued === newInvoice.dateIssued;

      const sameAmount =
        Number(invoice.amount || 0).toFixed(2) ===
        Number(newInvoice.amount || 0).toFixed(2);

      return samePayee && sameDate && sameAmount;
    });
  }

  function buildInvoice() {
    const numericAmount = Number(formData.amount || 0);
    const numericJobId = formData.jobLink ? Number(formData.jobLink) : null;

    return {
      id: Date.now(),
      item: formData.item,
      amount: numericAmount,
      payee: formData.payee,
      dateIssued: formData.dateIssued,

      // keep this for compatibility if you want
      jobLink: numericJobId,

      // this is the important bit
      jobLinks: numericJobId
        ? [
            {
              jobId: numericJobId,
              amount: numericAmount,
            },
          ]
        : [],
    };
  }

  function saveInvoice(invoice) {
    addInvoice(invoice);
    navigate("Invoices");
    resetForm();
  }

  function handleSubmit(e) {
    e.preventDefault();

    const newInvoice = buildInvoice();
    const duplicate = findPossibleDuplicate(newInvoice);

    if (duplicate) {
      setDuplicateWarning(duplicate);
      return;
    }

    saveInvoice(newInvoice);
  }

  function handleSaveAnyway() {
    const newInvoice = buildInvoice();
    saveInvoice(newInvoice);
  }

  return (
    <div className="create-job-page">
      <h1>Log Invoice</h1>

      {duplicateWarning && (
        <div className="duplicate-warning">
          <h3>Possible duplicate found</h3>

          <p>
            This looks like an invoice already logged for{" "}
            <strong>{duplicateWarning.payee}</strong> on{" "}
            <strong>{duplicateWarning.dateIssued}</strong> for{" "}
            <strong>£{Number(duplicateWarning.amount || 0).toFixed(2)}</strong>.
          </p>

          <div className="duplicate-warning-actions">
            <button
              type="button"
              onClick={() => {
                setDuplicateWarning(null);
              }}
            >
              Go back and edit
            </button>

            <button type="button" onClick={handleSaveAnyway}>
              Save anyway
            </button>
          </div>
        </div>
      )}

      <form className="create-job-form" onSubmit={handleSubmit}>
        <input
          name="item"
          placeholder="Item"
          value={formData.item}
          onChange={handleChange}
          required
        />

        <input
          name="amount"
          type="number"
          step="0.01"
          placeholder="Amount"
          value={formData.amount}
          onChange={handleChange}
          required
        />

        <input
          name="payee"
          placeholder="Payee"
          value={formData.payee}
          onChange={handleChange}
          required
        />

        <input
          type="date"
          name="dateIssued"
          value={formData.dateIssued}
          onChange={handleChange}
          required
        />

        <select name="jobLink" value={formData.jobLink} onChange={handleChange}>
          <option value="">No job linked</option>

          {(jobs || []).map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </select>

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default LogInvoice;

