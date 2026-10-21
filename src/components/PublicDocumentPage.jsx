import { useEffect, useRef, useState } from "react";
import logo from "../assets/logo.png";
import "./FinancialDocuments.css";

const API_BASE = "";
const DOCUMENT_WIDTH = 794;

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
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const viewerRef = useRef(null);
  const documentRef = useRef(null);
  const viewRecordedRef = useRef(false);

  const [documentScale, setDocumentScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState(0);

  useEffect(() => {
    async function loadDocument() {
      try {
        let response;

        if (type === "estimate" && !id) {
          response = await fetch(`${API_BASE}/api/public-estimates/${token}`);
        } else if (type === "invoice" && !id) {
          response = await fetch(`${API_BASE}/api/public-invoices/${token}`);
        } else {
          response = await fetch(`${API_BASE}/api/public-portal/${token}`);
        }

        if (!response.ok) {
          throw new Error("Document not found");
        }

        const responseData = await response.json();

        let job;
        let document;

        if (type === "estimate" && !id) {
          job = responseData.job;
          document = responseData.estimate;
        } else if (type === "invoice" && !id) {
          job = responseData.job;
          document = responseData.invoice;
        } else {
          job = responseData.job;

          document =
            type === "estimate"
              ? responseData.estimate
              : (responseData.invoices || []).find(
                  (invoice) => String(invoice.id) === String(id),
                );
        }

        if (!document) {
          throw new Error("Document not found");
        }

        setData({
          job,
          document,
        });

        if (!id && !viewRecordedRef.current) {
          viewRecordedRef.current = true;

          const viewUrl =
            type === "invoice"
              ? `${API_BASE}/api/public-invoices/${token}/view`
              : `${API_BASE}/api/public-estimates/${token}/view`;

          fetch(viewUrl, {
            method: "POST",
          }).catch((viewError) => {
            console.error(`Could not record ${type} view:`, viewError);
          });
        }
      } catch (err) {
        console.error("Could not load public document:", err);

        setError(
          err instanceof Error ? err.message : "Could not load document",
        );
      }
    }

    if (token && type) {
      loadDocument();
    }
  }, [token, type, id]);

  useEffect(() => {
    if (!data) return undefined;

    function resizeDocument() {
      const viewer = viewerRef.current;
      const documentElement = documentRef.current;

      if (!viewer || !documentElement) return;

      const horizontalPadding = 24;

      const availableWidth = Math.max(
        viewer.clientWidth - horizontalPadding,
        280,
      );

      const nextScale = Math.min(1, availableWidth / DOCUMENT_WIDTH);

      const unscaledHeight = documentElement.scrollHeight;

      setDocumentScale(nextScale);
      setScaledHeight(unscaledHeight * nextScale);
    }

    const frame = requestAnimationFrame(resizeDocument);

    const resizeObserver = new ResizeObserver(() => {
      resizeDocument();
    });

    if (viewerRef.current) {
      resizeObserver.observe(viewerRef.current);
    }

    if (documentRef.current) {
      resizeObserver.observe(documentRef.current);
    }

    window.addEventListener("resize", resizeDocument);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeDocument);
    };
  }, [data]);

  useEffect(() => {
    if (!data?.document) return;

    const document = data.document;

    const documentNumber =
      document.invoiceNumber || document.quoteNumber || document.number || "";

    if (type === "invoice") {
      window.document.title = `Invoice ${documentNumber} | JNR Plastering & Building`;
    } else {
      window.document.title = `Estimate ${documentNumber} | JNR Plastering & Building`;
    }

    return () => {
      window.document.title = "JNR Plastering & Building";
    };
  }, [data, type]);

  if (error) {
    return (
      <div className="estimatePage printDocumentPage">
        <div className="bubbleBox">
          <h1>{error}</h1>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="estimatePage printDocumentPage">
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
    document.customerSnapshot || job?.customerDetails || {};

  const documentNumber =
    document.invoiceNumber ||
    document.number ||
    document.quoteNumber ||
    "Document";

  async function downloadPdf() {
    if (!token || type !== "estimate" || downloadingPdf) {
      return;
    }

    try {
      setDownloadingPdf(true);

      const response = await fetch(
        `${API_BASE}/api/public-estimates/${token}/pdf`,
      );

      if (!response.ok) {
        let message = "Could not generate PDF.";

        try {
          const errorData = await response.json();
          message = errorData.error || message;
        } catch {
          // Response was not JSON.
        }

        throw new Error(message);
      }

      const pdfBlob = await response.blob();
      const downloadUrl = URL.createObjectURL(pdfBlob);

      const link = window.document.createElement("a");

      link.href = downloadUrl;
      link.download = `${documentNumber}.pdf`;

      window.document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("PDF download failed:", err);

      alert(err instanceof Error ? err.message : "Could not download PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="estimatePage printDocumentPage">
      <div className="estimateTopbar publicDocumentToolbar no-print">
        <div className="publicDocumentToolbarTitle">
          <span>{isInvoice ? "Invoice" : "Estimate"}</span>
          <strong>{documentNumber}</strong>
        </div>

        {!isInvoice && (
          <button
            className="sleekButton primaryButton"
            type="button"
            onClick={downloadPdf}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? "Creating PDF..." : "Download PDF"}
          </button>
        )}
      </div>

      <main ref={viewerRef} className="documentViewer printDocumentCanvas">
        <div
          className="documentScaleStage"
          style={{
            width: `${DOCUMENT_WIDTH * documentScale}px`,
            height: `${scaledHeight}px`,
          }}
        >
          <div
            ref={documentRef}
            className="estimatePreview documentPaper"
            style={{
              width: `${DOCUMENT_WIDTH}px`,
              transform: `scale(${documentScale})`,
              transformOrigin: "top left",
            }}
          >
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

                <span>{documentNumber}</span>

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
                {items.map((item, index) => {
                  const lineAmount =
                    Number(item.rate || 0) * Number(item.qty || 0);

                  return (
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
                      <td>{money(lineAmount)}</td>
                    </tr>
                  );
                })}
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

            {isInvoice && (document.attachments || []).length > 0 && (
              <section className="invoicePreviewAttachments">
                <h3>Attached Documents</h3>

                <div className="invoiceAttachmentList">
                  {document.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`invoiceAttachmentPreviewRow ${
                        attachment.isImage ? "imageAttachment" : ""
                      }`}
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
                    </a>
                  ))}
                </div>
              </section>
            )}

            {isInvoice && document.paidAt && (
              <div className="estimatePreviewNotes">
                Payment received: {money(document.paidAmount)} on{" "}
                {formatDate(document.paidAt)} by{" "}
                {document.paymentMethod || "Bank transfer"}.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default PublicDocumentPage;
