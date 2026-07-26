import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "jnr_month_calendar_v2";

const pad = (n) => String(n).padStart(2, "0");

const toLocalISO = (date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const fromLocalISO = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const today = () => toLocalISO(new Date());

const addDays = (dateStr, days) => {
  const d = fromLocalISO(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
};

const startOfMonthGrid = (date) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return start;
};

const monthTitle = (date) =>
  date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

const colours = [
  "#7c83e6",
  "#75e6a0",
  "#ffd36a",
  "#ff8c8c",
  "#c084fc",
  "#58a6ff",
];

export default function ForecastPage({ jobs }) {
  const [viewDate, setViewDate] = useState(new Date());
  const [items, setItems] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    fetch("/jobs")
      .then((res) => res.json())
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch(() => setJobs([]));

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setItems(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const days = useMemo(() => {
    const start = startOfMonthGrid(viewDate);

    return Array.from({ length: 42 }, (_, index) => {
      const d = new Date(start);
      d.setDate(start.getDate() + index);
      return toLocalISO(d);
    });
  }, [viewDate]);

  const changeMonth = (amount) => {
    setViewDate(
      new Date(viewDate.getFullYear(), viewDate.getMonth() + amount, 1),
    );
  };

  const openNewItem = (date) => {
    setModal({
      id: null,
      date,
      jobId: jobs[0]?.id ? String(jobs[0].id) : "",
      who: "",
      task: "",
      colour: "#7c83e6",
    });
  };

  const openExistingItem = (item) => {
    setModal({ ...item });
  };

  const saveItem = () => {
    if (!modal?.task?.trim()) return;

    if (modal.id) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === modal.id
            ? {
                ...item,
                ...modal,
                task: modal.task.trim(),
              }
            : item,
        ),
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: Date.now(),
          date: modal.date,
          jobId: modal.jobId,
          who: modal.who.trim(),
          task: modal.task.trim(),
          colour: modal.colour,
        },
      ]);
    }

    setModal(null);
  };

  const deleteItem = () => {
    if (!modal?.id) return;
    setItems((prev) => prev.filter((item) => item.id !== modal.id));
    setModal(null);
  };

  const onDrop = (event, date) => {
    const id = Number(event.dataTransfer.getData("itemId"));
    if (!id) return;

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, date } : item)),
    );
  };

  const getJobName = (jobId) => {
    const job = jobs.find((j) => String(j.id) === String(jobId));
    return job?.title || job?.name || job?.customer || "";
  };

  return (
    <div className="jnr-calendar-page">
      <header className="jnr-calendar-header">
        <div>
          <p className="eyebrow">JNR Planner</p>
          <h1>This Week</h1>
          <p>Click a day to add work. Drag items when reality changes.</p>
        </div>

        <div className="calendar-controls">
          <button onClick={() => changeMonth(-1)}>Previous</button>
          <button onClick={() => setViewDate(new Date())}>Today</button>
          <button onClick={() => changeMonth(1)}>Next</button>
        </div>
      </header>

      <section className="month-bar">
        <h2>{monthTitle(viewDate)}</h2>
      </section>

      <main className="month-calendar">
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => (
          <div className="calendar-weekday" key={day}>
            {day}
          </div>
        ))}

        {days.map((day) => {
          const date = fromLocalISO(day);
          const isCurrentMonth = date.getMonth() === viewDate.getMonth();
          const isToday = day === today();
          const dayItems = items.filter((item) => item.date === day);

          return (
            <div
              key={day}
              className={`calendar-day-cell ${
                !isCurrentMonth ? "muted" : ""
              } ${isToday ? "today" : ""}`}
              onClick={() => openNewItem(day)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, day)}
            >
              <div className="calendar-date-number">{date.getDate()}</div>

              <div className="calendar-items">
                {dayItems.map((item) => (
                  <div
                    key={item.id}
                    className="calendar-event"
                    style={{ background: item.colour }}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("itemId", item.id)
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      openExistingItem(item);
                    }}
                  >
                    <strong>{item.task}</strong>

                    <span>
                      {getJobName(item.jobId)}
                      {item.who ? ` · ${item.who}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      {modal && (
        <div className="calendar-modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{modal.id ? "Edit calendar item" : "Add calendar item"}</h2>

            <label>
              Job
              <select
                value={modal.jobId}
                onChange={(event) =>
                  setModal({ ...modal, jobId: event.target.value })
                }
              >
                <option value="">No job</option>

                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title || job.name || job.customer || `Job ${job.id}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Who
              <input
                value={modal.who}
                onChange={(event) =>
                  setModal({ ...modal, who: event.target.value })
                }
                placeholder="e.g. Josh & Dale"
              />
            </label>

            <label>
              Task
              <input
                value={modal.task}
                onChange={(event) =>
                  setModal({ ...modal, task: event.target.value })
                }
                placeholder="e.g. Board walls"
              />
            </label>

            <label>
              Colour
              <input
                type="color"
                value={modal.colour}
                onChange={(event) =>
                  setModal({ ...modal, colour: event.target.value })
                }
              />
            </label>

            <div className="colour-presets">
              {colours.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  style={{ background: colour }}
                  onClick={() => setModal({ ...modal, colour })}
                  aria-label={`Set colour ${colour}`}
                />
              ))}
            </div>

            <div className="modal-actions">
              {modal.id && (
                <button className="dangerButton" onClick={deleteItem}>
                  Delete
                </button>
              )}

              <button className="ghostButton" onClick={() => setModal(null)}>
                Cancel
              </button>

              <button onClick={saveItem}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

