import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import "./PublicEstimate.css";

const API_BASE = "";

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getFirstName(name) {
  if (!name) return "there";
  return name.trim().split(" ")[0];
}

function PublicInvoice({ navData }) {
  const token =
    navData?.token || window.location.pathname.split("/invoice/")[1];

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    async function loadInvoice() {
      try {
        const res = await fetch(`${API_BASE}/api/public-invoices/${token}`);

        if (!res.ok) {
          throw new Error("Invoice not found");
        }

        const invoiceData = await res.json();
        setData(invoiceData);

        await fetch(`${API_BASE}/api/public-invoices/${token}/view`, {
          method: "POST",
        });
      } catch (err) {
        setError(err.message || "Could not load invoice");
      }
    }

    if (token) {
      loadInvoice();
    }
  }, [token]);

  if (error) {
    return (
      <div className="publicEstimatePage">
        <div className="publicEstimateCard publicEstimateError">
          <img src={logo} alt="JNR Plastering & Building" />
          <h1>Invoice unavailable</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="publicEstimatePage">
        <div className="publicEstimateCard publicEstimateError">
          <img src={logo} alt="JNR Plastering & Building" />
          <h1>Loading invoice...</h1>
        </div>
      </div>
    );
  }

  const { job, invoice } = data;

  const company = invoice.companySnapshot || invoice.fromSnapshot || {};
  const customer = invoice.customerSnapshot || job.customerDetails || {};
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  const customerName = customer.name || job.customerDetails?.name || "";
  const friendlyName = getFirstName(customerName);

  const isPaid = String(invoice.status || "").toLowerCase() === "paid";
  const amountDue = Math.max(
    Number(invoice.total || 0) - Number(invoice.paidAmount || 0),
    0,
  );

  return (
    <div className="publicEstimatePage">
      <div className="publicEstimateToolbar">
        <div>
          <strong>JNR Plastering & Building</strong>
          <span>Invoice prepared for review</span>
        </div>

        <button type="button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <main className="publicEstimateCard">
        <section className="publicEstimateHero">
          <div className="publicEstimateBrandBlock">
            <img src={logo} alt="JNR Plastering & Building" />

            <div>
              <span>Issued by</span>
              <strong>{company.name || "JNR Plastering & Building"}</strong>
              <p>{company.owner || "Joshua Roberton"}</p>
            </div>
          </div>

          <div className="publicEstimateHeroTotal">
            <span>{isPaid ? "Invoice Paid" : "Amount Due"}</span>
            <strong>{money(isPaid ? invoice.total : amountDue)}</strong>
            <p>{invoice.invoiceNumber || invoice.number || "Invoice"}</p>
          </div>
        </section>

        <section className="publicEstimateIntro">
          <p className="publicEstimateEyebrow">
            {isPaid ? "Payment received" : "Invoice ready"}
          </p>

          <h1>Good day {friendlyName}, your invoice is ready.</h1>

          <p>
            This invoice has been prepared for works at{" "}
            <strong>{job.address}</strong>.
          </p>
        </section>

        <section className="publicEstimateProjectCard">
          <div>
            <span>Project</span>
            <strong>{job.name}</strong>
          </div>

          <div>
            <span>Customer</span>
            <strong>{customerName || "—"}</strong>
          </div>

          <div>
            <span>Invoice No.</span>
            <strong>{invoice.invoiceNumber || invoice.number || "—"}</strong>
          </div>

          <div>
            <span>Invoice Date</span>
            <strong>
              {formatDate(invoice.invoiceDate || invoice.createdAt)}
            </strong>
          </div>
        </section>

        <section className="publicEstimateSection">
          <div className="publicEstimateSectionHeader">
            <div>
              <p className="publicEstimateEyebrow">Invoice items</p>
              <h2>Breakdown</h2>
            </div>

            <span>
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="publicEstimateItems">
            {items.map((item, index) => {
              const amount = Number(item.rate || 0) * Number(item.qty || 0);

              return (
                <article key={item.id || index} className="publicEstimateItem">
                  <div className="publicEstimateItemNumber">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="publicEstimateItemContent">
                    <h3>{item.description || "Invoice item"}</h3>
                    {item.details && <p>{item.details}</p>}
                  </div>

                  <strong>{money(amount)}</strong>
                </article>
              );
            })}
          </div>
        </section>

        <section className="publicEstimateTotalsPanel">
          <div>
            <span>Net</span>
            <strong>{money(invoice.subtotal)}</strong>
          </div>

          <div>
            <span>VAT</span>
            <strong>{money(invoice.vatAmount)}</strong>
          </div>

          <div>
            <span>Total</span>
            <strong>{money(invoice.total)}</strong>
          </div>

          {Number(invoice.paidAmount || 0) > 0 && (
            <div>
              <span>Paid</span>
              <strong>{money(invoice.paidAmount)}</strong>
            </div>
          )}

          <div className="publicEstimateGrandTotal">
            <span>{isPaid ? "Balance" : "Amount Due"}</span>
            <strong>{money(isPaid ? 0 : amountDue)}</strong>
          </div>
        </section>

        <section className="publicEstimateNextBox">
          <div>
            <p className="publicEstimateEyebrow">
              {isPaid ? "Status" : "Payment"}
            </p>

            <h2>{isPaid ? "This invoice has been paid" : "Payment due"}</h2>

            <p>
              {isPaid
                ? `Payment was received on ${formatDate(
                    invoice.paidAt,
                  )} by ${invoice.paymentMethod || "Bank transfer"}.`
                : "Please make payment using the details provided below. If you have any questions, reply to the email you received or contact Josh directly."}
            </p>
          </div>

          <button type="button" disabled>
            Online Payment Coming Soon
          </button>
        </section>

        {invoice.footnote && (
          <section className="publicEstimateTerms">
            <button type="button" onClick={() => setTermsOpen((prev) => !prev)}>
              <span>Payment Details / Notes</span>
              <strong>{termsOpen ? "−" : "+"}</strong>
            </button>

            {termsOpen && <pre>{invoice.footnote}</pre>}
          </section>
        )}

        {(invoice.attachments || []).length > 0 && (
          <section className="publicEstimateSection">
            <div className="publicEstimateSectionHeader">
              <div>
                <p className="publicEstimateEyebrow">Attachments</p>
                <h2>Supporting Documents</h2>
              </div>

              <span>{invoice.attachments.length}</span>
            </div>

            <div className="publicEstimateItems">
              {invoice.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="publicEstimateItem"
                >
                  <div className="publicEstimateItemNumber">📄</div>

                  <div className="publicEstimateItemContent">
                    <h3>{attachment.name}</h3>
                    <p>Open supporting document</p>
                  </div>

                  <strong>Open →</strong>
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="publicEstimateFooter">
          <div>
            <strong>Questions?</strong>
            <p>
              Reply to the email you received, or contact{" "}
              {company.owner || "Josh"} directly.
            </p>
          </div>

          <div>
            <span>{company.phone || "07964 679976"}</span>
            <span>{company.email || "info@jnrplasteringandbuilding.com"}</span>
            <span>{company.website || "jnrplasteringandbuilding.com"}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default PublicInvoice;

