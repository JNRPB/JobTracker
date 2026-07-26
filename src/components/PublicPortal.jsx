// PublicPortal.jsx
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

function getPortalStatus(summary) {
  if (Number(summary?.amountDueNow || 0) > 0) return "payment_due";
  if (
    Number(summary?.outstandingTotal || 0) <= 0 &&
    Number(summary?.paidTotal || 0) > 0
  )
    return "paid";
  return "estimate_ready";
}

function PublicPortal({ navData }) {
  const token =
    navData?.token ||
    window.location.pathname.split("/portal/")[1] ||
    window.location.pathname.split("/estimate/")[1] ||
    window.location.pathname.split("/invoice/")[1];

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);

  useEffect(() => {
    async function loadPortal() {
      try {
        const res = await fetch(`${API_BASE}/api/public-portal/${token}`);

        if (!res.ok) throw new Error("Portal not found");

        const portalData = await res.json();
        setData(portalData);

        await fetch(`${API_BASE}/api/public-portal/${token}/view`, {
          method: "POST",
        });
      } catch (err) {
        setError(err.message || "Could not load portal");
      }
    }

    if (token) loadPortal();
  }, [token]);

  if (error) {
    return (
      <div className="publicEstimatePage">
        <div className="publicEstimateCard publicEstimateError">
          <img src={logo} alt="JNR Plastering & Building" />
          <h1>Client portal unavailable</h1>
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
          <h1>Loading client portal...</h1>
        </div>
      </div>
    );
  }

  const {
    job,
    estimate,
    invoices = [],
    payments = [],
    balanceSummary = {},
  } = data;

  const company = estimate?.companySnapshot || estimate?.fromSnapshot || {};
  const customer = estimate?.customerSnapshot || job?.customerDetails || {};
  const customerName = customer.name || job?.customerDetails?.name || "—";

  const status = getPortalStatus(balanceSummary);

  const heroLabel =
    status === "payment_due"
      ? "Payment Due"
      : status === "paid"
        ? "Paid In Full"
        : "Estimate Ready";

  const heroAmount =
    status === "payment_due"
      ? balanceSummary.amountDueNow
      : status === "paid"
        ? 0
        : estimate?.total;

  return (
    <div className="publicEstimatePage">
      <div className="publicEstimateToolbar">
        <div>
          <strong>JNR Plastering & Building</strong>
          <span>Secure client portal</span>
        </div>

        <button
          type="button"
          onClick={() => {
            document.body.classList.add("printingDocument");
            window.print();
            setTimeout(() => {
              document.body.classList.remove("printingDocument");
            }, 500);
          }}
        >
          Print / Save PDF
        </button>
      </div>

      <main className="publicEstimateCard">
        <section className="publicEstimateHero">
          <div className="publicEstimateBrandBlock">
            <img src={logo} alt="JNR Plastering & Building" />

            <div>
              <span>Welcome</span>
              <strong>Hi {customerName},</strong>
              <p>We're delighted to be working with you.</p>
            </div>
          </div>
        </section>

        <section className="publicEstimateIntro">
          <p className="publicEstimateEyebrow">Secure Client Portal</p>

          <h1>Welcome to your Project Portal</h1>

          <p>
            This secure portal has been created specifically for your project.
            Throughout the works this page will automatically update with your
            estimates, invoices, payment progress, project documents,
            photographs and important updates.
          </p>
        </section>

        <section className="publicEstimateProjectCard">
          <div>
            <span>Project</span>
            <strong>{job?.name}</strong>
          </div>

          <div>
            <span>Property</span>
            <strong>{job?.address}</strong>
          </div>

          <div>
            <span>Contractor</span>
            <strong>JNR Plastering & Building</strong>
          </div>

          <div>
            <span>Status</span>
            <strong>{job.status}</strong>
          </div>
        </section>

        <section className="publicEstimateNextBox">
          <div>
            <p className="publicEstimateEyebrow">Current Action</p>

            {Number(balanceSummary.amountDueNow || 0) > 0 ? (
              <>
                <h2>Payment required</h2>
                <p>
                  A payment of{" "}
                  <strong>{money(balanceSummary.amountDueNow)}</strong> is
                  currently due for this project. Please use the payment details
                  on the relevant invoice or contact Josh if anything needs
                  discussing.
                </p>
              </>
            ) : estimate && !estimate.acceptedAt ? (
              <>
                <h2>Estimate awaiting acceptance</h2>
                <p>
                  Please review estimate{" "}
                  <strong>{estimate.number || estimate.quoteNumber}</strong>. If
                  everything looks right, reply to the email you received to
                  confirm you are happy to proceed.
                </p>
              </>
            ) : (
              <>
                <h2>No action needed</h2>
                <p>
                  Everything is currently up to date. Any new estimates,
                  invoices, payment requests or project updates will appear
                  here.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="publicEstimateSection">
          <div className="publicEstimateSectionHeader">
            <div>
              <p className="publicEstimateEyebrow">Contract Documents</p>
              <h2>Estimates & Invoices</h2>
            </div>

            <span>
              {(estimate ? 1 : 0) + invoices.length} document
              {(estimate ? 1 : 0) + invoices.length === 1 ? "" : "s"}
            </span>
          </div>

          {estimate ? (
            <div className="publicEstimateItems">
              <article className="publicEstimateItem portalContractCard">
                <div className="publicEstimateItemNumber">EST</div>

                <div className="publicEstimateItemContent">
                  <h3>
                    {estimate.portalTitle ||
                      estimate.tag ||
                      estimate.title ||
                      "Estimate"}
                  </h3>

                  <p>
                    {estimate.number || estimate.quoteNumber} · Issued{" "}
                    {formatDate(estimate.issuedAt || estimate.createdAt)}
                    {estimate.acceptedAt
                      ? ` · Accepted ${formatDate(estimate.acceptedAt)}`
                      : ""}
                  </p>

                  <button
                    type="button"
                    className="sleekButton ghostButton"
                    onClick={() =>
                      setSelectedDocument({
                        type: "estimate",
                        data: estimate,
                      })
                    }
                  >
                    View Estimate →
                  </button>

                  <div className="portalTree">
                    {invoices
                      .filter(
                        (invoice) =>
                          String(invoice.estimateId) === String(estimate.id),
                      )
                      .map((invoice) => {
                        const paid = Number(invoice.paidAmount || 0);
                        const due = Math.max(
                          Number(invoice.total || 0) - paid,
                          0,
                        );

                        return (
                          <button
                            type="button"
                            key={invoice.id}
                            className="portalTreeRow"
                            onClick={() =>
                              setSelectedDocument({
                                type: "invoice",
                                data: invoice,
                              })
                            }
                          >
                            <div className="portalTreeBranch">↳</div>

                            <div className="portalTreeIcon">INV</div>

                            <div className="portalTreeMain">
                              <strong>
                                {invoice.invoiceNumber || invoice.number}
                              </strong>

                              <span>
                                {(invoice.invoiceType || "Invoice").replaceAll(
                                  "_",
                                  " ",
                                )}{" "}
                                · Issued{" "}
                                {formatDate(
                                  invoice.issuedAt || invoice.invoiceDate,
                                )}
                                {invoice.paidAt
                                  ? ` · Settled ${formatDate(invoice.paidAt)}`
                                  : ""}
                              </span>
                            </div>

                            <div className="portalTreeStatus">
                              <span
                                className={`portalStatusPill ${
                                  due > 0 ? "due" : "paid"
                                }`}
                              >
                                {due > 0 ? "DUE" : "PAID"}
                              </span>

                              <strong>
                                {due > 0 ? money(due) : money(invoice.total)}
                              </strong>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <strong className="portalContractTotal">
                  {money(estimate.total)}
                </strong>
              </article>
            </div>
          ) : (
            <div className="publicEstimateItems">
              <article className="publicEstimateItem">
                <div className="publicEstimateItemNumber">EST</div>

                <div className="publicEstimateItemContent">
                  <h3>No estimate available yet</h3>
                  <p>Your estimate will appear here once it has been issued.</p>
                </div>
              </article>
            </div>
          )}
        </section>

        {invoices.filter((invoice) => !invoice.estimateId).length > 0 && (
          <section className="publicEstimateSection">
            <div className="publicEstimateSectionHeader">
              <div>
                <p className="publicEstimateEyebrow">Other Documents</p>
                <h2>Standalone Invoices</h2>
              </div>

              <span>
                {invoices.filter((invoice) => !invoice.estimateId).length}
              </span>
            </div>

            <div className="publicEstimateItems">
              {invoices
                .filter((invoice) => !invoice.estimateId)
                .map((invoice) => {
                  const paid = Number(invoice.paidAmount || 0);
                  const due = Math.max(Number(invoice.total || 0) - paid, 0);

                  return (
                    <button
                      type="button"
                      key={invoice.id}
                      className="publicEstimateItem"
                      onClick={() =>
                        setSelectedDocument({
                          type: "invoice",
                          data: invoice,
                        })
                      }
                    >
                      <div className="publicEstimateItemNumber">INV</div>

                      <div className="publicEstimateItemContent">
                        <h3>
                          {invoice.portalTitle ||
                            invoice.invoiceType ||
                            invoice.invoiceNumber ||
                            invoice.number}
                        </h3>

                        <p>
                          {invoice.invoiceNumber || invoice.number} · Issued{" "}
                          {formatDate(invoice.issuedAt || invoice.invoiceDate)}
                          {invoice.paidAt
                            ? ` · Settled ${formatDate(invoice.paidAt)}`
                            : ""}
                        </p>
                      </div>

                      <div className="portalTreeStatus">
                        <span
                          className={`portalStatusPill ${due > 0 ? "due" : "paid"}`}
                        >
                          {due > 0 ? "DUE" : "PAID"}
                        </span>

                        <strong>
                          {due > 0 ? money(due) : money(invoice.total)}
                        </strong>
                      </div>
                    </button>
                  );
                })}
            </div>
          </section>
        )}

        {(job?.portal?.activity || []).length > 0 && (
          <section className="publicEstimateSection">
            <div className="publicEstimateSectionHeader">
              <div>
                <p className="publicEstimateEyebrow">Recent Activity</p>
                <h2>Project Updates</h2>
              </div>

              <span>{job.portal.activity.length}</span>
            </div>

            <div className="publicEstimateItems">
              {job.portal.activity.map((item) => (
                <article key={item.id} className="publicEstimateItem">
                  <div className="publicEstimateItemNumber">📄</div>

                  <div className="publicEstimateItemContent">
                    <h3>{item.title}</h3>
                    <p>{item.message}</p>
                  </div>

                  <strong>
                    {new Date(item.createdAt).toLocaleDateString("en-GB")}
                  </strong>
                </article>
              ))}
            </div>
          </section>
        )}

        {selectedDocument && (
          <div
            className="fileLightboxBackdrop"
            onClick={() => setSelectedDocument(null)}
          >
            <div className="fileLightbox" onClick={(e) => e.stopPropagation()}>
              <div className="fileLightboxHeader">
                <strong>
                  {selectedDocument.type === "estimate"
                    ? selectedDocument.data.number ||
                      selectedDocument.data.quoteNumber
                    : selectedDocument.data.invoiceNumber ||
                      selectedDocument.data.number}
                </strong>

                <div className="fileLightboxHeaderActions">
                  <button
                    type="button"
                    className="sleekButton ghostButton"
                    onClick={() => {
                      const doc = selectedDocument.data;

                      window.open(
                        `/job-tracker/portal/${token}/print/${selectedDocument.type}/${doc.id}`,
                        "_blank",
                      );
                    }}
                  >
                    Print / Save PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDocument(null)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="fileLightboxBody">
                <h2>
                  {selectedDocument.type === "estimate"
                    ? "Estimate Preview"
                    : "Invoice Preview"}
                </h2>

                <div className="printOnlyDocument">
                  <PublicDocumentPreview
                    type={selectedDocument.type}
                    document={selectedDocument.data}
                    job={job}
                    company={company}
                    customer={customer}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="publicEstimateFooter">
          <div>
            <strong>Need help?</strong>

            <p>
              If you have any questions regarding your project, simply reply to
              one of our emails or contact Josh directly.
            </p>
          </div>

          <div>
            <span>{company.phone}</span>
            <span>{company.email}</span>
            <span>{company.website}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

function PublicDocumentPreview({ type, document, job }) {
  const isInvoice = type === "invoice";
  const items = Array.isArray(document.items) ? document.items : [];

  const companyDetails =
    document.companySnapshot || document.fromSnapshot || {};

  const customerDetails =
    document.customerSnapshot || job?.customerDetails || {};

  return (
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
          {companyDetails.vatNumber && <p>VAT: {companyDetails.vatNumber}</p>}
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
              document.invoiceDate || document.issuedAt || document.createdAt,
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
              <td>{money(Number(item.rate || 0) * Number(item.qty || 0))}</td>
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
  );
}
function SideTotal({ label, value, strong }) {
  return (
    <div className="estimateTotalRow">
      <span>{label}</span>
      <strong className={strong ? "estimateGrandTotal" : ""}>{value}</strong>
    </div>
  );
}
export default PublicPortal;

