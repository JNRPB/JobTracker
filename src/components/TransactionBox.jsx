import PencilIcon from "./Icons/PencilIcon";
import TrashIcon from "./Icons/TrashIcon";

function TransactionBox({ invoice, navigate, deleteInvoice, jobs }) {
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
    const job = jobs.find((j) => j.id === jobId);
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

  return (
    <div className="transactionBox">
      <div className="transactionDateBlock">
        <p className="transactionDate">{formatDate(invoice.dateIssued)}</p>
      </div>

      <div className="transactionMiddle">
        <p className="transactionName">{invoice.item}</p>

        <p className="transactionJob">
          <strong>Job Links:</strong>{" "}
          {(!invoice.jobLinks || invoice.jobLinks.length === 0) &&
          !invoice.jobLink ? (
            <span className="noLink">
              No job link <PencilIcon onClick={goToEdit} />
            </span>
          ) : invoice.jobLinks && invoice.jobLinks.length > 0 ? (
            <>
              {invoice.jobLinks.map((link, index) => (
                <span key={index}>
                  <span className="jobLinkItem">
                    {getJobName(link.jobId)} (£
                    {Number(link.amount || 0).toFixed(2)})
                  </span>
                  {index < invoice.jobLinks.length - 1 ? "" : ""}
                </span>
              ))}
              <PencilIcon onClick={goToEdit} />
            </>
          ) : (
            <>
              {getJobName(invoice.jobLink)} <PencilIcon onClick={goToEdit} />
            </>
          )}
        </p>
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
