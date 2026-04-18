import TransactionBox from "./TransactionBox";
import SideBarButton from "./SideBarButton";

function Invoices({ invoices, navigate, jobs, deleteInvoice }) {
  const sortedInvoices = [...invoices].sort((a, b) => {
    const dateA = a.dateIssued ? new Date(a.dateIssued) : 0;
    const dateB = b.dateIssued ? new Date(b.dateIssued) : 0;

    return dateB - dateA; // newest first
  });

  const listItems = sortedInvoices.map((invoice) => (
    <TransactionBox
      key={invoice.id}
      invoice={invoice}
      navigate={navigate}
      deleteInvoice={deleteInvoice}
      jobs={jobs}
    />
  ));

  return (
    <>
      <div>
        <SideBarButton
          label="Log Invoice"
          component="LogInvoice"
          navigate={navigate}
        />
      </div>
      <div className="transactionList">{listItems}</div>
    </>
  );
}

export default Invoices;
