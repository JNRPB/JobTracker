import { useState } from "react";

function CreateJob({ addJob }) {
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    notes: "",
    status: "Pending",
  });

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();

    const newJob = { id: Date.now(), ...formData };
    addJob(newJob);

    setFormData({
      name: "",
      address: "",
      notes: "",
      status: "Pending",
    });
  }
  return (
    <>
      <div>
        <h1>Home</h1>
      </div>
      <div className="bubbleBox">
        <h1>CREATE JOB</h1>

        <form onSubmit={handleSubmit}>
          <input
            name="name"
            placeholder="Job Name"
            value={formData.name}
            onChange={handleChange}
          />
          <input
            name="address"
            placeholder="Job Address"
            value={formData.address}
            onChange={handleChange}
          />
          <textarea
            name="notes"
            placeholder="Job Notes"
            value={formData.notes}
            onChange={handleChange}
          />
          <select name="status" value={formData.status} onChange={handleChange}>
            <option>Pending</option>
            <option>In Progress</option>
            <option>Complete</option>
          </select>
          <button type="submit">Add Job</button>
        </form>
      </div>
    </>
  );
}

export default CreateJob;
