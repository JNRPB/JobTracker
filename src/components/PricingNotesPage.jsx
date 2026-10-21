import { useEffect, useRef, useState } from "react";
import { getJobColour } from "./jobColour";
import { createEstimateDraft } from "../financial/estimate";
import { upsertEstimateOnJob } from "../financial/jobFinancials";
import "./PricingNotesPage.css";

const API_BASE = "";
const UNIT_SUGGESTIONS = [
  "each",
  "sheets",
  "lengths",
  "packs",
  "bags",
  "m²",
  "m³",
  "tonnes",
  "hours",
  "days",
  "metres",
  "litres",
  "loads",
  "allowance",
];

function moneyFromPence(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0) / 100);
}

function penceFromInput(value) {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function itemDraft(item = {}) {
  return {
    description: item.description || "",
    quantity: String(item.quantity ?? 1),
    unit: item.unit || "each",
    unitCost: (Number(item.unitCostPence || 0) / 100).toFixed(2),
    supplier: item.supplier || "",
    note: item.note || "",
  };
}

function itemRequest(draft) {
  const quantity = Number.parseFloat(draft.quantity);
  return {
    description: draft.description.trim(),
    quantity: Number.isFinite(quantity) ? Math.max(0, quantity) : 0,
    unit: draft.unit.trim() || "each",
    unitCostPence: penceFromInput(draft.unitCost),
    supplier: draft.supplier.trim(),
    note: draft.note,
  };
}

function draftTotalPence(draft) {
  return Math.round(
    Math.max(0, Number.parseFloat(draft.quantity) || 0) *
      penceFromInput(draft.unitCost),
  );
}

function companySnapshotFromSettings(settings = {}) {
  return {
    name: settings.name || "JNR Plastering & Building Ltd",
    owner: settings.owner || "Joshua Roberton",
    email: settings.email || "info@jnrplasteringandbuilding.com",
    phone: settings.phone || "",
    address1: settings.address1 || "",
    address2: settings.address2 || "",
    postcode: settings.postcode || "",
    website: settings.website || "",
    companyNumber: settings.companyNumber || "",
    vatNumber: settings.vatNumber || "",
  };
}

function customerSnapshotFromJob(job = {}) {
  const customer = job.customerDetails || {};
  return {
    name: customer.name || job.clientName || job.client || "",
    email: customer.email || job.clientEmail || "",
    phone: customer.phone || job.clientPhone || "",
    mobile: customer.phone || job.clientPhone || "",
    address1: customer.address || job.address || "",
    address2: "",
    postcode: "",
  };
}

function estimateItemFromBlock(block, sellingPricePence) {
  return {
    id: `${Date.now()}-${block.id}-${Math.random().toString(36).slice(2)}`,
    description: String(block.title || "Pricing block").trim(),
    details: String(block.description || "").trim(),
    rate: Number((Number(sellingPricePence || 0) / 100).toFixed(2)),
    qty: 1,
    vat: true,
    sourcePricingBlockId: block.id,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers || {}) }
      : options.headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Could not save (${response.status}).`);
  }
  return body;
}

function PricingItemRow({
  jobId,
  blockId,
  item,
  onData,
  onMessage,
  onDraftTotal,
}) {
  const [draft, setDraft] = useState(() => itemDraft(item));
  const [saveState, setSaveState] = useState("");
  const draftRef = useRef(draft);
  const savedRef = useRef(JSON.stringify(draft));
  const saveTimer = useRef(null);
  const savingRef = useRef(false);
  const queuedRef = useRef(false);

  useEffect(() => {
    const next = itemDraft(item);
    const serialized = JSON.stringify(next);
    savedRef.current = serialized;
    if (!savingRef.current) {
      draftRef.current = next;
      setDraft(next);
    }
  }, [item.id, item.updatedAt]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  async function commit() {
    clearTimeout(saveTimer.current);
    const current = draftRef.current;
    const serialized = JSON.stringify(current);
    if (serialized === savedRef.current) return;
    if (!current.description.trim()) {
      setSaveState("Needs a description");
      return;
    }
    if (savingRef.current) {
      queuedRef.current = true;
      return;
    }

    savingRef.current = true;
    setSaveState("Saving…");
    try {
      const data = await request(
        `/api/jobs/${encodeURIComponent(jobId)}/pricing-blocks/${encodeURIComponent(blockId)}/items/${encodeURIComponent(item.id)}`,
        { method: "PUT", body: JSON.stringify(itemRequest(current)) },
      );
      savedRef.current = serialized;
      onData(data);
      setSaveState("Saved");
    } catch (error) {
      setSaveState("Failed");
      onMessage(error.message, "error");
    } finally {
      savingRef.current = false;
      if (
        queuedRef.current ||
        JSON.stringify(draftRef.current) !== savedRef.current
      ) {
        queuedRef.current = false;
        saveTimer.current = setTimeout(commit, 80);
      }
    }
  }

  function change(field, value) {
    const next = { ...draftRef.current, [field]: value };
    draftRef.current = next;
    setDraft(next);
    onDraftTotal(blockId, item.id, draftTotalPence(next));
    setSaveState("Unsaved");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(commit, 650);
  }

  function finishEditing(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  const localTotal = draftTotalPence(draft);

  async function duplicateItem() {
    try {
      const data = await request(
        `/api/jobs/${encodeURIComponent(jobId)}/pricing-blocks/${encodeURIComponent(blockId)}/items/${encodeURIComponent(item.id)}/duplicate`,
        { method: "POST" },
      );
      onData(data);
      onMessage("Item duplicated.");
    } catch (error) {
      onMessage(error.message, "error");
    }
  }

  async function deleteItem() {
    try {
      const data = await request(
        `/api/jobs/${encodeURIComponent(jobId)}/pricing-blocks/${encodeURIComponent(blockId)}/items/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      onData(data);
      onMessage("Item removed.");
    } catch (error) {
      onMessage(error.message, "error");
    }
  }

  return (
    <article className="pricingItem">
      <label className="pricingField pricingDescriptionField">
        <span>Description</span>
        <input
          value={draft.description}
          onChange={(event) => change("description", event.target.value)}
          onBlur={commit}
          onKeyDown={finishEditing}
          placeholder="Materials, labour or allowance"
        />
      </label>
      <label className="pricingField pricingQtyField">
        <span>Qty</span>
        <input
          type="number"
          min="0"
          step="any"
          value={draft.quantity}
          onChange={(event) => change("quantity", event.target.value)}
          onBlur={commit}
          onKeyDown={finishEditing}
        />
      </label>
      <label className="pricingField pricingUnitField">
        <span>Unit</span>
        <input
          list="pricing-unit-suggestions"
          value={draft.unit}
          onChange={(event) => change("unit", event.target.value)}
          onBlur={commit}
          onKeyDown={finishEditing}
        />
      </label>
      <label className="pricingField pricingCostField">
        <span>Unit cost</span>
        <div className="pricingMoneyInput">
          <b>£</b>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.unitCost}
            onChange={(event) => change("unitCost", event.target.value)}
            onBlur={commit}
            onKeyDown={finishEditing}
          />
        </div>
      </label>
      <label className="pricingField pricingSupplierField">
        <span>Supplier</span>
        <input
          value={draft.supplier}
          onChange={(event) => change("supplier", event.target.value)}
          onBlur={commit}
          onKeyDown={finishEditing}
          placeholder="Optional"
        />
      </label>
      <div className="pricingItemTotal">
        <span>Total</span>
        <strong>{moneyFromPence(localTotal)}</strong>
        <small className={`pricingSaveState ${saveState === "Failed" ? "failed" : ""}`}>
          {saveState}
        </small>
      </div>
      <div className="pricingItemActions">
        <button type="button" onClick={duplicateItem}>Duplicate</button>
        <button type="button" className="danger" onClick={deleteItem}>Delete</button>
      </div>
      <details className="pricingItemNote">
        <summary>{draft.note ? "Edit item note" : "Add item note"}</summary>
        <textarea
          rows="3"
          value={draft.note}
          onChange={(event) => change("note", event.target.value)}
          onBlur={commit}
          placeholder="Measurements, assumptions, substitutions or reminders…"
        />
      </details>
    </article>
  );
}

