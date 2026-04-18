import { useState, useEffect } from "react";

import Headbar from "./components/Headbar";
import Main from "./components/Main";

function App() {
  const [activeComponent, setActiveComponent] = useState("WelcomeScreen");
  const [navData, setNavData] = useState({});
  const [jobs, setJobs] = useState([]); // start empty
  const [invoices, setInvoices] = useState([]);

  // Navigation Function

  function navigate(screen, data = {}) {
    setActiveComponent(screen);
    setNavData(data);
  }

  // Fetch jobs from loft PC Node server
  useEffect(() => {
    fetch("http://192.168.0.22:3001/jobs") // Node server endpoint
      .then((res) => res.json())
      .then((data) => setJobs(data))
      .catch((err) => console.error("Error fetching jobs:", err));
  }, []);

  // Fetch invoices from loft PC Node server
  useEffect(() => {
    fetch("http://192.168.0.22:3001/invoices")
      .then((res) => res.json())
      .then((data) => setInvoices(data))
      .catch((err) => console.error("Error fetching invoices:", err));
  }, []);

  // Add Job to Server
  async function addJob(newJob) {
    try {
      const res = await fetch("http://192.168.0.22:3001/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newJob),
      });

      const savedJob = await res.json();

      const updatedJobs = [...jobs, savedJob];
      setJobs(updatedJobs);
      localStorage.setItem("jobs", JSON.stringify(updatedJobs));
    } catch (err) {
      console.error("Failed to create job:", err);
    }
  }

  // add invoice to server
  async function addInvoice(newInvoice) {
    try {
      const res = await fetch("http://192.168.0.22:3001/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newInvoice),
      });

      const savedInvoice = await res.json();

      const updatedInvoices = [...invoices, savedInvoice];
      setInvoices(updatedInvoices);
      localStorage.setItem("invoices", JSON.stringify(updatedInvoices));
    } catch (err) {
      console.error("Failed to create invoice:", err);
    }
  }

  async function updateInvoice(updatedInvoice) {
    try {
      const res = await fetch(
        `http://192.168.0.22:3001/invoices/${updatedInvoice.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updatedInvoice),
        },
      );

      const savedInvoice = await res.json();

      const updatedInvoices = invoices.map((inv) =>
        inv.id === savedInvoice.id ? savedInvoice : inv,
      );

      setInvoices(updatedInvoices);
      localStorage.setItem("invoices", JSON.stringify(updatedInvoices));
    } catch (err) {
      console.error("Failed to update invoice:", err);
    }
  }

  async function deleteInvoice(invoiceId) {
    try {
      const res = await fetch(
        `http://192.168.0.22:3001/invoices/${invoiceId}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to delete invoice:", text);
        return;
      }

      const updatedInvoices = invoices.filter((inv) => inv.id !== invoiceId);
      setInvoices(updatedInvoices);
      localStorage.setItem("invoices", JSON.stringify(updatedInvoices));
    } catch (err) {
      console.error("Failed to delete invoice:", err);
    }
  }

  // Unified function to update jobs in state and localStorage (optional)
  function updateJobs(updatedJobs) {
    setJobs(updatedJobs);
    localStorage.setItem("jobs", JSON.stringify(updatedJobs)); // optional backup
  }

  return (
    <div className="app-container">
      <Headbar navigate={navigate} />
      <Main
        activeComponent={activeComponent}
        addJob={addJob}
        jobs={jobs}
        navData={navData}
        setJobs={updateJobs}
        navigate={navigate}
        addInvoice={addInvoice}
        invoices={invoices}
        updateInvoice={updateInvoice}
        deleteInvoice={deleteInvoice}
      />
      <h1>
        Active Screen is : {activeComponent} and Nav Data is:
        {JSON.stringify(navData)}
      </h1>
    </div>
  );
}

export default App;
