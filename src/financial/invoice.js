import { createTimelineEvent } from "./timeline";

export function getInvoicesForEstimate(
  job,
  estimateId,
  excludeInvoiceId = null,
) {
  return (job.invoices || []).filter((invoice) => {
    const sameEstimate = String(invoice.estimateId) === String(estimateId);
    const notCurrent = String(invoice.id) !== String(excludeInvoiceId);

    // Draft invoices are not real yet, so they should not reduce the contract balance
    const countsFinancially = ["issued", "emailed", "paid"].includes(
      invoice.status,
    );

    return sameEstimate && notCurrent && countsFinancially;
  });
}

function resolveInvoiceEstimate(job, invoice) {
  return (
    invoice.sourceEstimateSnapshot ||
    (job.quotes || []).find(
      (estimate) => String(estimate.id) === String(invoice.estimateId),
    ) ||
    null
  );
}

export function calculateEstimateInvoicePosition(
  job,
  estimate,
  excludeInvoiceId = null,
) {
  if (!estimate) {
    return {
      contractTotal: 0,
      previouslyInvoiced: 0,
      previouslyPaid: 0,
      outstanding: 0,
      remainingToInvoice: 0,
    };
  }

  const linkedInvoices = getInvoicesForEstimate(
    job,
    estimate.id,
    excludeInvoiceId,
  );

  const contractTotal = Number(estimate.total || 0);

  const previouslyInvoiced = linkedInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.total || 0),
    0,
  );

  const previouslyPaid = linkedInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.paidAmount || 0),
    0,
  );

  const outstanding = linkedInvoices.reduce((sum, invoice) => {
    return (
      sum +
      Math.max(Number(invoice.total || 0) - Number(invoice.paidAmount || 0), 0)
    );
  }, 0);

  return {
    contractTotal,
    previouslyInvoiced,
    previouslyPaid,
    outstanding,
    remainingToInvoice: Math.max(contractTotal - previouslyInvoiced, 0),
  };
}

export function calculateInvoiceTotals({
  amountMode = "remaining",
  percentage = 100,
  fixedGross = 0,
  remainingToInvoice = 0,
  vatRate = 20,
}) {
  let total = Number(remainingToInvoice || 0);

  if (amountMode === "percentage") {
    total = Number(remainingToInvoice || 0) * (Number(percentage || 0) / 100);
  }

  if (amountMode === "fixed") {
    total = Number(fixedGross || 0);
  }

  const divisor = 1 + Number(vatRate || 0) / 100;
  const subtotal = total / divisor;
  const vatAmount = total - subtotal;

  return {
    subtotal,
    vatAmount,
    total,
  };
}

export function createInvoiceFromEstimate({
  job,
  estimate,
  invoiceType = "deposit",
  amountMode = "remaining",
  percentage = 100,
  fixedGross = 0,
}) {
  const now = new Date().toISOString();
  const vatRate = Number(estimate.vatRate || 20);
  const position = calculateEstimateInvoicePosition(job, estimate);

  const totals = calculateInvoiceTotals({
    amountMode,
    percentage,
    fixedGross,
    remainingToInvoice: position.remainingToInvoice,
    vatRate,
  });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    documentType: "invoice",
    type: "invoice",

    invoiceType,
    title: "Invoice",
    status: "draft",

    number: "",
    invoiceNumber: "",

    estimateId: estimate.id,
    estimateNumber: estimate.number || estimate.quoteNumber || "",
    sourceEstimateSnapshot: estimate,

    createdAt: now,
    updatedAt: now,
    invoiceDate: now,
    issuedAt: null,
    emailedAt: null,
    paidAt: null,

    jobSnapshot: {
      id: job.id,
      name: job.name,
      address: job.address,
      status: job.status,
    },

    companySnapshot: estimate.companySnapshot || estimate.fromSnapshot,
    customerSnapshot: estimate.customerSnapshot,

    items: estimate.items || [],
    notes: "",

    amountMode,
    percentage: Number(percentage || 100),
    fixedGross: Number(fixedGross || 0),

    contractTotal: position.contractTotal,
    previouslyInvoiced: position.previouslyInvoiced,
    previouslyPaid: position.previouslyPaid,
    previousOutstanding: position.outstanding,
    remainingBeforeThisInvoice: position.remainingToInvoice,

    vatRate,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,

    paidAmount: 0,
    remainingAmount: totals.total,

    history: [
      createTimelineEvent(
        "invoice_created",
        `Invoice created from estimate ${estimate.number || estimate.quoteNumber || ""}`,
      ),
    ],
  };
}

