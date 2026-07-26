import { createTimelineEvent } from "./timeline";

export function createEstimateDraft({
  job,
  companySnapshot,
  customerSnapshot,
  title = "Estimate",
  items = [],
  notes = "",
  vatRate = 20,
}) {
  const now = new Date().toISOString();
  const totals = calculateEstimateTotals(items, vatRate);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    documentType: "estimate",
    type: "estimate",

    title,
    status: "draft",
    isActive: false,

    number: "",
    quoteNumber: "",

    createdAt: now,
    updatedAt: now,
    issuedAt: null,
    emailedAt: null,
    acceptedAt: null,

    companySnapshot,
    fromSnapshot: companySnapshot,
    customerSnapshot,

    jobSnapshot: {
      id: job.id,
      name: job.name,
      address: job.address,
      status: job.status,
    },

    items,
    notes,

    vatRate: Number(vatRate || 0),
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,

    history: [
      createTimelineEvent("estimate_created", "Estimate draft created"),
    ],
  };
}

export function updateEstimateDraft(existingEstimate, updates = {}) {
  const next = {
    ...existingEstimate,
    ...updates,
    updatedAt: new Date().toISOString(),
    history: [
      ...(existingEstimate.history || []),
      createTimelineEvent("estimate_edited", "Estimate draft edited"),
    ],
  };

  const totals = calculateEstimateTotals(
    next.items || [],
    Number(next.vatRate || 0),
  );

  return {
    ...next,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    total: totals.total,
  };
}

export function issueEstimate(existingEstimate, number) {
  const now = new Date().toISOString();

  return {
    ...existingEstimate,
    status: "issued",
    isActive: true,
    number,
    quoteNumber: number,
    issuedAt: existingEstimate.issuedAt || now,
    updatedAt: now,
    history: [
      ...(existingEstimate.history || []),
      createTimelineEvent("estimate_issued", `Estimate issued as ${number}`),
    ],
  };
}

export function markEstimateEmailed(existingEstimate, email) {
  const now = new Date().toISOString();

  return {
    ...existingEstimate,
    status: "emailed",
    emailedAt: now,
    updatedAt: now,
    history: [
      ...(existingEstimate.history || []),
      createTimelineEvent(
        "estimate_emailed",
        `Estimate emailed${email ? ` to ${email}` : ""}`,
        { email },
      ),
    ],
  };
}

export function markEstimateAccepted(existingEstimate) {
  const now = new Date().toISOString();

  return {
    ...existingEstimate,
    status: "accepted",
    acceptedAt: now,
    updatedAt: now,
    history: [
      ...(existingEstimate.history || []),
      createTimelineEvent("estimate_accepted", "Estimate accepted"),
    ],
  };
}

export function calculateEstimateTotals(items = [], vatRate = 20) {
  const subtotal = items.reduce((sum, item) => {
    return sum + Number(item.rate || 0) * Number(item.qty || 0);
  }, 0);

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

