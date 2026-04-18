import { useEffect, useMemo, useState } from "react";

function EditInvoice({ invoices, jobs, navData, updateInvoice, navigate }) {
  const invoiceId = navData.invoiceId;

  const invoice = invoices.find((inv) => inv.id === invoiceId);

  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (!invoice) return;

    setFormData({
      id: invoice.id,
      item: invoice.item || "",
      amount: invoice.amount ?? "",
      payee: invoice.payee || "",
      dateIssued: invoice.dateIssued || "",
      jobLinks:
        invoice.jobLinks && invoice.jobLinks.length > 0
          ? invoice.jobLinks
          : invoice.jobLink
            ? [{ jobId: invoice.jobLink, amount: invoice.amount }]
            : [],
    });
  }, [invoice]);

  const allocatedTotal = useMemo(() => {
    if (!formData) return 0;

    return formData.jobLinks.reduce((sum, link) => {
      return sum + Number(link.amount || 0);
    }, 0);
  }, [formData]);

  const remaining = useMemo(() => {
    if (!formData) return 0;
    return Number(formData.amount || 0) - allocatedTotal;
  }, [formData, allocatedTotal]);

  const isOverAllocated = remaining < 0;

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]:
        e.target.name === "amount"
          ? Number(e.target.value) || ""
          : e.target.value,
    });
  }

  function addJobLink() {
    setFormData({
      ...formData,
      jobLinks: [...formData.jobLinks, { jobId: "", amount: "" }],
    });
  }

  function removeJobLink(index) {
    const updatedLinks = formData.jobLinks.filter((_, i) => i !== index);

    setFormData({
      ...formData,
      jobLinks: updatedLinks,
    });
  }

  function handleJobLinkChange(index, field, value) {
    const updatedLinks = [...formData.jobLinks];

    updatedLinks[index] = {
      ...updatedLinks[index],
      [field]:
        field === "amount"
          ? Number(value) || ""
          : field === "jobId"
            ? Number(value) || ""
            : value,
    };

    setFormData({
      ...formData,
      jobLinks: updatedLinks,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (isOverAllocated) {
      alert("Allocated job link total cannot be more than the invoice amount.");
      return;
    }

    const cleanedLinks = formData.jobLinks.filter(
      (link) => link.jobId && Number(link.amount) > 0,
    );

    const updatedInvoice = {
      ...formData,
      amount: Number(formData.amount),
      jobLinks: cleanedLinks,
      jobLink: cleanedLinks.length === 1 ? cleanedLinks[0].jobId : null,
    };

    updateInvoice(updatedInvoice);
    navigate("Invoices");
  }

  function getJobName(jobId) {
    const foundJob = jobs.find((job) => job.id === jobId);
    return foundJob ? foundJob.name : "Unknown Job";
  }

  if (!invoice || !formData) {
    return (
      <div className="create-job-page">
        <h1>Edit Invoice</h1>
        <p>Invoice not found.</p>
      </div>
    );
  }

  return (
    <div className="create-job-page">
      <h1>Edit Invoice</h1>

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

        <hr />

        <h2>Job Links</h2>

        {formData.jobLinks.length === 0 && <p>No job links yet.</p>}

        {formData.jobLinks.map((link, index) => (
          <div
            key={index}
            style={{
              marginBottom: "1rem",
              padding: "0.8rem",
              border: "1px solid #444",
              borderRadius: "8px",
            }}
          >
            <select
              value={link.jobId}
              onChange={(e) =>
                handleJobLinkChange(index, "jobId", e.target.value)
              }
            >
              <option value="">Select job</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Allocated amount"
              value={link.amount}
              onChange={(e) =>
                handleJobLinkChange(index, "amount", e.target.value)
              }
              style={{ marginLeft: "0.5rem" }}
            />

            <button
              type="button"
              onClick={() => removeJobLink(index)}
              style={{ marginLeft: "0.5rem" }}
            >
              Remove
            </button>

            {link.jobId ? (
              <p style={{ marginTop: "0.5rem", opacity: 0.8 }}>
                Linked to: {getJobName(link.jobId)}
              </p>
            ) : null}
          </div>
        ))}

        <button type="button" onClick={addJobLink}>
          Add Job Link
        </button>

        <hr />

        <p>Invoice Total: £{Number(formData.amount || 0)}</p>
        <p>Allocated Total: £{allocatedTotal}</p>
        <p
          style={{
            color: isOverAllocated ? "red" : "inherit",
            fontWeight: "bold",
          }}
        >
          Remaining: £{remaining}
        </p>

        {isOverAllocated && (
          <p style={{ color: "red" }}>
            You have allocated more than the invoice total.
          </p>
        )}

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <button type="submit" disabled={isOverAllocated}>
            Save Invoice
          </button>

          <button type="button" onClick={() => navigate("Invoices")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditInvoice;