export function createStandaloneInvoice({
  job,
  invoiceType = "custom",
  title = "Standalone Invoice",
  amountMode = "fixed",
  fixedGross = 0,
  vatRate = 20,
}) {
  const now = new Date().toISOString();

  const totals = calculateInvoiceTotals({
    amountMode,
    fixedGross,
    remainingToInvoice: Number(fixedGross || 0),
    vatRate,
  });

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    documentType: "invoice",
    type: "invoice",

    isStandalone: true,

    invoiceType,
    title,
    status: "draft",

    number: "",
    invoiceNumber: "",

    estimateId: null,
    estimateNumber: "",
    sourceEstimateSnapshot: null,

    createdAt: now,
    updatedAt: now,
    invoiceDate: now,
    issuedAt: null,
    emailedAt: null,
    paidAt: null,

    jobSnapshot: {
      id: job.id,
      name: job.name,
      address: job.address,
      status: job.status,
    },

    companySnapshot: job.companySnapshot || null,
    customerSnapshot: job.customerDetails || {},

    items: [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: title,
        details: "",
        rate: Number(fixedGross || 0),
        qty: 1,
        vat: true,
      },
    ],

    notes: "",

    amountMode,
    percentage: 100,
    fixedGross: Number(fixedGross || 0),

    contractTotal: 0,
    previouslyInvoiced: 0,
    previouslyPaid: 0,
    previousOutstanding: 0,
    remainingBeforeThisInvoice: 0,

    vatRate,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,

    paidAmount: 0,
    remainingAmount: totals.total,

    history: [
      createTimelineEvent("invoice_created", "Standalone invoice created"),
    ],
  };
}

export function updateInvoiceDraft(job, invoice, updates = {}) {
  const estimate = resolveInvoiceEstimate(job, invoice);

  if (!estimate) {
    return {
      ...invoice,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  }
  const next = {
    ...invoice,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const position = calculateEstimateInvoicePosition(job, estimate, invoice.id);

  const totals = calculateInvoiceTotals({
    amountMode: next.amountMode,
    percentage: next.percentage,
    fixedGross: next.fixedGross,
    remainingToInvoice: position.remainingToInvoice,
    vatRate: next.vatRate,
  });

  return {
    ...next,

    contractTotal: position.contractTotal,
    previouslyInvoiced: position.previouslyInvoiced,
    previouslyPaid: position.previouslyPaid,
    previousOutstanding: position.outstanding,
    remainingBeforeThisInvoice: position.remainingToInvoice,

    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
    remainingAmount: Math.max(totals.total - Number(next.paidAmount || 0), 0),

    history: [
      ...(invoice.history || []),
      createTimelineEvent("invoice_edited", "Invoice edited"),
    ],
  };
}

export function issueInvoice(invoice, invoiceNumber) {
  const now = new Date().toISOString();

  return {
    ...invoice,
    status: "issued",
    invoiceNumber,
    number: invoiceNumber,
    issuedAt: invoice.issuedAt || now,
    updatedAt: now,
    history: [
      ...(invoice.history || []),
      createTimelineEvent(
        "invoice_issued",
        `Invoice issued as ${invoiceNumber}`,
      ),
    ],
  };
}

export function markInvoicePaid(
  invoice,
  paidDate,
  paidAmount,
  method = "Bank transfer",
) {
  const amount = Number(paidAmount || invoice.total || 0);
  const paidAt = paidDate
    ? new Date(`${paidDate}T09:00:00`).toISOString()
    : new Date().toISOString();

  return {
    ...invoice,
    status: "paid",
    paidAt,
    paidAmount: amount,
    paymentMethod: method,
    remainingAmount: Math.max(Number(invoice.total || 0) - amount, 0),
    updatedAt: new Date().toISOString(),
    history: [
      ...(invoice.history || []),
      createTimelineEvent(
        "invoice_paid",
        `Invoice marked paid: £${amount.toFixed(2)}`,
      ),
    ],
  };
}

