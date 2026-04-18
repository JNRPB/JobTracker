import TransactionBox from "./TransactionBox";

const transArray = [
  {
    id: 0,
    monzoTxId: "tx_000456",
    amount: 320,
    date: "2026-04-14T10:00:03Z",
  },
  {
    id: 1,
    monzoTxId: "tx_000457",
    amount: 355,
    date: "2026-04-14T10:00:43Z",
  },
  {
    id: 2,
    monzoTxId: "tx_000458",
    amount: 3555,
    date: "2026-04-14T10:00:47Z",
  },
];

function Transactions(navigate, jobs) {
  const listItems = transArray.map((transaction) => (
    <TransactionBox key={transaction.id} transaction={transaction} />
  ));
  return <div className="transactionList">{listItems}</div>;
}

export default Transactions;
