import { useEffect, useMemo, useState } from "react";
import "./VatPage.css";

const API_BASE = "";

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const METHOD_LABELS = {
  unconfirmed: "Accounting method not confirmed",
  invoice: "Standard VAT accounting · invoice date",
  cash: "VAT Cash Accounting · payment date",
};

export default function BusinessFacts({ navigate }) {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPeriods() {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/vat/periods`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load VAT periods.");
        const loadedPeriods = Array.isArray(data.periods) ? data.periods : [];
        const selected = data.currentPeriod || [...loadedPeriods].reverse().find((period) => period.end < new Date().toISOString().slice(0, 10)) || loadedPeriods[0];
        setPeriods(loadedPeriods);
        setSelectedPeriodId(selected?.id || "");
      } catch (error) {
        setMessage(error.message);
        setLoading(false);
      }
    }
    loadPeriods();
  }, []);

  useEffect(() => {
    if (!selectedPeriodId) return;
    async function loadWorkspace() {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`${API_BASE}/api/vat/period/${encodeURIComponent(selectedPeriodId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load this VAT period.");
        setWorkspace(data);
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    }
    loadWorkspace();
  }, [selectedPeriodId]);

  async function setInvoiceDecision(invoice, included) {
    setSavingKey(invoice.key);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/vat/output-decision`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId: selectedPeriodId, key: invoice.key, included }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the invoice decision.");
      setWorkspace(data.workspace);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingKey("");
    }
  }

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId),
    [periods, selectedPeriodId],
  );

  const includedOutputCount = workspace?.outputInvoices?.filter((invoice) => invoice.included).length || 0;

  return (
    <main className="vatPage">
      <header className="vatHeader">
        <div>
          <p className="vatEyebrow">JNR accounts</p>
          <h1>VAT</h1>
          <p>Review purchases and sales invoices before they reach the accountant portal.</p>
        </div>
        <div className="vatHeaderActions">
          <label>
            <span>VAT period</span>
            <select value={selectedPeriodId} onChange={(event) => setSelectedPeriodId(event.target.value)}>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.isCurrent ? "Current · " : ""}{period.label}
                </option>
              ))}
            </select>
          </label>
          <a className="vatPortalButton" href="/accountant" target="_blank" rel="noreferrer">Open accountant portal ↗</a>
        </div>
      </header>

      {message && <div className="vatMessage">{message}</div>}

      {workspace?.accountingMethod === "unconfirmed" && (
        <section className="vatWarning">
          <div><strong>VAT accounting method needs confirming</strong><p>JNR has not yet selected invoice-basis or cash-basis VAT. Issued and paid dates are shown below, and no sales invoice reaches the accountant until you include it.</p></div>
          <span>Safe review mode</span>
        </section>
      )}

      <section className="vatSummaryGrid" aria-busy={loading}>
        <article><span>Input VAT</span><strong>{money(workspace?.totals?.inputVat)}</strong><small>{workspace?.inputFiles?.length || 0} purchase documents</small></article>
        <article><span>Output VAT</span><strong>{money(workspace?.totals?.outputVat)}</strong><small>{includedOutputCount} included sales invoices</small></article>
        <article className={(workspace?.totals?.estimatedVatDue || 0) < 0 ? "refund" : "due"}><span>Estimated position</span><strong>{money(Math.abs(workspace?.totals?.estimatedVatDue || 0))}</strong><small>{(workspace?.totals?.estimatedVatDue || 0) < 0 ? "Potential repayment" : "Potential VAT due"}</small></article>
        <article className={workspace?.totals?.outputToReview ? "attention" : "complete"}><span>Output to review</span><strong>{workspace?.totals?.outputToReview || 0}</strong><small>{workspace?.totals?.outputToReview ? "Decisions still needed" : "All decisions recorded"}</small></article>
      </section>

      <section className="vatPanel">
        <div className="vatPanelHeader">
          <div><p className="vatSectionLabel">Purchases</p><h2>Input VAT</h2><p>Supplier invoices and receipts dated inside {selectedPeriod?.label || "this period"}.</p></div>
          <div className="vatPanelTotal"><span>Reclaimable VAT recorded</span><strong>{money(workspace?.totals?.inputVat)}</strong></div>
        </div>
        <div className="vatTableWrap">
          <table className="vatTable">
            <thead><tr><th>Document</th><th>Date</th><th>Supplier</th><th>Net</th><th>VAT</th><th>Gross</th><th>Status</th></tr></thead>
            <tbody>
              {(workspace?.inputFiles || []).map((file) => (
                <tr key={file.id}>
                  <td><a href={file.url || "#"} target="_blank" rel="noreferrer">{file.name}</a></td>
                  <td>{formatDate(file.purchaseDate)}</td>
                  <td>{file.supplier}</td>
                  <td>{money(file.net)}</td><td className="vatMoneyBlue">{money(file.vatAmount)}</td><td>{money(file.gross)}</td>
                  <td><span className={`vatStatus ${file.reviewed ? "complete" : "review"}`}>{file.reviewed ? "Reviewed" : "VAT review needed"}</span></td>
                </tr>
              ))}
              {!loading && !workspace?.inputFiles?.length && <tr><td colSpan="7" className="vatEmpty">No purchase documents in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="vatPanel">
        <div className="vatPanelHeader">
          <div><p className="vatSectionLabel">Sales</p><h2>Output VAT</h2><p>Issued or paid invoices relevant to this period. Estimates are deliberately excluded.</p></div>
          <div className="vatPanelTotal"><span>VAT on included invoices</span><strong>{money(workspace?.totals?.outputVat)}</strong></div>
        </div>
        <div className="vatMethodBar"><strong>{METHOD_LABELS[workspace?.accountingMethod] || METHOD_LABELS.unconfirmed}</strong><span>Issued and paid dates remain visible so the accountant can verify the treatment.</span></div>
        <div className="vatTableWrap">
          <table className="vatTable output">
            <thead><tr><th>Invoice</th><th>Job / customer</th><th>Issued</th><th>Paid</th><th>Net</th><th>VAT</th><th>Gross</th><th>Accountant pack</th></tr></thead>
            <tbody>
              {(workspace?.outputInvoices || []).map((invoice) => (
                <tr key={invoice.key} className={invoice.decision === "review" ? "needsDecision" : ""}>
                  <td><strong>{invoice.invoiceNumber}</strong><small>{invoice.status}</small><button className="vatInvoiceLink" type="button" onClick={() => navigate?.("InvoiceBuilder", { jobId: invoice.jobId, invoiceId: invoice.invoiceId })}>{invoice.publicToken ? "Open invoice →" : invoice.isIssued ? "Open and create PDF →" : "Open and issue →"}</button>{invoice.publicToken && <a href={`/api/public-invoices/${encodeURIComponent(invoice.publicToken)}/pdf`} target="_blank" rel="noreferrer">Open PDF</a>}</td>
                  <td><strong>{invoice.jobName}</strong><small>{invoice.customer}</small></td>
                  <td><span className={invoice.issuedInPeriod ? "vatDateMatch" : ""}>{formatDate(invoice.issuedDate)}</span></td>
                  <td><span className={invoice.paidInPeriod ? "vatDateMatch" : ""}>{formatDate(invoice.paidDate)}</span></td>
                  <td>{money(invoice.subtotal)}</td><td className="vatMoneyBlue">{money(invoice.vatAmount)}</td><td>{money(invoice.total)}</td>
                  <td>
                    <div className="vatDecisionButtons">
                      <button type="button" className={invoice.included ? "selected include" : "include"} disabled={savingKey === invoice.key || !invoice.publicToken} onClick={() => setInvoiceDecision(invoice, true)}>Include</button>
                      <button type="button" className={invoice.decision === "exclude" ? "selected exclude" : "exclude"} disabled={savingKey === invoice.key} onClick={() => setInvoiceDecision(invoice, false)}>Exclude</button>
                    </div>
                    {!invoice.publicToken && (
                      <small className="vatNoPdf">
                        {invoice.isIssued
                          ? "This issued invoice is missing its PDF link. Open it and press Create PDF Link."
                          : "Open this invoice and press Issue Paid Invoice to create its number and PDF."}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && !workspace?.outputInvoices?.length && <tr><td colSpan="8" className="vatEmpty">No issued or paid sales invoices are relevant to this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
