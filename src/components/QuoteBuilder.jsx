import { useEffect, useMemo, useState } from "react";
import logo from "../assets/logo.png";

import "./FinancialDocuments.css";

import {
  calculateEstimateTotals,
  createEstimateDraft,
  issueEstimate,
  updateEstimateDraft,
} from "../financial/estimate";

import {
  upsertEstimateOnJob,
  upsertInvoiceOnJob,
} from "../financial/jobFinancials";
import { createInvoiceFromEstimate } from "../financial/invoice";

const API_BASE = "";

const DEFAULT_TERMS = `JNR Plastering & Building – Standard Terms

Payment Terms
Unless otherwise agreed in writing, payment for works shall be made as follows:

• 50% Deposit – Payable prior to commencement of works.
• 25% Stage Payment – Payable upon completion of approximately half of the agreed works.
• Final 25% Payment – Payable immediately upon practical completion.

Invoices become due immediately upon reaching each agreed payment stage.

Variations & Additional Works
Any changes or additional works requested during the project will be discussed and agreed before the work is undertaken.

Unforeseen Conditions
Concealed issues may only become apparent once work has started. Should this occur, work may be paused whilst suitable remedial works and costs are agreed.

Snagging
Any genuine snagging items notified within 7 days of practical completion will be rectified within a reasonable timeframe. Minor snagging items do not affect the due date of the final payment unless otherwise agreed in writing.

Workmanship Guarantee
Workmanship is guaranteed for 12 months from practical completion.

Acceptance of this quotation, estimate or instruction to proceed confirms acceptance of these Standard Terms.`;

const FALLBACK_COMPANY_DETAILS = {
  name: "JNR Plastering & Building Ltd",
  email: "info@jnrplasteringandbuilding.com",
  address1: "19 Sherwood Drive",
  address2: "Melton Mowbray",
  postcode: "LE13 0LL",
  phone: "07954 567976",
  companyNumber: "",
  vatNumber: "",
  website: "jnrplasteringandbuilding.com",
  owner: "Joshua Roberton",
};

function money(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function toDateInput(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function fromDateInput(value) {
  if (!value) return null;
  return new Date(`${value}T09:00:00`).toISOString();
}

function createHistoryEvent(type, message) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    message,
    at: new Date().toISOString(),
  };
}

function getCompanySnapshot(settings = {}) {
  return {
    name: settings.name || FALLBACK_COMPANY_DETAILS.name,
    owner: settings.owner || FALLBACK_COMPANY_DETAILS.owner,
    email: settings.email || FALLBACK_COMPANY_DETAILS.email,
    phone: settings.phone || FALLBACK_COMPANY_DETAILS.phone,
    address1: settings.address1 || FALLBACK_COMPANY_DETAILS.address1,
    address2: settings.address2 || FALLBACK_COMPANY_DETAILS.address2,
    postcode: settings.postcode || FALLBACK_COMPANY_DETAILS.postcode,
    website: settings.website || FALLBACK_COMPANY_DETAILS.website,
    companyNumber: settings.companyNumber || "",
    vatNumber: settings.vatNumber || "",
  };
}

function getCustomerSnapshot(job) {
  const customer = job?.customerDetails || {};

  return {
    name: customer.name || "",
    email: customer.email || "",
    address1: customer.address || job?.address || "",
    address2: "",
    postcode: "",
    phone: customer.phone || "",
    mobile: customer.phone || "",
  };
}

function createDefaultItems(job) {
  return [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: job?.name || "Works",
      details:
        "Supply of labour, materials and equipment to complete the agreed works.",
      rate: Number(job?.quoteTotal || 0),
      qty: 1,
      vat: true,
    },
  ];
}

function getOrCreatePortalToken(job) {
  return job?.portal?.token || crypto.randomUUID();
}

function buildPublicEstimateUrl(portalToken) {
  if (!portalToken) return "";

  return `${window.location.origin}/job-tracker/portal/${portalToken}`;
}

