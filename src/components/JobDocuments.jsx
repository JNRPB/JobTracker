import React from "react";
import "./JobDocuments.css";

import "./FinancialDocuments.css";

import {
  calculateFinancialSummary,
  deleteDraftEstimateFromJob,
} from "../financial/jobFinancials";

import {
  createInvoiceFromEstimate,
  createStandaloneInvoice,
} from "../financial/invoice";
import { upsertInvoiceOnJob } from "../financial/jobFinancials";

function formatMoney(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getEstimateNumber(estimate) {
  return estimate.number || estimate.quoteNumber || "Draft Estimate";
}

function getInvoicesForEstimate(invoices, estimateId) {
  return invoices.filter(
    (invoice) => String(invoice.estimateId) === String(estimateId),
  );
}

function getPaidTotalForInvoices(invoices) {
  return invoices.reduce(
    (sum, invoice) => sum + Number(invoice.paidAmount || 0),
    0,
  );
}

function getInvoicedTotal(invoices) {
  return invoices
    .filter((invoice) => ["issued", "emailed", "paid"].includes(invoice.status))
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
}

function getOutstandingTotal(invoices) {
  return invoices
    .filter((invoice) => ["issued", "emailed", "paid"].includes(invoice.status))
    .reduce((sum, invoice) => {
      return (
        sum +
        Math.max(
          Number(invoice.total || 0) - Number(invoice.paidAmount || 0),
          0,
        )
      );
    }, 0);
}

function JobDocuments({ job, navigate, onUpdate }) {
  if (!job) {
    return <div className="job-documents-page">Job not found.</div>;
  }

  const estimates = job.quotes || [];
  const invoices = job.invoices || [];
  const standaloneInvoices = invoices.filter((invoice) => invoice.isStandalone);

  const summary = calculateFinancialSummary(job);
  const activeEstimate = summary.activeEstimate;

  async function deleteDraftEstimate(estimateId) {
    const confirmed = window.confirm(
      "Permanently delete this draft estimate? This cannot be undone.",
    );

    if (!confirmed) return;

    try {
      const updatedJob = deleteDraftEstimateFromJob(job, estimateId);
      await onUpdate(updatedJob);
    } catch (err) {
      alert(err.message || "Could not delete estimate.");
    }
  }

  async function deleteDraftInvoice(invoiceId) {
    const invoice = invoices.find(
      (item) => String(item.id) === String(invoiceId),
    );

    if (!invoice) return;

    if (invoice.status !== "draft") {
      alert(
        "Only draft invoices can be permanently deleted. Issued invoices should be voided instead.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Permanently delete this draft invoice? This cannot be undone.",
    );

    if (!confirmed) return;

    const updatedJob = {
      ...job,
      invoices: invoices.filter(
        (item) => String(item.id) !== String(invoiceId),
      ),
    };

    await onUpdate(updatedJob);
  }

  async function createNextInvoice(estimate) {
    const invoice = createInvoiceFromEstimate({
      job,
      estimate,
      invoiceType: "stage",
      amountMode: "remaining",
    });

    const updatedJob = upsertInvoiceOnJob(job, invoice);

    await onUpdate(updatedJob);

    navigate("InvoiceBuilder", {
      jobId: job.id,
      invoiceId: invoice.id,
    });
  }

  async function createNewStandaloneInvoice() {
    const invoice = createStandaloneInvoice({
      job,
      invoiceType: "custom",
      title: "Standalone Invoice",
      fixedGross: 0,
      vatRate: 20,
    });

    const updatedJob = upsertInvoiceOnJob(job, invoice);

    await onUpdate(updatedJob);

    navigate("InvoiceBuilder", {
      jobId: job.id,
      invoiceId: invoice.id,
    });
  }

  return (
    <div className="job-documents-page">
      <div className="job-documents-hero">
        <div>
          <p className="eyebrow">Financial Documents</p>
          <h1>{job.name}</h1>
          <p>{job.address}</p>
        </div>

        <button
          className="sleekButton ghostButton"
          onClick={() => navigate("JobCard", { jobId: job.id })}
        >
          Back to Job
        </button>
      </div>

      <section className="documents-summary-grid">
        <SummaryCard
          title="Active Contract"
          value={
            activeEstimate
              ? activeEstimate.number || activeEstimate.quoteNumber
              : "None"
          }
          sub={
            activeEstimate
              ? `${formatMoney(activeEstimate.total)} contract value`
              : "No issued estimate"
          }
        />

        <SummaryCard
          title="Invoiced"
          value={formatMoney(summary.totalInvoiced)}
          sub={`${formatMoney(summary.remainingToInvoice)} remaining to invoice`}
        />

        <SummaryCard
          title="Paid"
          value={formatMoney(summary.totalPaid)}
          sub={`${formatMoney(summary.outstanding)} outstanding`}
          success={summary.totalPaid > 0}
        />
      </section>

      <div className="document-actions">
        <button
          className="sleekButton primaryButton"
          onClick={() =>
            navigate("QuoteBuilder", {
              jobId: job.id,
              mode: "new",
            })
          }
        >
          + New Estimate
        </button>
      </div>

      <section className="financial-tree-panel">
        {estimates.length === 0 ? (
          <EmptyDocuments label="No estimates created yet." />
        ) : (
          estimates.map((estimate) => {
            const estimateInvoices = getInvoicesForEstimate(
              invoices,
              estimate.id,
            );
            const issuedInvoiced = getInvoicedTotal(estimateInvoices);
            const paidTotal = getPaidTotalForInvoices(estimateInvoices);
            const outstanding = getOutstandingTotal(estimateInvoices);
            const remainingToInvoice = Math.max(
              Number(estimate.total || 0) - issuedInvoiced,
              0,
            );

            const isActive = Boolean(estimate.isActive);

            return (
              <article
                className={`financial-estimate-tree ${
                  isActive ? "activeFinancialTree" : ""
                }`}
                key={estimate.id}
              >
                <div className="financial-tree-header">
                  <div className="financial-tree-leading">
                    <button className="tree-chevron" type="button">
                      ⌄
                    </button>

                    <div className="document-icon">📄</div>

                    <div>
                      <div className="tree-title-row">
                        <h2>{getEstimateNumber(estimate)}</h2>

                        <span
                          className={`document-status ${
                            estimate.status || "draft"
                          }`}
                        >
                          {isActive ? "active" : estimate.status || "draft"}
                        </span>
                      </div>

                      <p>
                        {estimate.issuedAt &&
                          `Issued ${formatDate(estimate.issuedAt)}`}
                        {estimate.issuedAt && estimate.acceptedAt ? " · " : ""}
                        {estimate.acceptedAt &&
                          `Accepted ${formatDate(estimate.acceptedAt)}`}
                        {!estimate.issuedAt &&
                          !estimate.acceptedAt &&
                          "No official dates yet"}
                      </p>
                    </div>
                  </div>

                  <div className="tree-contract-value">
                    <strong>{formatMoney(estimate.total)}</strong>
                    <span>Contract value</span>
                  </div>

                  <button
                    className="sleekButton ghostButton"
                    type="button"
                    onClick={() =>
                      navigate("QuoteBuilder", {
                        jobId: job.id,
                        quoteId: estimate.id,
                      })
                    }
                  >
                    View Estimate
                  </button>
                </div>

                <div className="tree-metric-strip">
                  <Metric
                    label="Contract Value"
                    value={formatMoney(estimate.total)}
                  />
                  <Metric
                    label="Invoiced"
                    value={formatMoney(issuedInvoiced)}
                    blue
                  />
                  <Metric label="Paid" value={formatMoney(paidTotal)} green />
                  <Metric
                    label="Remaining to Invoice"
                    value={formatMoney(remainingToInvoice)}
                    amber
                  />
                </div>

                <div className="invoice-tree-branch">
                  <div className="tree-line" />

                  <div className="invoice-tree-list">
                    {estimateInvoices.map((invoice) => (
                      <div className="invoice-tree-row-shell" key={invoice.id}>
                        <button
                          type="button"
                          className="invoice-tree-row"
                          onClick={() =>
                            navigate("InvoiceBuilder", {
                              jobId: job.id,
                              invoiceId: invoice.id,
                            })
                          }
                        >
                          <div className="invoice-tree-left">
                            <div className="tree-node-arrow">↳</div>
                            <div className="document-icon invoice-icon">🧾</div>

                            <div>
                              <div className="tree-title-row">
                                <h3>
                                  {invoice.invoiceNumber || "Draft Invoice"}
                                </h3>

                                <span className="invoice-type-pill">
                                  {invoice.invoiceType || "invoice"} invoice
                                </span>
                              </div>

                              <p>
                                {invoice.issuedAt
                                  ? `Issued ${formatDate(invoice.issuedAt)}`
                                  : invoice.invoiceDate
                                    ? `Dated ${formatDate(invoice.invoiceDate)}`
                                    : "No invoice date"}
                              </p>
                            </div>
                          </div>

                          <div className="invoice-tree-payment">
                            {invoice.status === "paid" ? (
                              <>
                                <strong>Paid</strong>
                                <span>{formatDate(invoice.paidAt)}</span>
                                <span>
                                  {invoice.paymentMethod || "Bank transfer"}
                                </span>
                              </>
                            ) : (
                              <>
                                <strong>{invoice.status || "draft"}</strong>
                                <span>
                                  Outstanding{" "}
                                  {formatMoney(
                                    Math.max(
                                      Number(invoice.total || 0) -
                                        Number(invoice.paidAmount || 0),
                                      0,
                                    ),
                                  )}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="invoice-tree-total">
                            <span
                              className={`document-status ${
                                invoice.status || "draft"
                              }`}
                            >
                              {invoice.status || "draft"}
                            </span>

                            <strong>{formatMoney(invoice.total)}</strong>
                          </div>

                          <div className="document-row-overlay">
                            View Invoice →
                          </div>
                        </button>

                        {invoice.status === "draft" && (
                          <button
                            type="button"
                            className="sleekButton dangerButton document-delete-button"
                            onClick={() => deleteDraftInvoice(invoice.id)}
                          >
                            Delete Draft
                          </button>
                        )}
                      </div>
                    ))}

                    {remainingToInvoice > 0 && estimate.status !== "draft" && (
                      <button
                        type="button"
                        className="create-next-invoice-card"
                        onClick={() => createNextInvoice(estimate)}
                      >
                        <div className="plus-node">+</div>

                        <div>
                          <strong>Create Next Invoice</strong>
                          <span>
                            Create a new invoice for the remaining balance (
                            {formatMoney(remainingToInvoice)})
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {estimate.status === "draft" && (
                  <button
                    type="button"
                    className="sleekButton dangerButton document-delete-button"
                    onClick={() => deleteDraftEstimate(estimate.id)}
                  >
                    Delete Draft Estimate
                  </button>
                )}
              </article>
            );
          })
        )}
      </section>

      {standaloneInvoices.length > 0 && (
        <section className="financial-estimate-tree standalone-invoice-panel">
          <div className="financial-tree-header">
            <div className="financial-tree-leading">
              <div className="document-icon">🧾</div>

              <div>
                <div className="tree-title-row">
                  <h2>Standalone Invoices</h2>
                  <span className="document-status issued">
                    {standaloneInvoices.length}
                  </span>
                </div>

                <p>Extras, waste runs, materials, and one-off invoices</p>
              </div>
            </div>
          </div>

          <div className="invoice-tree-list standalone-invoice-list">
            {standaloneInvoices.map((invoice) => (
              <div className="invoice-tree-row-shell" key={invoice.id}>
                <button
                  type="button"
                  className="invoice-tree-row"
                  onClick={() =>
                    navigate("InvoiceBuilder", {
                      jobId: job.id,
                      invoiceId: invoice.id,
                    })
                  }
                >
                  <div className="invoice-tree-left">
                    <div className="document-icon invoice-icon">🧾</div>

                    <div>
                      <div className="tree-title-row">
                        <h3>{invoice.invoiceNumber || "Draft Invoice"}</h3>

                        <span className="invoice-type-pill">
                          {invoice.invoiceType || "standalone"} invoice
                        </span>
                      </div>

                      <p>
                        {invoice.issuedAt
                          ? `Issued ${formatDate(invoice.issuedAt)}`
                          : invoice.invoiceDate
                            ? `Dated ${formatDate(invoice.invoiceDate)}`
                            : "No invoice date"}
                      </p>
                    </div>
                  </div>

                  <div className="invoice-tree-payment">
                    {invoice.status === "paid" ? (
                      <>
                        <strong>Paid</strong>
                        <span>{formatDate(invoice.paidAt)}</span>
                        <span>{invoice.paymentMethod || "Bank transfer"}</span>
                      </>
                    ) : (
                      <>
                        <strong>{invoice.status || "draft"}</strong>
                        <span>
                          Outstanding{" "}
                          {formatMoney(
                            Math.max(
                              Number(invoice.total || 0) -
                                Number(invoice.paidAmount || 0),
                              0,
                            ),
                          )}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="invoice-tree-total">
                    <span
                      className={`document-status ${invoice.status || "draft"}`}
                    >
                      {invoice.status || "draft"}
                    </span>

                    <strong>{formatMoney(invoice.total)}</strong>
                  </div>

                  <div className="document-row-overlay">View Invoice →</div>
                </button>

                {invoice.status === "draft" && (
                  <button
                    type="button"
                    className="sleekButton dangerButton document-delete-button"
                    onClick={() => deleteDraftInvoice(invoice.id)}
                  >
                    Delete Draft
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <button
        className="sleekButton ghostButton"
        onClick={createNewStandaloneInvoice}
      >
        + Standalone Invoice
      </button>

      <p className="financial-tree-note">
        To create an additional invoice related to the job but not the original
        estimate, click the button above.
      </p>
    </div>
  );
}

function Metric({ label, value, blue, green, amber }) {
  return (
    <div className="tree-metric">
      <span>{label}</span>
      <strong
        className={[
          blue ? "metric-blue" : "",
          green ? "metric-green" : "",
          amber ? "metric-amber" : "",
        ].join(" ")}
      >
        {value}
      </strong>
    </div>
  );
}

function SummaryCard({ title, value, sub, success }) {
  return (
    <div className="documents-summary-card">
      <span>{title}</span>
      <strong className={success ? "metric-green" : ""}>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function EmptyDocuments({ label }) {
  return (
    <div className="empty-documents-box">
      <strong>{label}</strong>
      <span>Create one from the actions above.</span>
    </div>
  );
}

export default JobDocuments;

