import { useState } from "react";

function LogInvoice({ navigate, addInvoice, jobs }) {
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
  }

  function handleSubmit(e) {
    e.preventDefault();

    const newInvoice = {
      id: Date.now(),
      item: formData.item,
      amount: Number(formData.amount),
      payee: formData.payee,
      dateIssued: formData.dateIssued,
      jobLink: formData.jobLink ? Number(formData.jobLink) : null,
    };

    addInvoice(newInvoice);

    navigate("Invoices");

    setFormData({
      item: "",
      amount: "",
      payee: "",
      dateIssued: "",
      jobLink: "",
    });
  }

  return (
    <div className="create-job-page">
      <h1>Log Invoice</h1>

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

          {jobs.map((job) => (
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