function PricingBlock({
  jobId,
  block,
  blockSubtotalPence,
  onData,
  onMessage,
  onDraftTotal,
}) {
  const [heading, setHeading] = useState({
    title: block.title || "",
    description: block.description || "",
  });
  const [headingState, setHeadingState] = useState("");
  const [showNewItem, setShowNewItem] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [newItem, setNewItem] = useState(() => itemDraft());

  useEffect(() => {
    setHeading({
      title: block.title || "",
      description: block.description || "",
    });
  }, [block.id, block.updatedAt]);

  async function saveHeading() {
    const title = heading.title.trim();
    if (!title) {
      setHeadingState("Title required");
      return;
    }
    if (title === block.title && heading.description === block.description) return;

    setHeadingState("Saving…");
    try {
      const data = await request(
        `/api/jobs/${encodeURIComponent(jobId)}/pricing-blocks/${encodeURIComponent(block.id)}`,
        {
          method: "PUT",
          body: JSON.stringify({ title, description: heading.description }),
        },
      );
      onData(data);
      setHeadingState("Saved");
    } catch (error) {
      setHeadingState("Failed");
      onMessage(error.message, "error");
    }
  }

  async function duplicateBlock() {
    try {
      const data = await request(
        `/api/jobs/${encodeURIComponent(jobId)}/pricing-blocks/${encodeURIComponent(block.id)}/duplicate`,
        { method: "POST" },
      );
      onData(data);
      onMessage("Pricing block duplicated.");
    } catch (error) {
      onMessage(error.message, "error");
    }
  }

  async function deleteBlock() {
    if (!window.confirm(`Delete “${block.title}” and all of its items?`)) return;
    try {
      const data = await request(
        `/api/jobs/${encodeURIComponent(jobId)}/pricing-blocks/${encodeURIComponent(block.id)}`,
        { method: "DELETE" },
      );
      onData(data);
      onMessage("Pricing block deleted.");
    } catch (error) {
      onMessage(error.message, "error");
    }
  }

  function changeNewItem(field, value) {
    setNewItem((current) => ({ ...current, [field]: value }));
  }

  async function addItem(event) {
    event.preventDefault();
    if (!newItem.description.trim() || addingItem) return;
    setAddingItem(true);
    try {
      const data = await request(
        `/api/jobs/${encodeURIComponent(jobId)}/pricing-blocks/${encodeURIComponent(block.id)}/items`,
        { method: "POST", body: JSON.stringify(itemRequest(newItem)) },
      );
      onData(data);
      setNewItem(itemDraft());
      setShowNewItem(false);
      onMessage("Item added.");
    } catch (error) {
      onMessage(error.message, "error");
    } finally {
      setAddingItem(false);
    }
  }

  return (
    <section className="pricingBlock">
      <header className="pricingBlockHeader">
        <div className="pricingBlockHeadingInputs">
          <input
            className="pricingBlockTitleInput"
            value={heading.title}
            onChange={(event) => setHeading((current) => ({ ...current, title: event.target.value }))}
            onBlur={saveHeading}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="Pricing block title"
          />
          <textarea
            rows="1"
            value={heading.description}
            onChange={(event) => setHeading((current) => ({ ...current, description: event.target.value }))}
            onBlur={saveHeading}
            placeholder="Optional description or scope note"
            aria-label="Pricing block description"
          />
          <small className={headingState === "Failed" ? "failed" : ""}>{headingState}</small>
        </div>
        <div className="pricingBlockTotal">
          <span>Subtotal</span>
          <strong>{moneyFromPence(blockSubtotalPence)}</strong>
        </div>
        <div className="pricingBlockActions">
          <button type="button" onClick={duplicateBlock}>Duplicate block</button>
          <button type="button" className="danger" onClick={deleteBlock}>Delete</button>
        </div>
      </header>

      <div className="pricingItemLabels" aria-hidden="true">
        <span>Description</span><span>Qty</span><span>Unit</span><span>Unit cost</span>
        <span>Supplier</span><span>Total</span><span />
      </div>

      <div className="pricingItems">
        {block.items.length ? (
          block.items.map((item) => (
            <PricingItemRow
              key={item.id}
              jobId={jobId}
              blockId={block.id}
              item={item}
              onData={onData}
              onMessage={onMessage}
              onDraftTotal={onDraftTotal}
            />
          ))
        ) : (
          <div className="pricingEmptyItems">
            <strong>No items in this block</strong>
            <span>Add the first material, labour allowance or supplier price.</span>
          </div>
        )}
      </div>

      {showNewItem ? (
        <form className="pricingNewItem" onSubmit={addItem}>
          <div className="pricingNewItemGrid">
            <label className="pricingField pricingDescriptionField">
              <span>Description</span>
              <input
                autoFocus
                required
                value={newItem.description}
                onChange={(event) => changeNewItem("description", event.target.value)}
                placeholder="e.g. 12.5 mm plasterboard"
              />
            </label>
            <label className="pricingField pricingQtyField">
              <span>Qty</span>
              <input type="number" min="0" step="any" value={newItem.quantity} onChange={(event) => changeNewItem("quantity", event.target.value)} />
            </label>
            <label className="pricingField pricingUnitField">
              <span>Unit</span>
              <input list="pricing-unit-suggestions" value={newItem.unit} onChange={(event) => changeNewItem("unit", event.target.value)} />
            </label>
            <label className="pricingField pricingCostField">
              <span>Unit cost</span>
              <div className="pricingMoneyInput">
                <b>£</b>
                <input type="number" min="0" step="0.01" value={newItem.unitCost} onChange={(event) => changeNewItem("unitCost", event.target.value)} />
              </div>
            </label>
            <label className="pricingField pricingSupplierField">
              <span>Supplier</span>
              <input value={newItem.supplier} onChange={(event) => changeNewItem("supplier", event.target.value)} placeholder="Optional" />
            </label>
            <label className="pricingField pricingNewNoteField">
              <span>Note</span>
              <input value={newItem.note} onChange={(event) => changeNewItem("note", event.target.value)} placeholder="Optional" />
            </label>
          </div>
          <div className="pricingComposerActions">
            <button type="button" onClick={() => setShowNewItem(false)}>Cancel</button>
            <button type="submit" className="primary" disabled={addingItem || !newItem.description.trim()}>
              {addingItem ? "Adding…" : "Add item"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="pricingAddItem" onClick={() => setShowNewItem(true)}>
          + Add item
        </button>
      )}
      <footer className="pricingBlockFooter">
        <span>Block total</span>
        <strong>{moneyFromPence(blockSubtotalPence)}</strong>
      </footer>
    </section>
  );
}

function PricingNotesPage({ job, navigate, onUpdate }) {
  const [data, setData] = useState({
    blocks: [],
    summary: { blockCount: 0, itemCount: 0, workingTotalPence: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: "", tone: "" });
  const [showNewBlock, setShowNewBlock] = useState(false);
  const [newBlock, setNewBlock] = useState({ title: "", description: "" });
  const [addingBlock, setAddingBlock] = useState(false);
  const [draftTotals, setDraftTotals] = useState({});
  const [pricingDefaults, setPricingDefaults] = useState({
    defaultOverheadPerDay: 0,
  });
  const [showEstimatePicker, setShowEstimatePicker] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState([]);
  const [conversionOptions, setConversionOptions] = useState({
    includeOverhead: false,
    days: "1",
    markupPercent: "20",
  });
  const [convertingEstimate, setConvertingEstimate] = useState(false);
  const [conversionError, setConversionError] = useState("");
  const messageTimer = useRef(null);
  const jobColour = getJobColour(job);

  useEffect(() => {
    if (!showEstimatePicker) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event) {
      if (event.key === "Escape" && !convertingEstimate) {
        setShowEstimatePicker(false);
        setConversionError("");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showEstimatePicker, convertingEstimate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    request(`/api/jobs/${encodeURIComponent(job.id)}/pricing-notes`)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error) => {
        if (!cancelled) setMessage({ text: error.message, tone: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    request("/api/business-settings")
      .then((settings) => {
        if (!cancelled) {
          setPricingDefaults({
            defaultOverheadPerDay: Number(
              settings.pricingDefaults?.defaultOverheadPerDay || 0,
            ),
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(messageTimer.current);
    };
  }, [job.id]);

  function showMessage(text, tone = "") {
    clearTimeout(messageTimer.current);
    setMessage({ text, tone });
    if (tone !== "error") {
      messageTimer.current = setTimeout(
        () => setMessage({ text: "", tone: "" }),
        2400,
      );
    }
  }

  function applyData(response) {
    setData(response);
    setDraftTotals({});
  }

  function updateDraftTotal(blockId, itemId, totalPence) {
    setDraftTotals((current) => ({
      ...current,
      [`${blockId}:${itemId}`]: totalPence,
    }));
  }

  function effectiveBlockSubtotal(block) {
    return block.items.reduce((sum, item) => {
      const draftTotal = draftTotals[`${block.id}:${item.id}`];
      return sum + (draftTotal == null ? Number(item.totalPence || 0) : draftTotal);
    }, 0);
  }

  const workingTotalPence = data.blocks
    .filter((block) => block.active !== false)
    .reduce((sum, block) => sum + effectiveBlockSubtotal(block), 0);

  const selectableBlocks = data.blocks.filter((block) => block.active !== false);
  const selectedBlocks = selectableBlocks.filter((block) =>
    selectedBlockIds.includes(String(block.id)),
  );
  const selectedInternalPence = selectedBlocks.reduce(
    (sum, block) => sum + effectiveBlockSubtotal(block),
    0,
  );
  const selectedDays = Math.max(
    0,
    Number.parseFloat(conversionOptions.days) || 0,
  );
  const selectedMarkup = Math.max(
    0,
    Number.parseFloat(conversionOptions.markupPercent) || 0,
  );
  const overheadPerDayPence = penceFromInput(
    pricingDefaults.defaultOverheadPerDay,
  );
  const conversionOverheadPence = conversionOptions.includeOverhead
    ? Math.round(overheadPerDayPence * selectedDays)
    : 0;
  const conversionCostBasePence =
    selectedInternalPence + conversionOverheadPence;
  const conversionSellingPence = Math.round(
    conversionCostBasePence * (1 + selectedMarkup / 100),
  );
  const conversionProfitPence =
    conversionSellingPence - conversionCostBasePence;
  const conversionExampleBlock =
    selectedBlocks.find((block) => /material/i.test(block.title || "")) ||
    selectedBlocks[0] ||
    null;
  const conversionExamplePence = conversionExampleBlock
    ? effectiveBlockSubtotal(conversionExampleBlock)
    : 0;

  function openEstimatePicker() {
    const dailyOverhead = Number(pricingDefaults.defaultOverheadPerDay || 0);
    setSelectedBlockIds(selectableBlocks.map((block) => String(block.id)));
    setConversionOptions({
      includeOverhead: dailyOverhead > 0,
      days: "1",
      markupPercent: "20",
    });
    setConversionError("");
    setShowEstimatePicker(true);
  }

  function closeEstimatePicker() {
    if (convertingEstimate) return;
    setShowEstimatePicker(false);
    setConversionError("");
  }

  function toggleEstimateBlock(blockId) {
    const key = String(blockId);
    setSelectedBlockIds((current) =>
      current.includes(key)
        ? current.filter((id) => id !== key)
        : [...current, key],
    );
  }

  function updateConversionOption(field, value) {
    setConversionOptions((current) => ({ ...current, [field]: value }));
  }

  function buildSellingItems(blocks) {
    const blockCount = blocks.length;
    const baseOverhead = blockCount
      ? Math.floor(conversionOverheadPence / blockCount)
      : 0;
    const overheadRemainder = blockCount
      ? conversionOverheadPence - baseOverhead * blockCount
      : 0;
    const pricedBlocks = blocks.map((block, index) => {
      const overheadShare =
        baseOverhead + (index < overheadRemainder ? 1 : 0);
      const costBase = effectiveBlockSubtotal(block) + overheadShare;
      return {
        block,
        sellingPence: Math.round(costBase * (1 + selectedMarkup / 100)),
      };
    });
    const roundingDifference =
      conversionSellingPence -
      pricedBlocks.reduce((sum, item) => sum + item.sellingPence, 0);
    if (pricedBlocks.length) {
      pricedBlocks[pricedBlocks.length - 1].sellingPence += roundingDifference;
    }
    return pricedBlocks.map(({ block, sellingPence }) =>
      estimateItemFromBlock(block, sellingPence),
    );
  }

  async function makeEstimate() {
    if (convertingEstimate || !selectedBlocks.length) return;

    setConvertingEstimate(true);
    setConversionError("");

    try {
      const [settings] = await Promise.all([
        request("/api/business-settings"),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      const createdAt = new Date().toISOString();
      const draft = createEstimateDraft({
        job,
        companySnapshot: companySnapshotFromSettings(settings),
        customerSnapshot: customerSnapshotFromJob(job),
        title: "Estimate",
        items: buildSellingItems(selectedBlocks),
        notes: settings.defaultTerms || "",
        vatRate: Number(settings.defaultVatRate ?? 20),
      });
      const estimate = {
        ...draft,
        source: {
          type: "pricing_notes",
          pricingBlockIds: selectedBlocks.map((block) => block.id),
          convertedAt: createdAt,
        },
        history: [
          ...(draft.history || []),
          {
            id: `${Date.now()}-pricing-notes`,
            type: "estimate_imported_from_pricing_notes",
            message: `Created from ${selectedBlocks.length} pricing ${selectedBlocks.length === 1 ? "block" : "blocks"}`,
            at: createdAt,
          },
        ],
      };

      await onUpdate(upsertEstimateOnJob(job, estimate));
      navigate("QuoteBuilder", {
        jobId: job.id,
        quoteId: estimate.id,
        fromPricingNotes: true,
      });
    } catch (error) {
      setConversionError(error.message || "Could not create the estimate.");
      setConvertingEstimate(false);
    }
  }

  async function addBlock(event) {
    event.preventDefault();
    if (!newBlock.title.trim() || addingBlock) return;
    setAddingBlock(true);
    try {
      const response = await request(
        `/api/jobs/${encodeURIComponent(job.id)}/pricing-blocks`,
        { method: "POST", body: JSON.stringify(newBlock) },
      );
      applyData(response);
      setNewBlock({ title: "", description: "" });
      setShowNewBlock(false);
      showMessage("Pricing block added.");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setAddingBlock(false);
    }
  }

  return (
    <main className="pricingNotesPage" style={{ "--job-colour": jobColour }}>
      <datalist id="pricing-unit-suggestions">
        {UNIT_SUGGESTIONS.map((unit) => <option value={unit} key={unit} />)}
      </datalist>

      <header className="pricingPageHeader">
        <div>
          <button type="button" className="pricingBack" onClick={() => navigate("JobCard", { jobId: job.id })}>
            ← Back to job
          </button>
          <div className="pricingTitleLine">
            <h1>Pricing notes</h1>
            <span className="pricingInternalBadge">Internal</span>
          </div>
          <p className="pricingJobName">{job.name || job.title || "Job"}</p>
          <p className="pricingJobAddress">{job.address || job.customerDetails?.address || "No address recorded"}</p>
        </div>
        <div className="pricingPageTotal">
          <span>Working total</span>
          <strong>{moneyFromPence(workingTotalPence)}</strong>
          <small>{data.summary?.blockCount || 0} blocks · {data.summary?.itemCount || 0} items</small>
        </div>
        <div className="pricingHeaderActions">
          <button
            type="button"
            className="pricingEstimateButton"
            onClick={openEstimatePicker}
            disabled={loading || !selectableBlocks.length}
          >
            <span>Make into estimate</span>
            <b aria-hidden="true">→</b>
          </button>
          <button type="button" className="pricingPrimaryButton" onClick={() => setShowNewBlock(true)}>
            + New pricing block
          </button>
        </div>
      </header>

      <div className="pricingSeparationNote">
        <strong>Internal pricing stays private.</strong>
        <span>When you make an estimate, customers only see the selected scope and final selling prices—not the item, supplier or overhead breakdown.</span>
      </div>

      {message.text && (
        <div className={`pricingPageMessage ${message.tone}`} role="status">
          {message.text}
        </div>
      )}

      {showNewBlock && (
        <form className="pricingNewBlock" onSubmit={addBlock}>
          <div>
            <span className="pricingKicker">New pricing block</span>
            <input
              autoFocus
              required
              value={newBlock.title}
              onChange={(event) => setNewBlock((current) => ({ ...current, title: event.target.value }))}
              placeholder="e.g. Plastering materials"
              aria-label="New pricing block title"
            />
            <textarea
              rows="2"
              value={newBlock.description}
              onChange={(event) => setNewBlock((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional scope, room or pricing assumption"
              aria-label="New pricing block description"
            />
          </div>
          <div className="pricingComposerActions">
            <button type="button" onClick={() => setShowNewBlock(false)}>Cancel</button>
            <button type="submit" className="primary" disabled={addingBlock || !newBlock.title.trim()}>
              {addingBlock ? "Adding…" : "Create block"}
            </button>
          </div>
        </form>
      )}

      {showEstimatePicker && (
        <div
          className="pricingEstimateOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEstimatePicker();
          }}
        >
          <section
            className={`pricingEstimateModal ${convertingEstimate ? "isConverting" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pricing-estimate-title"
          >
            {convertingEstimate ? (
              <div className="pricingConversionState" role="status" aria-live="polite">
                <div className="pricingConversionSpinner" aria-hidden="true">
                  <span /><span /><span />
                </div>
                <span className="pricingKicker">Building draft estimate</span>
                <h2>Turning internal pricing into customer scope</h2>
                <p>
                  Pricing {selectedBlocks.length} estimate {selectedBlocks.length === 1 ? "line" : "lines"}, spreading hidden overhead and applying your {selectedMarkup}% markup.
                </p>
                <div className="pricingConversionProgress"><span /></div>
              </div>
            ) : (
              <>
                <header className="pricingEstimateModalHeader">
                  <div>
                    <span className="pricingKicker">Make into estimate</span>
                    <h2 id="pricing-estimate-title">Build the customer price</h2>
                    <p>Choose the scope, add internal running costs and set your markup.</p>
                  </div>
                  <button type="button" className="pricingModalClose" onClick={closeEstimatePicker} aria-label="Close">
                    ×
                  </button>
                </header>

                <div className="pricingEstimatePrivacyNote">
                  <span aria-hidden="true">£</span>
                  <p><strong>The breakdown stays inside JNR.</strong> The customer estimate receives only each block’s title, scope and final selling price.</p>
                </div>

                <div className="pricingEstimateSelectBar">
                  <strong>{selectedBlockIds.length} of {selectableBlocks.length} blocks selected</strong>
                  <div>
                    <button type="button" onClick={() => setSelectedBlockIds(selectableBlocks.map((block) => String(block.id)))}>Select all</button>
                    <button type="button" onClick={() => setSelectedBlockIds([])}>Clear</button>
                  </div>
                </div>

                <div className="pricingEstimateChoices">
                  {selectableBlocks.map((block) => {
                    const selected = selectedBlockIds.includes(String(block.id));
                    return (
                      <label className={`pricingEstimateChoice ${selected ? "selected" : ""}`} key={block.id}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleEstimateBlock(block.id)}
                        />
                        <span className="pricingEstimateCheck" aria-hidden="true">{selected ? "✓" : ""}</span>
                        <span className="pricingEstimateChoiceText">
                          <strong>{block.title || "Untitled pricing block"}</strong>
                          <small>{block.description || "No scope description yet"}</small>
                        </span>
                        <span className="pricingEstimateChoiceMeta">
                          {block.items.length} {block.items.length === 1 ? "item" : "items"}
                          <small>{moneyFromPence(effectiveBlockSubtotal(block))} internal subtotal</small>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <section className="pricingConversionOptions">
                  <div className="pricingConversionOptionsTitle">
                    <div>
                      <span className="pricingKicker">Selling price</span>
                      <h3>Apply JNR costs and profit</h3>
                    </div>
                    <small>Nothing here appears as a separate customer line</small>
                  </div>

                  <label className={`pricingOverheadToggle ${conversionOptions.includeOverhead ? "selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={conversionOptions.includeOverhead}
                      onChange={(event) => updateConversionOption("includeOverhead", event.target.checked)}
                    />
                    <span className="pricingToggleVisual" aria-hidden="true"><i /></span>
                    <span>
                      <strong>Include JNR internal overhead</strong>
                      <small>{moneyFromPence(overheadPerDayPence)} per working day · set in Settings</small>
                    </span>
                  </label>

                  <div className="pricingConversionFields">
                    <label>
                      <span>Working days</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={conversionOptions.days}
                        disabled={!conversionOptions.includeOverhead}
                        onChange={(event) => updateConversionOption("days", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Profit / markup</span>
                      <div className="pricingPercentInput">
                        <input
                          type="number"
                          min="0"
                          max="500"
                          step="0.5"
                          value={conversionOptions.markupPercent}
                          onChange={(event) => updateConversionOption("markupPercent", event.target.value)}
                        />
                        <b>%</b>
                      </div>
                    </label>
                  </div>

                  <div className="pricingConversionSummary">
                    <span><small>Selected pricing</small><strong>{moneyFromPence(selectedInternalPence)}</strong></span>
                    <i aria-hidden="true">+</i>
                    <span><small>Hidden overhead</small><strong>{moneyFromPence(conversionOverheadPence)}</strong></span>
                    <i aria-hidden="true">+</i>
                    <span><small>{selectedMarkup}% markup</small><strong>{moneyFromPence(conversionProfitPence)}</strong></span>
                    <i aria-hidden="true">=</i>
                    <span className="pricingSellingTotal"><small>Estimate subtotal</small><strong>{moneyFromPence(conversionSellingPence)}</strong></span>
                  </div>
                  {conversionOptions.includeOverhead && overheadPerDayPence === 0 && (
                    <p className="pricingOverheadWarning">Your default overhead is £0.00. Set it in Settings → Pricing defaults when you’re ready.</p>
                  )}
                  <p className="pricingSpreadNote">
                    Hidden overhead is shared equally across the selected blocks, then the markup is applied. {conversionExampleBlock ? `${conversionExampleBlock.title} starts from its ${moneyFromPence(conversionExamplePence)} internal subtotal and receives its share automatically.` : "Choose at least one block to see the calculation."}
                  </p>
                </section>

                {conversionError && <p className="pricingConversionError" role="alert">{conversionError}</p>}

                <footer className="pricingEstimateModalFooter">
                  <button type="button" className="pricingModalCancel" onClick={closeEstimatePicker}>Cancel</button>
                  <button
                    type="button"
                    className="pricingModalConfirm"
                    disabled={!selectedBlockIds.length}
                    onClick={makeEstimate}
                  >
                    Create {moneyFromPence(conversionSellingPence)} draft
                    <span>{selectedBlockIds.length || 0}</span>
                    <b aria-hidden="true">→</b>
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}

      {loading ? (
        <div className="pricingLoading">Loading pricing notes…</div>
      ) : data.blocks.length ? (
        <div className="pricingBlockList">
          {data.blocks.map((block) => (
            <PricingBlock
              key={block.id}
              jobId={job.id}
              block={block}
              blockSubtotalPence={effectiveBlockSubtotal(block)}
              onData={applyData}
              onMessage={showMessage}
              onDraftTotal={updateDraftTotal}
            />
          ))}
        </div>
      ) : (
        <section className="pricingEmptyState">
          <span className="pricingEmptyIcon">£</span>
          <h2>No pricing blocks yet</h2>
          <p>Build a private, itemised working price without affecting the job’s formal figures.</p>
          <button type="button" className="pricingPrimaryButton" onClick={() => setShowNewBlock(true)}>
            + Create the first block
          </button>
        </section>
      )}
    </main>
  );
}

export default PricingNotesPage;
