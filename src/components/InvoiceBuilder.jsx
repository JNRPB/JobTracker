import { useMemo, useState } from "react";
import logo from "../assets/logo.png";

import "./FinancialDocuments.css";

import {
  issueInvoice,
  markInvoicePaid,
  updateInvoiceDraft,
} from "../financial/invoice";

import { upsertInvoiceOnJob } from "../financial/jobFinancials";

const API_BASE = "";

const DEFAULT_INVOICE_FOOTNOTE = `Thank you for choosing JNR Plastering & Building.

Please Make Payment To The Following:

Name: JNR Plastering and Building

Bank: Monzo Bank

Account number: 80626284

Sort code: 04-00-03

VAT Number: 513996856
UTR Number: 7687755422
NI Number: JS280884A

Thankyou.`;

function money(value) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDateInput(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function fromDateInput(value) {
  if (!value) return null;
  return new Date(`${value}T09:00:00`).toISOString();
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function createHistoryEvent(type, message) {
  return {
    id: makeId(),
    type,
    message,
    at: new Date().toISOString(),
  };
}

function buildPublicInvoiceUrl(publicToken) {
  if (!publicToken) return "";
  return `${window.location.origin}/job-tracker/invoice/${publicToken}`;
}

function getFileName(file) {
  return file.fileName || file.name || "Attached file";
}

function getFileUrl(file) {
  if (!file.url) return "";
  return `${API_BASE}${file.url}`;
}

function isImageFile(file) {
  const name = getFileName(file).toLowerCase();
  const mime = file.mimeType || file.mimetype || "";

  return (
    mime.startsWith("image/") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

function normaliseItems(items = [], fallbackTitle = "Invoice item") {
  if (!Array.isArray(items) || items.length === 0) {
    return [
      {
        id: makeId(),
        description: fallbackTitle,
        details: "",
        rate: 0,
        qty: 1,
        vat: true,
      },
    ];
  }

  return items.map((item) => ({
    id: item.id || makeId(),
    description: item.description || fallbackTitle,
    details: item.details || "",
    rate: Number(item.rate || 0),
    qty: Number(item.qty || 1),
    vat: item.vat !== false,
  }));
}

function calculateItemTotals(items = [], vatRate = 20) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.rate || 0) * Number(item.qty || 0),
    0,
  );

  const vatAmount = items.reduce((sum, item) => {
    if (!item.vat) return sum;

    return (
      sum +
      Number(item.rate || 0) *
        Number(item.qty || 0) *
        (Number(vatRate || 0) / 100)
    );
  }, 0);

  return {
    subtotal,
    vatAmount,
    total: subtotal + vatAmount,
  };
}

function calculateGrossTotals(gross, vatRate) {
  const total = Number(gross || 0);
  const divisor = 1 + Number(vatRate || 0) / 100;

  return {
    subtotal: total / divisor,
    vatAmount: total - total / divisor,
    total,
  };
}

function getLinkedInvoices(job, invoice) {
  return (job.invoices || [])
    .filter(
      (item) =>
        String(item.estimateId) === String(invoice.estimateId) &&
        String(item.id) !== String(invoice.id) &&
        ["issued", "emailed", "paid"].includes(item.status),
    )
    .sort(
      (a, b) =>
        new Date(a.invoiceDate || a.createdAt) -
        new Date(b.invoiceDate || b.createdAt),
    );
}

function getCustomerSnapshot(job, invoice) {
  const customer = invoice?.customerSnapshot || job?.customerDetails || {};

  return {
    name: customer.name || "",
    email: customer.email || "",
    address1: customer.address1 || customer.address || job?.address || "",
    address2: customer.address2 || "",
    postcode: customer.postcode || "",
    phone: customer.phone || "",
    mobile: customer.mobile || customer.phone || "",
  };
}

function getJobFiles(files = [], job) {
  if (!job) return [];

  return files.filter((file) => {
    const links = Array.isArray(file.links) ? file.links : [];

    return links.some(
      (link) =>
        link.targetType === "job" && String(link.targetId) === String(job.id),
    );
  });
}

function InvoiceBuilder({ navData, jobs, files = [], navigate, onUpdate }) {
  const job = useMemo(
    () => jobs.find((j) => String(j.id) === String(navData?.jobId)),
    [jobs, navData],
  );

  const invoice = useMemo(() => {
    if (!job || !navData?.invoiceId) return null;

    return (job.invoices || []).find(
      (item) => String(item.id) === String(navData.invoiceId),
    );
  }, [job, navData]);

  const estimate = useMemo(() => {
    if (!job || !invoice) return null;

    return (
      invoice.sourceEstimateSnapshot ||
      (job.quotes || []).find(
        (item) => String(item.id) === String(invoice.estimateId),
      ) ||
      null
    );
  }, [job, invoice]);

  const isStandalone = Boolean(invoice?.isStandalone);

  const jobFiles = useMemo(() => {
    if (!job) return [];
    return getJobFiles(files, job);
  }, [files, job]);

  const [mode, setMode] = useState(
    ["issued", "emailed", "paid"].includes(invoice?.status)
      ? "preview"
      : "edit",
  );

  const [lightboxFile, setLightboxFile] = useState(null);
  const [editingFromDetails, setEditingFromDetails] = useState(false);
  const [editingMeta, setEditingMeta] = useState(false);

  const [invoiceType, setInvoiceType] = useState(
    invoice?.invoiceType || "deposit",
  );
  const [amountMode, setAmountMode] = useState(
    invoice?.amountMode || (isStandalone ? "items" : "remaining"),
  );
  const [percentage, setPercentage] = useState(invoice?.percentage || 100);
  const [fixedGross, setFixedGross] = useState(
    invoice?.fixedGross || invoice?.total || 0,
  );
  const [vatRate, setVatRate] = useState(invoice?.vatRate || 20);
  const [invoiceDate, setInvoiceDate] = useState(
    toDateInput(invoice?.invoiceDate || invoice?.createdAt),
  );

  const [isCashInvoice, setIsCashInvoice] = useState(
    Boolean(invoice?.isCashInvoice),
  );

  const [metaStatus, setMetaStatus] = useState(invoice?.status || "draft");
  const [metaNumber, setMetaNumber] = useState(
    invoice?.invoiceNumber || invoice?.number || "",
  );
  const [metaCreatedAt, setMetaCreatedAt] = useState(
    toDateInput(invoice?.createdAt),
  );
  const [metaInvoiceDate, setMetaInvoiceDate] = useState(
    toDateInput(invoice?.invoiceDate),
  );
  const [metaIssuedAt, setMetaIssuedAt] = useState(
    toDateInput(invoice?.issuedAt),
  );
  const [metaEmailedAt, setMetaEmailedAt] = useState(
    toDateInput(invoice?.emailedAt),
  );
  const [metaPaidAt, setMetaPaidAt] = useState(toDateInput(invoice?.paidAt));

  const [companyDetails, setCompanyDetails] = useState(
    invoice?.companySnapshot ||
      invoice?.fromSnapshot ||
      estimate?.companySnapshot ||
      estimate?.fromSnapshot || {
        name: "JNR Plastering & Building Ltd",
        owner: "Joshua Roberton",
        email: "info@jnrplasteringandbuilding.com",
        phone: "07954 567976",
        address1: "19 Sherwood Drive",
        address2: "Melton Mowbray",
        postcode: "LE13 0LL",
        vatNumber: "",
        companyNumber: "",
      },
  );

  const [customerDetails, setCustomerDetails] = useState(
    getCustomerSnapshot(job, invoice),
  );

  const [lineItems, setLineItems] = useState(() => {
    if (invoice?.items?.length) return normaliseItems(invoice.items);
    if (isStandalone) return normaliseItems([], "");
    return normaliseItems(estimate?.items || [], "Invoice item");
  });

  const [footnote, setFootnote] = useState(
    invoice?.footnote || DEFAULT_INVOICE_FOOTNOTE,
  );

  const [attachments, setAttachments] = useState(invoice?.attachments || []);

  const [paidDate, setPaidDate] = useState(
    toDateInput(invoice?.paidAt) || new Date().toISOString().slice(0, 10),
  );
  const [paidAmount, setPaidAmount] = useState(invoice?.paidAmount || 0);
  const [paymentMethod, setPaymentMethod] = useState(
    invoice?.paymentMethod || "Bank transfer",
  );

  if (!job || !invoice) {
    return (
      <div className="bubbleBox">
        <h1>Invoice Builder</h1>
        <h2>{!job ? "Job not found" : "Invoice not found"}</h2>
      </div>
    );
  }

  if (!estimate && !isStandalone) {
    return (
      <div className="bubbleBox">
        <h1>Invoice Builder</h1>
        <h2>Linked estimate not found</h2>
        <button
          className="sleekButton ghostButton"
          type="button"
          onClick={() => navigate("JobDocuments", { jobId: job.id })}
        >
          Back to Documents
        </button>
      </div>
    );
  }

  const isIssued = ["issued", "emailed", "paid"].includes(invoice.status);

  const itemTotals = calculateItemTotals(lineItems, vatRate);
  const grossTotals = calculateGrossTotals(fixedGross, vatRate);

  let workingInvoice = isStandalone
    ? {
        ...invoice,
        isStandalone: true,
        isCashInvoice,
        invoiceType,
        amountMode: "items",
        companySnapshot: companyDetails,
        fromSnapshot: companyDetails,
        customerSnapshot: customerDetails,
        vatRate: Number(vatRate || 0),
        invoiceDate: fromDateInput(invoiceDate),
        items: lineItems,
        footnote,
        attachments,
        subtotal: itemTotals.subtotal,
        vatAmount: itemTotals.vatAmount,
        total: itemTotals.total,
        fixedGross: itemTotals.total,
        remainingAmount: Math.max(
          itemTotals.total - Number(invoice.paidAmount || 0),
          0,
        ),
      }
    : updateInvoiceDraft(job, invoice, {
        invoiceType,
        amountMode,
        percentage: Number(percentage || 0),
        fixedGross: Number(fixedGross || 0),
        vatRate: Number(vatRate || 0),
        invoiceDate: fromDateInput(invoiceDate),
        companySnapshot: companyDetails,
        fromSnapshot: companyDetails,
        customerSnapshot: customerDetails,
        items: lineItems,
        footnote,
        attachments,
        isCashInvoice,
      });

  workingInvoice = {
    ...workingInvoice,
    isCashInvoice,
  };

  if (amountMode === "items" && !isStandalone) {
    workingInvoice = {
      ...workingInvoice,
      items: lineItems,
      footnote,
      attachments,
      isCashInvoice,
      subtotal: itemTotals.subtotal,
      vatAmount: itemTotals.vatAmount,
      total: itemTotals.total,
      fixedGross: itemTotals.total,
      remainingAmount: Math.max(
        itemTotals.total - Number(invoice.paidAmount || 0),
        0,
      ),
    };
  }

  if (amountMode === "fixed" && !isStandalone) {
    workingInvoice = {
      ...workingInvoice,
      footnote,
      attachments,
      isCashInvoice,
      subtotal: grossTotals.subtotal,
      vatAmount: grossTotals.vatAmount,
      total: grossTotals.total,
      fixedGross: grossTotals.total,
      remainingAmount: Math.max(
        grossTotals.total - Number(invoice.paidAmount || 0),
        0,
      ),
    };
  }

  const previousInvoices = isStandalone ? [] : getLinkedInvoices(job, invoice);

  const remainingAfterThisInvoice = isStandalone
    ? 0
    : Math.max(
        Number(workingInvoice.remainingBeforeThisInvoice || 0) -
          Number(workingInvoice.total || 0),
        0,
      );

  const publicInvoiceUrl = buildPublicInvoiceUrl(invoice.publicToken);

  function updateLineItem(id, field, value) {
    if (isIssued) return;

    setLineItems((prev) =>
      prev.map((item) =>
        String(item.id) === String(id) ? { ...item, [field]: value } : item,
      ),
    );

    setAmountMode("items");
  }

  function addLineItem() {
    if (isIssued) return;

    setLineItems((prev) => [
      ...prev,
      {
        id: makeId(),
        description: "",
        details: "",
        rate: 0,
        qty: 1,
        vat: true,
      },
    ]);

    setAmountMode("items");
  }

  function deleteLineItem(id) {
    if (isIssued) return;

    setLineItems((prev) =>
      prev.filter((item) => String(item.id) !== String(id)),
    );

    setAmountMode("items");
  }

  function toggleAttachment(file) {
    const fileId = file.id || file.fileId || file.filename || getFileUrl(file);

    const exists = attachments.some(
      (attachment) => String(attachment.id) === String(fileId),
    );

    if (exists) {
      setAttachments((prev) =>
        prev.filter((attachment) => String(attachment.id) !== String(fileId)),
      );
      return;
    }

    setAttachments((prev) => [
      ...prev,
      {
        id: fileId,
        name: getFileName(file),
        url: getFileUrl(file),
        mimeType: file.mimeType || file.mimetype || "",
        isImage: isImageFile(file),
      },
    ]);
  }

  async function saveInvoice() {
    const updatedJob = upsertInvoiceOnJob(job, workingInvoice);
    await onUpdate(updatedJob);
    navigate("JobDocuments", { jobId: job.id });
  }

  async function getNextInvoiceNumber() {
    const res = await fetch(
      `${API_BASE}/api/business-settings/next-invoice-number`,
      { method: "POST" },
    );

    const data = await res.json();
    return data.invoiceNumber;
  }

  async function handleIssueInvoice() {
    const number = invoice.invoiceNumber || (await getNextInvoiceNumber());

    const invoiceToIssue = {
      ...issueInvoice(workingInvoice, number),

      publicToken: workingInvoice.publicToken || crypto.randomUUID(),
      viewCount: workingInvoice.viewCount || 0,
      firstViewedAt: workingInvoice.firstViewedAt || null,
      lastViewedAt: workingInvoice.lastViewedAt || null,
      sentAt: workingInvoice.sentAt || null,
    };

    const updatedJob = upsertInvoiceOnJob(job, invoiceToIssue);

    await onUpdate(updatedJob);
    navigate("JobDocuments", { jobId: job.id });
  }

  async function handleIssueToken() {
    if (!invoice) return;
    if (invoice.publicToken) return;

    const updatedInvoice = {
      ...workingInvoice,
      publicToken: crypto.randomUUID(),
      viewCount: 0,
      firstViewedAt: null,
      lastViewedAt: null,
      sentAt: null,
      history: [
        ...(workingInvoice.history || []),
        createHistoryEvent(
          "invoice_token_issued",
          "Public invoice token issued",
        ),
      ],
    };

    const updatedJob = upsertInvoiceOnJob(job, updatedInvoice);

    await onUpdate(updatedJob);

    navigate("InvoiceBuilder", {
      jobId: job.id,
      invoiceId: invoice.id,
    });
  }

  async function copyPublicUrl() {
    if (!publicInvoiceUrl) return;

    try {
      await navigator.clipboard.writeText(publicInvoiceUrl);
      alert("Invoice link copied.");
    } catch (err) {
      console.error("Could not copy invoice link:", err);
      alert(publicInvoiceUrl);
    }
  }

  async function handleMarkPaid() {
    const paidInvoice = markInvoicePaid(
      workingInvoice,
      paidDate,
      paidAmount || workingInvoice.total,
      paymentMethod,
    );

    const updatedJob = upsertInvoiceOnJob(job, paidInvoice);

    await onUpdate(updatedJob);
    navigate("JobDocuments", { jobId: job.id });
  }

  async function saveMetaDetails() {
    const updatedInvoice = {
      ...workingInvoice,
      isCashInvoice,
      status: metaStatus,
      number: metaNumber,
      invoiceNumber: metaNumber,
      createdAt: fromDateInput(metaCreatedAt) || workingInvoice.createdAt,
      invoiceDate: fromDateInput(metaInvoiceDate) || workingInvoice.invoiceDate,
      issuedAt: fromDateInput(metaIssuedAt),
      emailedAt: fromDateInput(metaEmailedAt),
      paidAt: fromDateInput(metaPaidAt),
      updatedAt: new Date().toISOString(),
      history: [
        ...(workingInvoice.history || []),
        createHistoryEvent("invoice_meta_edited", "Invoice details edited"),
      ],
    };

    if (metaStatus === "paid") {
      updatedInvoice.paidAmount = Number(
        updatedInvoice.paidAmount || updatedInvoice.total || 0,
      );
      updatedInvoice.remainingAmount = Math.max(
        Number(updatedInvoice.total || 0) -
          Number(updatedInvoice.paidAmount || updatedInvoice.total || 0),
        0,
      );
    }

    const updatedJob = upsertInvoiceOnJob(job, updatedInvoice);

    await onUpdate(updatedJob);

    setEditingMeta(false);

    navigate("InvoiceBuilder", {
      jobId: job.id,
      invoiceId: invoice.id,
    });
  }

  return (
    <div className="estimatePage">
      {lightboxFile && (
        <FileLightbox
          file={lightboxFile}
          onClose={() => setLightboxFile(null)}
        />
      )}

      <div className="estimateTopbar">
        <button
          className="sleekButton ghostButton"
          onClick={() => navigate("JobDocuments", { jobId: job.id })}
          type="button"
        >
          ← Back to Documents
        </button>

        <div className="invoiceBuilderTitle">
          <h1>{workingInvoice.invoiceNumber || "Draft Invoice"}</h1>
          <p>
            {job.name} · {job.address}
          </p>
        </div>

        <div className="estimateTopActions">
          <button
            className="sleekButton ghostButton"
            onClick={() => setMode(mode === "preview" ? "edit" : "preview")}
            type="button"
          >
            {mode === "preview" ? "Edit" : "Preview"}
          </button>

          {!isIssued && (
            <>
              <button
                className="sleekButton ghostButton"
                type="button"
                onClick={saveInvoice}
              >
                Save Invoice
              </button>

              <button
                className="sleekButton primaryButton"
                type="button"
                onClick={handleIssueInvoice}
              >
                Issue Invoice
              </button>
            </>
          )}
        </div>
      </div>

      <div className="estimateLayout">
        <main className="estimateCanvas">
          {mode === "preview" || isIssued ? (
            <InvoicePreview
              logo={logo}
              invoice={workingInvoice}
              isStandalone={isStandalone}
              companyDetails={companyDetails}
              customerDetails={customerDetails}
              items={lineItems}
              previousInvoices={previousInvoices}
              remainingAfterThisInvoice={remainingAfterThisInvoice}
              onOpenAttachment={setLightboxFile}
            />
          ) : (
            <>
              <div className="estimateHeaderBlock">
                <input
                  className="estimateTitleInput"
                  value="Invoice"
                  readOnly
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
                  <input
                    value={workingInvoice.invoiceNumber || "Draft"}
                    readOnly
                  />
                </label>

                <label>
                  Date
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    disabled={isIssued}
                  />
                </label>
              </div>

              <label className="estimateNotes">
                <input
                  type="checkbox"
                  checked={isCashInvoice}
                  onChange={(e) => {
                    setIsCashInvoice(e.target.checked);
                    if (e.target.checked) setPaymentMethod("Cash");
                  }}
                  disabled={isIssued}
                />
                Mark this as a Cash Invoice
              </label>

              <div className="estimateItemsHeader">
                <span>Description</span>
                <span>Rate</span>
                <span>Qty</span>
                <span>Amount</span>
                <span>VAT</span>
              </div>

              {lineItems.map((item) => {
                const amount = Number(item.rate || 0) * Number(item.qty || 0);

                return (
                  <div className="estimateItemRow" key={item.id}>
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={() => deleteLineItem(item.id)}
                    >
                      ×
                    </button>

                    <div>
                      <input
                        value={item.description}
                        onChange={(e) =>
                          updateLineItem(item.id, "description", e.target.value)
                        }
                        placeholder="Description"
                      />

                      <textarea
                        value={item.details}
                        onChange={(e) =>
                          updateLineItem(item.id, "details", e.target.value)
                        }
                        placeholder="Detailed scope..."
                      />
                    </div>

                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) =>
                        updateLineItem(item.id, "rate", e.target.value)
                      }
                    />

                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) =>
                        updateLineItem(item.id, "qty", e.target.value)
                      }
                    />

                    <strong>{money(amount)}</strong>

                    <input
                      type="checkbox"
                      checked={item.vat}
                      onChange={(e) =>
                        updateLineItem(item.id, "vat", e.target.checked)
                      }
                    />
                  </div>
                );
              })}

              <button
                type="button"
                className="sleekButton ghostButton estimateAddButton"
                onClick={addLineItem}
              >
                +
              </button>

              {!isStandalone && (
                <div className="estimateTotals">
                  <SideTotal
                    label="Contract value"
                    value={money(workingInvoice.contractTotal)}
                  />
                  <SideTotal
                    label="Previously invoiced"
                    value={money(workingInvoice.previouslyInvoiced)}
                  />
                  <SideTotal
                    label="This invoice"
                    value={money(workingInvoice.total)}
                    strong
                  />
                  <SideTotal
                    label="Remaining after this"
                    value={money(remainingAfterThisInvoice)}
                  />
                </div>
              )}

              <div className="estimateTotals">
                <SideTotal label="Net" value={money(workingInvoice.subtotal)} />
                <SideTotal
                  label={`VAT (${workingInvoice.vatRate}%)`}
                  value={money(workingInvoice.vatAmount)}
                />
                <SideTotal
                  label="Amount Due"
                  value={money(workingInvoice.total)}
                  strong
                />
              </div>

              <label className="estimateNotes">
                Footnote / Payment Details
                <textarea
                  value={footnote}
                  onChange={(e) => setFootnote(e.target.value)}
                  placeholder="Please make payment to... / Waste ticket notes / any invoice footer text"
                />
              </label>

              <section className="invoiceAttachmentsEditor">
                <h3>Attach Job Files</h3>

                {jobFiles.length === 0 ? (
                  <p className="soft-text">No files found for this job.</p>
                ) : (
                  <div className="invoiceAttachmentPicker">
                    {jobFiles.map((file) => {
                      const fileId =
                        file.id ||
                        file.fileId ||
                        file.filename ||
                        getFileUrl(file);

                      const selected = attachments.some(
                        (attachment) =>
                          String(attachment.id) === String(fileId),
                      );

                      return (
                        <button
                          type="button"
                          key={fileId}
                          className={`invoiceAttachmentChoice ${
                            selected ? "selected" : ""
                          }`}
                          onClick={() => toggleAttachment(file)}
                          title={getFileName(file)}
                        >
                          <div className="attachmentThumb">
                            {isImageFile(file) ? (
                              <img
                                src={getFileUrl(file)}
                                alt={getFileName(file)}
                              />
                            ) : (
                              <div className="attachmentFileIcon">📄</div>
                            )}

                            {selected && (
                              <div className="attachmentSelectedTick">✓</div>
                            )}
                          </div>

                          <strong>{file.supplier || getFileName(file)}</strong>

                          <small>
                            {file.purchaseDate || file.dateSorted || "No date"}
                          </small>

                          <small>
                            {(file.links || [])
                              .map((link) => link.tag || link.category)
                              .filter(Boolean)
                              .join(" · ") || "No tag"}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
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
                  <option value="paid">Paid</option>
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
                Invoice Date
                <input
                  type="date"
                  value={metaInvoiceDate}
                  onChange={(e) => setMetaInvoiceDate(e.target.value)}
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
                Paid
                <input
                  type="date"
                  value={metaPaidAt}
                  onChange={(e) => setMetaPaidAt(e.target.value)}
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
                {(workingInvoice.status || "draft").toUpperCase()}
                {workingInvoice.isCashInvoice && (
                  <>
                    <br />
                    CASH INVOICE
                  </>
                )}
              </div>

              <button
                className="sleekButton ghostButton"
                type="button"
                onClick={() => setEditingMeta(true)}
              >
                Edit Details
              </button>
            </>
          )}

          <h3>Invoice Details</h3>

          <label>
            Type
            <select
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value)}
              disabled={isIssued}
            >
              <option value="deposit">Deposit</option>
              <option value="stage">Stage</option>
              <option value="final">Final</option>
              <option value="waste">Waste Runs</option>
              <option value="materials">Materials</option>
              <option value="variation">Variation / Extra Works</option>
              <option value="labour">Labour</option>
              <option value="custom">Custom</option>
            </select>
          </label>

          <label>
            <input
              type="checkbox"
              checked={isCashInvoice}
              onChange={(e) => {
                setIsCashInvoice(e.target.checked);
                if (e.target.checked) setPaymentMethod("Cash");
              }}
              disabled={isIssued}
            />
            Cash Invoice
          </label>

          <label>
            Amount Source
            <select
              value={amountMode}
              onChange={(e) => setAmountMode(e.target.value)}
              disabled={isIssued}
            >
              <option value="items">Use line items</option>

              {!isStandalone && (
                <>
                  <option value="remaining">Remaining contract</option>
                  <option value="percentage">Percentage of remaining</option>
                  <option value="fixed">Fixed gross amount</option>
                </>
              )}
            </select>
          </label>

          {amountMode === "percentage" && !isStandalone && (
            <label>
              Percentage
              <input
                type="number"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                disabled={isIssued}
              />
            </label>
          )}

          {amountMode === "fixed" && !isStandalone && (
            <label>
              Fixed Gross
              <input
                type="number"
                value={fixedGross}
                onChange={(e) => setFixedGross(e.target.value)}
                disabled={isIssued}
              />
            </label>
          )}

          {!isStandalone && (
            <>
              <h3>Contract Position</h3>

              <div className="currencyBox">
                Contract: {money(workingInvoice.contractTotal)}
                <br />
                Previously invoiced: {money(workingInvoice.previouslyInvoiced)}
                <br />
                This invoice: {money(workingInvoice.total)}
                <br />
                Remaining after: {money(remainingAfterThisInvoice)}
              </div>
            </>
          )}

          <h3>VAT</h3>

          <label>
            VAT %
            <input
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              disabled={isIssued}
            />
          </label>

          <div className="currencyBox">
            Net: {money(workingInvoice.subtotal)}
            <br />
            VAT: {money(workingInvoice.vatAmount)}
            <br />
            Total: {money(workingInvoice.total)}
          </div>

          {!isStandalone && (
            <>
              <h3>Created From</h3>

              <button
                className="sleekButton ghostButton"
                type="button"
                onClick={() =>
                  navigate("QuoteBuilder", {
                    jobId: job.id,
                    quoteId: invoice.estimateId,
                  })
                }
              >
                Estimate {invoice.estimateNumber}
              </button>
            </>
          )}

          <h3>Client Link</h3>

          {invoice.publicToken ? (
            <div className="currencyBox">
              TOKEN ISSUED
              <br />
              Views: {invoice.viewCount || 0}
              <br />
              {invoice.lastViewedAt
                ? `Last viewed: ${new Date(invoice.lastViewedAt).toLocaleString(
                    "en-GB",
                  )}`
                : "Not viewed yet"}
              <br />
              <br />
              <button
                className="sleekButton ghostButton"
                type="button"
                onClick={copyPublicUrl}
              >
                Copy Link
              </button>
            </div>
          ) : (
            <button
              className="sleekButton ghostButton"
              type="button"
              onClick={handleIssueToken}
            >
              Issue Token
            </button>
          )}

          <h3>Payment</h3>

          <label>
            Paid Date
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
            />
          </label>

          <label>
            Paid Amount
            <input
              type="number"
              value={paidAmount || workingInvoice.total}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
          </label>

          <label>
            Method
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="Bank transfer">Bank transfer</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Cheque">Cheque</option>
            </select>
          </label>

          <button
            className="sleekButton primaryButton"
            type="button"
            onClick={handleMarkPaid}
          >
            Mark as Paid
          </button>

          <h3>History</h3>

          <div className="documentTimelineMini">
            {(workingInvoice.history || []).map((event) => (
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
            ))}
          </div>
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

function InvoicePreview({
  logo,
  invoice,
  isStandalone,
  companyDetails,
  customerDetails,
  items,
  previousInvoices,
  remainingAfterThisInvoice,
  onOpenAttachment,
}) {
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
          <strong>Invoice</strong>
          <span>{invoice.invoiceNumber || "DRAFT"}</span>
          <span>{formatDate(invoice.invoiceDate || invoice.createdAt)}</span>
          <span>{(invoice.status || "draft").toUpperCase()}</span>

          {invoice.isCashInvoice && (
            <div className="invoiceAmountDueBox">
              <span>Invoice Type</span>
              <strong>CASH INVOICE</strong>
            </div>
          )}

          <div className="invoiceAmountDueBox">
            <span>Amount due</span>
            <strong>{money(invoice.total)}</strong>
          </div>
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

      {invoice.isCashInvoice && (
        <div className="estimatePreviewNotes">
          <strong>CASH INVOICE</strong>
          <br />
          This invoice has been marked as a cash invoice.
        </div>
      )}

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
        {!isStandalone && (
          <>
            <SideTotal
              label="Contract value"
              value={money(invoice.contractTotal)}
            />

            {previousInvoices.map((previousInvoice) => (
              <div
                className="estimateTotalRow previousPaymentRow"
                key={previousInvoice.id}
              >
                <span>
                  Previously invoiced
                  <small>
                    {previousInvoice.paidAt
                      ? `Paid on ${formatDate(previousInvoice.paidAt)}`
                      : previousInvoice.invoiceDate
                        ? `Issued on ${formatDate(previousInvoice.invoiceDate)}`
                        : "Not paid yet"}
                  </small>
                </span>

                <strong>-{money(previousInvoice.total)}</strong>
              </div>
            ))}

            <SideTotal label="This invoice" value={money(invoice.total)} />
            <SideTotal
              label="Remaining after this"
              value={money(remainingAfterThisInvoice)}
            />

            <hr />
          </>
        )}

        <SideTotal label="Net" value={money(invoice.subtotal)} />
        <SideTotal
          label={`VAT (${invoice.vatRate}%)`}
          value={money(invoice.vatAmount)}
        />
        <SideTotal label="Amount Due" value={money(invoice.total)} strong />
      </div>

      {invoice.footnote && (
        <div className="estimatePreviewNotes">{invoice.footnote}</div>
      )}

      {(invoice.attachments || []).length > 0 && (
        <section className="invoicePreviewAttachments">
          <h3>Attached Documents</h3>

          <div className="invoiceAttachmentList">
            {invoice.attachments.map((attachment) => (
              <button
                type="button"
                className={`invoiceAttachmentPreviewRow ${
                  attachment.isImage ? "imageAttachment" : ""
                }`}
                key={attachment.id}
                onClick={() => onOpenAttachment(attachment)}
              >
                <div className="attachmentPreviewThumb">
                  {attachment.isImage ? (
                    <img src={attachment.url} alt={attachment.name} />
                  ) : (
                    <span>PDF</span>
                  )}
                </div>

                <div>
                  <strong>{attachment.name}</strong>
                  <small>Click to view full document</small>
                </div>

                <span className="attachmentOpenText">Open →</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {invoice.paidAt && (
        <div className="estimatePreviewNotes">
          Payment received: {money(invoice.paidAmount)} on{" "}
          {formatDate(invoice.paidAt)} by{" "}
          {invoice.paymentMethod || "Bank transfer"}.
        </div>
      )}
    </div>
  );
}

function FileLightbox({ file, onClose }) {
  return (
    <div className="fileLightboxBackdrop" onClick={onClose}>
      <div className="fileLightbox" onClick={(e) => e.stopPropagation()}>
        <div className="fileLightboxHeader">
          <strong>{file.name}</strong>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>

        {file.isImage ? (
          <img src={file.url} alt={file.name} />
        ) : (
          <iframe src={file.url} title={file.name} />
        )}
      </div>
    </div>
  );
}

export default InvoiceBuilder;