function QuoteBuilder({ navData, jobs, onUpdate, navigate }) {
  const job = useMemo(
    () => jobs.find((j) => String(j.id) === String(navData?.jobId)),
    [jobs, navData],
  );

  const existingEstimate = useMemo(() => {
    if (!job || !navData?.quoteId) return null;

    return (job.quotes || []).find(
      (estimate) => String(estimate.id) === String(navData.quoteId),
    );
  }, [job, navData]);

  const isExisting = Boolean(existingEstimate);
  const isIssued = ["issued", "emailed", "accepted"].includes(
    existingEstimate?.status,
  );

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [mode, setMode] = useState(isIssued ? "preview" : "edit");
  const [editingFromDetails, setEditingFromDetails] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);

  const [title, setTitle] = useState(existingEstimate?.title || "Estimate");
  const [estimateNumber, setEstimateNumber] = useState(
    existingEstimate?.number || existingEstimate?.quoteNumber || "",
  );
  const [vatRate, setVatRate] = useState(existingEstimate?.vatRate || 20);
  const [sendEmail, setSendEmail] = useState(
    existingEstimate?.customerSnapshot?.email || "",
  );
  const [notes, setNotes] = useState(existingEstimate?.notes || DEFAULT_TERMS);

  const [companyDetails, setCompanyDetails] = useState(
    existingEstimate?.companySnapshot ||
      existingEstimate?.fromSnapshot ||
      FALLBACK_COMPANY_DETAILS,
  );

  const [customerDetails, setCustomerDetails] = useState(
    existingEstimate?.customerSnapshot || getCustomerSnapshot(job),
  );

  const [items, setItems] = useState(
    existingEstimate?.items || createDefaultItems(job),
  );

  const [metaStatus, setMetaStatus] = useState(
    existingEstimate?.status || "draft",
  );
  const [metaNumber, setMetaNumber] = useState(
    existingEstimate?.number || existingEstimate?.quoteNumber || "",
  );
  const [metaCreatedAt, setMetaCreatedAt] = useState(
    toDateInput(existingEstimate?.createdAt),
  );
  const [metaIssuedAt, setMetaIssuedAt] = useState(
    toDateInput(existingEstimate?.issuedAt),
  );
  const [metaEmailedAt, setMetaEmailedAt] = useState(
    toDateInput(existingEstimate?.emailedAt),
  );
  const [metaAcceptedAt, setMetaAcceptedAt] = useState(
    toDateInput(existingEstimate?.acceptedAt),
  );

  useEffect(() => {
    if (existingEstimate) return;

    setCustomerDetails(getCustomerSnapshot(job));
    setSendEmail(job?.customerDetails?.email || "");
  }, [job, existingEstimate]);

  useEffect(() => {
    async function loadBusinessSettings() {
      try {
        const res = await fetch(`${API_BASE}/api/business-settings`);
        const data = await res.json();

        if (!existingEstimate) {
          setCompanyDetails(getCompanySnapshot(data));
          setVatRate(Number(data.defaultVatRate || 20));

          if (data.defaultTerms) {
            setNotes(data.defaultTerms);
          }
        }
      } catch (err) {
        console.error("Failed to load business settings:", err);
      } finally {
        setLoadingSettings(false);
      }
    }

    loadBusinessSettings();
  }, [existingEstimate]);

  if (loadingSettings) {
    return (
      <div className="bubbleBox">
        <h1>Loading business settings...</h1>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="bubbleBox">
        <h1>Estimate Builder</h1>
        <h2>Job not found</h2>
      </div>
    );
  }

  const totals = calculateEstimateTotals(items, vatRate);
  const subtotal = totals.subtotal;
  const vatAmount = totals.vatAmount;
  const total = totals.total;

  const publicEstimateUrl = buildPublicEstimateUrl(job.portal?.token);

  function updateItem(id, field, value) {
    if (isIssued) return;

    setItems((prev) =>
      prev.map((item) =>
        String(item.id) === String(id) ? { ...item, [field]: value } : item,
      ),
    );
  }

  function addItem() {
    if (isIssued) return;

    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: "",
        details: "",
        rate: 0,
        qty: 1,
        vat: true,
      },
    ]);
  }

  function deleteItem(id) {
    if (isIssued) return;

    setItems((prev) => prev.filter((item) => String(item.id) !== String(id)));
  }

  async function getNextEstimateNumber() {
    const res = await fetch(
      `${API_BASE}/api/business-settings/next-estimate-number`,
      {
        method: "POST",
      },
    );

    const data = await res.json();

    return data.estimateNumber;
  }

  async function saveEstimateToJob(estimate) {
    const updatedJob = upsertEstimateOnJob(job, estimate);

    await onUpdate(updatedJob);

    navigate("JobDocuments", {
      jobId: job.id,
      savedQuoteId: estimate.id,
    });
  }

  async function saveDraft() {
    if (isIssued) return;

    if (existingEstimate) {
      const updatedEstimate = updateEstimateDraft(existingEstimate, {
        title,
        companySnapshot: companyDetails,
        fromSnapshot: companyDetails,
        customerSnapshot: customerDetails,
        items,
        notes,
        vatRate: Number(vatRate || 0),
      });

      await saveEstimateToJob(updatedEstimate);
      return;
    }

    const draft = createEstimateDraft({
      job,
      companySnapshot: companyDetails,
      customerSnapshot: customerDetails,
      title,
      items,
      notes,
      vatRate: Number(vatRate || 0),
    });

    await saveEstimateToJob(draft);
  }

  async function handleIssueEstimate() {
    if (isIssued) return;

    let baseEstimate = existingEstimate;

    if (!baseEstimate) {
      baseEstimate = createEstimateDraft({
        job,
        companySnapshot: companyDetails,
        customerSnapshot: customerDetails,
        title,
        items,
        notes,
        vatRate: Number(vatRate || 0),
      });
    } else {
      baseEstimate = updateEstimateDraft(baseEstimate, {
        title,
        companySnapshot: companyDetails,
        fromSnapshot: companyDetails,
        customerSnapshot: customerDetails,
        items,
        notes,
        vatRate: Number(vatRate || 0),
      });
    }

    const number = estimateNumber || (await getNextEstimateNumber());
    const portalToken = job.portal?.token || crypto.randomUUID();

    const issuedEstimate = {
      ...issueEstimate(baseEstimate, number),
      publicToken: portalToken,
      portalToken,
      history: [
        ...(baseEstimate.history || []),
        createHistoryEvent(
          "estimate_published",
          "Estimate published to portal",
        ),
      ],
    };

    const portalActivity = {
      id: crypto.randomUUID(),
      type: "estimate",
      title: "Estimate Available",
      message: `You have received an estimate for ${job.name}.`,
      createdAt: new Date().toISOString(),
      read: false,
    };

    const updatedJob = upsertEstimateOnJob(
      {
        ...job,
        portal: {
          enabled: true,
          token: portalToken,
          activity: [portalActivity, ...(job.portal?.activity || [])],
        },
      },
      issuedEstimate,
    );

    setEstimateNumber(number);
    await onUpdate(updatedJob);

    navigate("JobDocuments", {
      jobId: job.id,
      savedQuoteId: issuedEstimate.id,
    });
  }

  async function copyPublicUrl() {
    if (!publicEstimateUrl) return;

    try {
      await navigator.clipboard.writeText(publicEstimateUrl);
      alert("Portal link copied.");
    } catch (err) {
      console.error("Could not copy portal link:", err);
      alert(publicEstimateUrl);
    }
  }

  async function saveMetaDetails() {
    if (!existingEstimate) return;

    const updatedEstimate = {
      ...existingEstimate,
      status: metaStatus,
      number: metaNumber,
      quoteNumber: metaNumber,
      createdAt: fromDateInput(metaCreatedAt) || existingEstimate.createdAt,
      issuedAt: fromDateInput(metaIssuedAt),
      emailedAt: fromDateInput(metaEmailedAt),
      acceptedAt: fromDateInput(metaAcceptedAt),
      isActive: ["issued", "emailed", "accepted"].includes(metaStatus),
      updatedAt: new Date().toISOString(),
      history: [
        ...(existingEstimate.history || []),
        createHistoryEvent("estimate_meta_edited", "Estimate details edited"),
      ],
    };

    const updatedJob = upsertEstimateOnJob(job, updatedEstimate);

    await onUpdate(updatedJob);

    setEstimateNumber(metaNumber);
    setEditingMeta(false);

    navigate("QuoteBuilder", {
      jobId: job.id,
      quoteId: existingEstimate.id,
    });
  }

  async function handleCreateInvoice() {
    if (!existingEstimate) return;

    const invoice = createInvoiceFromEstimate({
      job,
      estimate: existingEstimate,
    });

    const updatedJob = upsertInvoiceOnJob(job, invoice);

    await onUpdate(updatedJob);

    navigate("InvoiceBuilder", {
      jobId: job.id,
      invoiceId: invoice.id,
    });
  }

  return (
    <div className="estimatePage">
      <div className="estimateTopbar">
        <button
          className="sleekButton ghostButton"
          onClick={() => navigate("JobDocuments", { jobId: job.id })}
          type="button"
        >
          ← Back to Documents
        </button>

        <h1>
          {isIssued
            ? `Estimate ${estimateNumber}`
            : isExisting
              ? "Edit Draft Estimate"
              : "Create Estimate"}
        </h1>

        <div className="estimateTopActions">
          <button
            className="sleekButton ghostButton"
            onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
            type="button"
            disabled={isIssued && mode === "preview"}
          >
            {mode === "preview" ? "Edit" : "Preview"}
          </button>

          {!isIssued && (
            <>
              <button
                className="sleekButton ghostButton"
                type="button"
                onClick={saveDraft}
              >
                Save Draft
              </button>

              <button
                className="sleekButton primaryButton"
                type="button"
                onClick={handleIssueEstimate}
              >
                Publish Estimate
              </button>
            </>
          )}
        </div>
      </div>

      <div className="estimateLayout">
        <main className="estimateCanvas">
          {mode === "preview" || isIssued ? (
            <EstimatePreview
              estimate={existingEstimate}
              logo={logo}
              title={title}
              estimateNumber={estimateNumber || "DRAFT"}
              companyDetails={companyDetails}
              customerDetails={customerDetails}
              items={items}
              notes={notes}
              subtotal={subtotal}
              vatRate={vatRate}
              vatAmount={vatAmount}
              total={total}
            />
          ) : (
            <>
              <div className="estimateHeaderBlock">
                <input
                  className="estimateTitleInput"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <img src={logo} alt="JNR logo" className="estimateLogoBox" />
              </div>

              <div className="estimateTwoCol">
                <LockedDetailsColumn
                  title="From"
                  details={companyDetails}
                  isEditing={editingFromDetails}
                  onEdit={() => setEditingFromDetails(true)}
                  onDone={() => setEditingFromDetails(false)}
                  setDetails={setCompanyDetails}
                />

                <DetailsColumn
                  title="Bill To"
                  details={customerDetails}
                  setDetails={setCustomerDetails}
                />
              </div>

              <div className="estimateNumberRow">
                <label>
                  Number
                  <input value={estimateNumber || "Draft"} readOnly />
                </label>

                <label>
                  Date
                  <input
                    value={new Date().toLocaleDateString("en-GB")}
                    readOnly
                  />
                </label>
              </div>

              <div className="estimateItemsHeader">
                <span>Description</span>
                <span>Rate</span>
                <span>Qty</span>
                <span>Amount</span>
                <span>VAT</span>
              </div>

              {items.map((item) => {
                const amount = Number(item.rate || 0) * Number(item.qty || 0);

                return (
                  <div className="estimateItemRow" key={item.id}>
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={() => deleteItem(item.id)}
                    >
                      ×
                    </button>

                    <div>
                      <input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(item.id, "description", e.target.value)
                        }
                        placeholder="Description"
                      />

                      <textarea
                        value={item.details}
                        onChange={(e) =>
                          updateItem(item.id, "details", e.target.value)
                        }
                        placeholder="Detailed scope..."
                      />
                    </div>

                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) =>
                        updateItem(item.id, "rate", e.target.value)
                      }
                    />

                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(item.id, "qty", e.target.value)
                      }
                    />

                    <strong>{money(amount)}</strong>

                    <input
                      type="checkbox"
                      checked={item.vat}
                      onChange={(e) =>
                        updateItem(item.id, "vat", e.target.checked)
                      }
                    />
                  </div>
                );
              })}

              <button
                type="button"
                className="sleekButton ghostButton estimateAddButton"
                onClick={addItem}
              >
                +
              </button>

              <div className="estimateTotals">
                <SideTotal label="Subtotal" value={money(subtotal)} />
                <SideTotal
                  label={`VAT (${vatRate}%)`}
                  value={money(vatAmount)}
                />
                <SideTotal label="Total" value={money(total)} strong />
              </div>

              <label className="estimateNotes">
                Notes / Terms
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </>
          )}
        </main>

        <aside className="estimateSidebar">
          <h3>Status</h3>

          {editingMeta ? (
            <div className="estimateMetaEditor">
              <label>
                Status
                <select
                  value={metaStatus}
                  onChange={(e) => setMetaStatus(e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="issued">Issued</option>
                  <option value="emailed">Emailed</option>
                  <option value="accepted">Accepted</option>
                  <option value="superseded">Superseded</option>
                  <option value="void">Void</option>
                </select>
              </label>

              <label>
                Number
                <input
                  value={metaNumber}
                  onChange={(e) => setMetaNumber(e.target.value)}
                />
              </label>

              <label>
                Created
                <input
                  type="date"
                  value={metaCreatedAt}
                  onChange={(e) => setMetaCreatedAt(e.target.value)}
                />
              </label>

              <label>
                Issued
                <input
                  type="date"
                  value={metaIssuedAt}
                  onChange={(e) => setMetaIssuedAt(e.target.value)}
                />
              </label>

              <label>
                Emailed
                <input
                  type="date"
                  value={metaEmailedAt}
                  onChange={(e) => setMetaEmailedAt(e.target.value)}
                />
              </label>

              <label>
                Accepted
                <input
                  type="date"
                  value={metaAcceptedAt}
                  onChange={(e) => setMetaAcceptedAt(e.target.value)}
                />
              </label>

              <button
                className="sleekButton primaryButton"
                type="button"
                onClick={saveMetaDetails}
              >
                Save Details
              </button>

              <button
                className="sleekButton ghostButton"
                type="button"
                onClick={() => setEditingMeta(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="currencyBox">
                {(existingEstimate?.status || "draft").toUpperCase()}
              </div>

              {existingEstimate && (
                <button
                  className="sleekButton ghostButton"
                  type="button"
                  onClick={() => setEditingMeta(true)}
                >
                  Edit Details
                </button>
              )}
            </>
          )}

          <h3>Estimate History</h3>

          <div className="documentTimelineMini">
            {(existingEstimate?.history || []).length === 0 ? (
              <p className="soft-text">No history yet.</p>
            ) : (
              existingEstimate.history
                .slice()
                .reverse()
                .map((event) => (
                  <div className="documentTimelineItem" key={event.id}>
                    <strong>{event.message}</strong>
                    <span>
                      {new Date(event.at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
            )}
          </div>

          <h3>Tax</h3>

          <label>
            Label
            <input value="VAT" readOnly />
          </label>

          <label>
            Rate
            <input
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              disabled={isIssued}
            />
          </label>

          {isIssued && (
            <>
              <h3>Next Actions</h3>

              <button className="sleekButton primaryButton" type="button">
                Email Estimate
              </button>

              <button className="sleekButton ghostButton" type="button">
                Mark Accepted
              </button>

              <button
                className="sleekButton ghostButton"
                type="button"
                onClick={handleCreateInvoice}
              >
                Create Invoice from {estimateNumber}
              </button>

              {job.portal?.token ? (
                <div className="currencyBox">
                  PORTAL LINK READY
                  <br />
                  <br />
                  <button
                    className="sleekButton ghostButton"
                    type="button"
                    onClick={copyPublicUrl}
                  >
                    Copy Portal Link
                  </button>
                </div>
              ) : (
                <div className="currencyBox">
                  No portal link yet.
                  <br />
                  Publish the estimate to create one.
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailsColumn({ title, details, setDetails }) {
  return (
    <section className="estimateDetailsColumn">
      <h2>{title}</h2>

      {Object.keys(details).map((key) => (
        <label key={key}>
          {key}
          <input
            value={details[key]}
            onChange={(e) =>
              setDetails((prev) => ({
                ...prev,
                [key]: e.target.value,
              }))
            }
          />
        </label>
      ))}
    </section>
  );
}

function LockedDetailsColumn({
  title,
  details,
  isEditing,
  onEdit,
  onDone,
  setDetails,
}) {
  return (
    <section className="estimateDetailsColumn">
      <div className="estimateColumnHeader">
        <h2>{title}</h2>

        {isEditing ? (
          <button className="sleekButton ghostButton" onClick={onDone}>
            Done
          </button>
        ) : (
          <button className="sleekButton ghostButton" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        Object.keys(details).map((key) => (
          <label key={key}>
            {key}
            <input
              value={details[key]}
              onChange={(e) =>
                setDetails((prev) => ({
                  ...prev,
                  [key]: e.target.value,
                }))
              }
            />
          </label>
        ))
      ) : (
        <div className="lockedDetailsBox">
          {Object.entries(details).map(([key, value]) => (
            <p key={key}>
              <span>{key}</span>
              <strong>{value || "—"}</strong>
            </p>
          ))}
        </div>
      )}
    </section>
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

function EstimatePreview({
  estimate,
  logo,
  title,
  estimateNumber,
  companyDetails,
  customerDetails,
  items,
  notes,
  subtotal,
  vatRate,
  vatAmount,
  total,
}) {
  const displayDate =
    estimate?.issuedAt || estimate?.createdAt || new Date().toISOString();

  const statusLabel = estimate?.status
    ? estimate.status.toUpperCase()
    : "DRAFT";

  return (
    <div className="estimatePreview">
      <div className="estimatePreviewHeader">
        <img src={logo} alt="JNR logo" />

        <div>
          <h1>{companyDetails.name}</h1>
          <p>{companyDetails.owner}</p>
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
          <strong>{title}</strong>
          <span>{estimateNumber}</span>
          <span>{new Date(displayDate).toLocaleDateString("en-GB")}</span>
          <span>{statusLabel}</span>
          <b>{money(total)}</b>
        </div>
      </div>

      <div className="estimatePreviewBillTo">
        <strong>TO</strong>
        <h2>{customerDetails.name}</h2>
        <p>{customerDetails.address1}</p>
        <p>{customerDetails.address2}</p>
        <p>{customerDetails.postcode}</p>
        <p>{customerDetails.phone}</p>
        <p>{customerDetails.email}</p>
      </div>

      <table className="estimatePreviewTable">
        <thead>
          <tr>
            <th>Description</th>
            <th>Rate</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
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
        <SideTotal label="Subtotal" value={money(subtotal)} />
        <SideTotal label={`VAT (${vatRate}%)`} value={money(vatAmount)} />
        <SideTotal label="Total" value={money(total)} strong />
      </div>

      <div className="estimatePreviewNotes">{notes}</div>
    </div>
  );
}

export default QuoteBuilder;

