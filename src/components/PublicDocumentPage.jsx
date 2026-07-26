import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import "./FinancialDocuments.css";

const API_BASE = "";

function money(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SideTotal({ label, value, strong }) {
  return (
    <div className="estimateTotalRow">
      <span>{label}</span>
      <strong className={strong ? "estimateGrandTotal" : ""}>{value}</strong>
    </div>
  );
}

function PublicDocumentPage({ navData }) {
  const { token, type, id } = navData;

  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPortal() {
      try {
        const res = await fetch(`${API_BASE}/api/public-portal/${token}`);

        if (!res.ok) throw new Error("Document not found");

        const portalData = await res.json();

        const document =
          type === "estimate"
            ? portalData.estimate
            : (portalData.invoices || []).find(
                (invoice) => String(invoice.id) === String(id),
              );

        if (!document) throw new Error("Document not found");

        setData({
          job: portalData.job,
          document,
        });
      } catch (err) {
        setError(err.message || "Could not load document");
      }
    }

    if (token && type && id) loadPortal();
  }, [token, type, id]);

  if (error) {
    return (
      <div className="estimatePage">
        <div className="bubbleBox">
          <h1>{error}</h1>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="estimatePage">
        <div className="bubbleBox">
          <h1>Loading document...</h1>
        </div>
      </div>
    );
  }

  const { job, document } = data;
  const isInvoice = type === "invoice";
  const items = Array.isArray(document.items) ? document.items : [];

  const companyDetails =
    document.companySnapshot || document.fromSnapshot || {};

  const customerDetails =
    document.customerSnapshot || job.customerDetails || {};

  return (
    <div className="estimatePage printDocumentPage">
      <div className="estimateTopbar no-print">
        <button
          className="sleekButton ghostButton"
          type="button"
          onClick={() => window.close()}
        >
          Close
        </button>

        <h1>
          {document.invoiceNumber ||
            document.number ||
            document.quoteNumber ||
            "Document"}
        </h1>

        <button
          className="sleekButton primaryButton"
          type="button"
          onClick={() => window.print()}
        >
          Print / Save PDF
        </button>
      </div>

      <main className="estimateCanvas printDocumentCanvas">
        <div className="estimatePreview">
          <div className="estimatePreviewHeader">
            <img src={logo} alt="JNR logo" />

            <div>
              <h1>{companyDetails.name || "JNR Plastering & Building"}</h1>
              <p>{companyDetails.owner || "Joshua Roberton"}</p>
              <p>{companyDetails.address1}</p>
              <p>{companyDetails.address2}</p>
              <p>{companyDetails.postcode}</p>
              <p>{companyDetails.phone}</p>
              <p>{companyDetails.email}</p>
              {companyDetails.vatNumber && (
                <p>VAT: {companyDetails.vatNumber}</p>
              )}
              {companyDetails.companyNumber && (
                <p>Company No: {companyDetails.companyNumber}</p>
              )}
            </div>

            <div className="estimatePreviewMeta">
              <strong>{isInvoice ? "Invoice" : "Estimate"}</strong>

              <span>
                {document.invoiceNumber ||
                  document.number ||
                  document.quoteNumber ||
                  "DRAFT"}
              </span>

              <span>
                {formatDate(
                  document.invoiceDate ||
                    document.issuedAt ||
                    document.createdAt,
                )}
              </span>

              <span>{(document.status || "issued").toUpperCase()}</span>

              <div className="invoiceAmountDueBox">
                <span>{isInvoice ? "Amount due" : "Estimate total"}</span>
                <strong>{money(document.total)}</strong>
              </div>
            </div>
          </div>

          <div className="estimatePreviewBillTo">
            <strong>TO</strong>
            <h2>{customerDetails.name}</h2>
            <p>{customerDetails.address1 || customerDetails.address}</p>
            <p>{customerDetails.address2}</p>
            <p>{customerDetails.postcode}</p>
            <p>{customerDetails.phone}</p>
            <p>{customerDetails.email}</p>
          </div>

          <table className="estimatePreviewTable invoiceLineTable">
            <thead>
              <tr>
                <th>Description</th>
                <th>Rate</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr
                  key={item.id || index}
                  className={index % 2 ? "shadedLine" : ""}
                >
                  <td>
                    <strong>{item.description}</strong>
                    <p>{item.details}</p>
                  </td>
                  <td>{money(item.rate)}</td>
                  <td>{item.qty}</td>
                  <td>
                    {money(Number(item.rate || 0) * Number(item.qty || 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="estimatePreviewTotals">
            <SideTotal label="Net" value={money(document.subtotal)} />
            <SideTotal label="VAT" value={money(document.vatAmount)} />
            <SideTotal
              label={isInvoice ? "Amount Due" : "Estimate Total"}
              value={money(document.total)}
              strong
            />
          </div>

          {document.notes && (
            <div className="estimatePreviewNotes">{document.notes}</div>
          )}

          {document.footnote && (
            <div className="estimatePreviewNotes">{document.footnote}</div>
          )}

          {isInvoice && document.paidAt && (
            <div className="estimatePreviewNotes">
              Payment received: {money(document.paidAmount)} on{" "}
              {formatDate(document.paidAt)} by{" "}
              {document.paymentMethod || "Bank transfer"}.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default PublicDocumentPage;

