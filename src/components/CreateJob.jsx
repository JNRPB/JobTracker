import { useState } from "react";

function CreateJob({ addJob, navigate }) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    status: "Lead",
  });

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();

    const newJob = {
      id: Date.now(),
      name: formData.name,
      address: formData.address,
      status: formData.status,
      notes: "",
      phases: [],
      actualCosts: [],
      archived: false,
      quoteTotal: 0,
      startDate: "",
    };

    addJob(newJob);

    navigate("JobCard", { jobId: newJob.id });

    setFormData({
      name: "",
      address: "",
      status: "Lead",
    });
  }

  return (
    <div className="create-job-page">
      <h1>Create Job</h1>

      <form className="create-job-form" onSubmit={handleSubmit}>
        <input
          name="name"
          placeholder="Job name"
          value={formData.name}
          onChange={handleChange}
          required
        />

        <input
          name="address"
          placeholder="Address"
          value={formData.address}
          onChange={handleChange}
        />

        <select name="status" value={formData.status} onChange={handleChange}>
          <option value="Lead">Lead</option>
          <option value="Contacted">Contacted</option>
          <option value="To-Quote">To-Quote</option>
          <option value="Quoted">Quoted</option>
          <option value="Approved">Approved</option>
          <option value="Booked">Booked</option>
        </select>

        <button type="submit">Create Job</button>
      </form>
    </div>
  );
}

export default CreateJob;
