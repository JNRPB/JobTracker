import PencilIcon from "./Icons/PencilIcon";
import TrashIcon from "./Icons/TrashIcon";

function TransactionBox({
  invoice,
  navigate,
  deleteInvoice,
  jobs,
  onJobFilter,
}) {
  function goToEdit() {
    navigate("EditInvoice", { invoiceId: invoice.id });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete this invoice? You can't undo this!",
    );

    if (!confirmed) return;

    deleteInvoice(invoice.id);
  }

  function getJobName(jobId) {
    const job = jobs.find((j) => String(j.id) === String(jobId));
    return job ? job.name : "Unknown job";
  }

  function formatDate(dateString) {
    if (!dateString) return "No date";

    const date = new Date(dateString);

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function getPayeeName() {
    return invoice.payee || "Unknown payee";
  }

  function getInvoiceTitle() {
    return (
      invoice.item || invoice.name || invoice.description || "Untitled invoice"
    );
  }

  const multiLinks = invoice.jobLinks && invoice.jobLinks.length > 0;
  const singleLink = invoice.jobLink && !multiLinks;

  return (
    <div className="transactionBox invoiceCard">
      <div className="transactionDateBlock">
        <p className="transactionDate">{formatDate(invoice.dateIssued)}</p>
      </div>

      <div className="transactionMiddle invoiceMiddle">
        <div className="invoiceHeaderRow">
          <p className="transactionName invoiceSupplier">{getPayeeName()}</p>
          <PencilIcon onClick={goToEdit} />
        </div>

        <p className="invoiceItemName">{getInvoiceTitle()}</p>

        <div className="invoiceJobLinks">
          {!multiLinks && !singleLink ? (
            <span className="invoiceNoLink">No job link</span>
          ) : multiLinks ? (
            invoice.jobLinks.map((link, index) => (
              <button
                key={`${link.jobId}-${index}`}
                className="jobLinkChip"
                onClick={() => onJobFilter(String(link.jobId))}
                type="button"
              >
                {getJobName(link.jobId)}
                {link.amount ? ` · £${Number(link.amount).toFixed(2)}` : ""}
              </button>
            ))
          ) : (
            <button
              className="jobLinkChip"
              onClick={() => onJobFilter(String(invoice.jobLink))}
              type="button"
            >
              {getJobName(invoice.jobLink)}
            </button>
          )}
        </div>
      </div>

      <div className="transactionRight">
        <p className="transactionAmount">
          £{Number(invoice.amount || 0).toFixed(2)}
        </p>
        <TrashIcon onClick={handleDelete} />
      </div>
    </div>
  );
}

export default TransactionBox;

