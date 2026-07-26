import { createTimelineEvent, sortTimelineNewestFirst } from "./timeline";

export function upsertEstimateOnJob(job, estimate) {
  const existingEstimates = job.quotes || [];

  const estimateExists = existingEstimates.some(
    (item) => String(item.id) === String(estimate.id),
  );

  const nextEstimates = estimateExists
    ? existingEstimates.map((item) =>
        String(item.id) === String(estimate.id) ? estimate : item,
      )
    : [...existingEstimates, estimate];

  const shouldSetActiveEstimate = estimate.isActive === true;

  return {
    ...job,
    quoteTotal: Number(estimate.total || job.quoteTotal || 0),
    activeEstimateId: shouldSetActiveEstimate
      ? estimate.id
      : job.activeEstimateId,
    quotes: nextEstimates,
    timeline: [
      ...(job.timeline || []),
      createTimelineEvent(
        `estimate_${estimate.status}`,
        `${estimate.title || "Estimate"} ${
          estimate.number || "draft"
        } ${estimate.status}`,
        {
          documentId: estimate.id,
          documentType: "estimate",
        },
      ),
    ],
  };
}

export function upsertInvoiceOnJob(job, invoice) {
  const existingInvoices = job.invoices || [];

  const invoiceExists = existingInvoices.some(
    (item) => String(item.id) === String(invoice.id),
  );

  const nextInvoices = invoiceExists
    ? existingInvoices.map((item) =>
        String(item.id) === String(invoice.id) ? invoice : item,
      )
    : [...existingInvoices, invoice];

  return {
    ...job,
    invoices: nextInvoices,
    timeline: [
      ...(job.timeline || []),
      createTimelineEvent(
        `invoice_${invoice.status}`,
        `Invoice ${invoice.invoiceNumber || "draft"} linked to estimate ${
          invoice.estimateNumber || invoice.estimateId
        }`,
        {
          documentId: invoice.id,
          documentType: "invoice",
          estimateId: invoice.estimateId,
        },
      ),
    ],
  };
}

export function deleteDraftEstimateFromJob(job, estimateId) {
  const estimate = (job.quotes || []).find(
    (item) => String(item.id) === String(estimateId),
  );

  if (!estimate) return job;

  if (estimate.status !== "draft") {
    throw new Error(
      "Only draft estimates can be permanently deleted. Issued estimates should be voided or superseded.",
    );
  }

  return {
    ...job,
    quotes: (job.quotes || []).filter(
      (item) => String(item.id) !== String(estimateId),
    ),
    timeline: [
      ...(job.timeline || []),
      createTimelineEvent(
        "estimate_deleted",
        "Draft estimate permanently deleted",
        {
          documentId: estimateId,
          documentType: "estimate",
        },
      ),
    ],
  };
}

export function getActiveEstimate(job) {
  return (
    (job.quotes || []).find(
      (estimate) => String(estimate.id) === String(job.activeEstimateId),
    ) ||
    (job.quotes || []).find((estimate) => estimate.isActive) ||
    null
  );
}

export function buildFinancialTimeline(job) {
  const events = [];

  (job.timeline || []).forEach((event) => {
    events.push({
      ...event,
      source: "job",
    });
  });

  (job.quotes || []).forEach((estimate) => {
    (estimate.history || []).forEach((event) => {
      events.push({
        ...event,
        source: "estimate",
        parentId: estimate.id,
        parentNumber: estimate.number || estimate.quoteNumber || "Draft",
      });
    });
  });

  (job.invoices || []).forEach((invoice) => {
    (invoice.history || []).forEach((event) => {
      events.push({
        ...event,
        source: "invoice",
        parentId: invoice.id,
        parentNumber: invoice.invoiceNumber || invoice.number || "Invoice",
      });
    });
  });

  (job.payments || []).forEach((payment) => {
    events.push({
      id: payment.id,
      type: "payment_recorded",
      message: `Payment recorded: £${Number(payment.amount || 0).toFixed(2)}`,
      at: payment.date || payment.createdAt,
      source: "payment",
      parentId: payment.invoiceId,
    });
  });

  return sortTimelineNewestFirst(events);
}

export function calculateFinancialSummary(job) {
  const activeEstimate = getActiveEstimate(job);

  const invoices = job.invoices || [];
  const payments = job.payments || [];

  const totalInvoiced = invoices
    .filter((invoice) => ["issued", "emailed", "paid"].includes(invoice.status))
    .reduce(
      (sum, invoice) => sum + Number(invoice.total || invoice.amount || 0),
      0,
    );

  const totalPaid = invoices
    .filter((invoice) => ["paid"].includes(invoice.status))
    .reduce(
      (sum, invoice) => sum + Number(invoice.paidAmount || invoice.total || 0),
      0,
    );

  const contractTotal = Number(activeEstimate?.total || 0);

  const contractInvoiced = invoices
    .filter(
      (invoice) =>
        !invoice.isStandalone &&
        ["issued", "emailed", "paid"].includes(invoice.status),
    )
    .reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);

  return {
    activeEstimate,
    contractTotal,
    totalInvoiced,
    totalPaid,
    remainingToInvoice: Math.max(contractTotal - contractInvoiced, 0),
    outstanding: Math.max(totalInvoiced - totalPaid, 0),
  };
}

