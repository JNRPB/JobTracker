import { useEffect, useMemo, useState } from "react";
import "./TodoPage.css";
import { getJobColour } from "./jobColour";

function getTodos(job) {
  return Array.isArray(job?.todos) ? job.todos : [];
}

function getOpenTodos(job) {
  return getTodos(job).filter((todo) => !todo?.completed);
}

function makeTodoId(jobId) {
  return `todo-${jobId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function TodoPage({
  jobs = [],
  navigate,
  onUpdate,
  initialJobId,
}) {
  const [search, setSearch] = useState("");
  const [collapsedJobs, setCollapsedJobs] = useState({});
  const [showClearJobs, setShowClearJobs] = useState(false);
  const [addingJobId, setAddingJobId] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftHigh, setDraftHigh] = useState(false);
  const [savingJobId, setSavingJobId] = useState("");
  const [pageMessage, setPageMessage] = useState("");

  const activeJobs = useMemo(
    () => jobs.filter((job) => !job?.archived),
    [jobs],
  );

  const jobModels = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activeJobs
      .map((job) => {
        const todos = getOpenTodos(job);
        const highCount = todos.filter((todo) => todo.highImportance).length;
        return { job, todos, highCount };
      })
      .filter(({ job, todos }) => {
        if (!query) return true;

        return [
          job.name,
          job.address,
          job.clientName,
          job.client,
          ...todos.map((todo) => todo.text),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort(
        (a, b) =>
          b.highCount - a.highCount ||
          b.todos.length - a.todos.length ||
          String(a.job.name || "").localeCompare(String(b.job.name || "")),
      );
  }, [activeJobs, search]);

  const jobsWithTodos = jobModels.filter((model) => model.todos.length > 0);
  const clearJobs = jobModels.filter((model) => model.todos.length === 0);
  const totalTodos = activeJobs.reduce(
    (sum, job) => sum + getOpenTodos(job).length,
    0,
  );
  const highPriorityTodos = activeJobs.reduce(
    (sum, job) =>
      sum + getOpenTodos(job).filter((todo) => todo.highImportance).length,
    0,
  );
  const jobsNeedingAction = activeJobs.filter(
    (job) => getOpenTodos(job).length > 0,
  ).length;

  useEffect(() => {
    if (!initialJobId) return;

    const targetId = String(initialJobId);
    const targetJob = activeJobs.find(
      (job) => String(job.id) === targetId,
    );

    setCollapsedJobs((current) => ({ ...current, [targetId]: false }));

    if (targetJob && getOpenTodos(targetJob).length === 0) {
      setShowClearJobs(true);
      setAddingJobId(targetId);
      setDraftText("");
      setDraftHigh(false);
    }

    window.setTimeout(() => {
      document
        .getElementById(`todo-job-${targetId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(`todo-input-${targetId}`)?.focus();
    }, 120);
  }, [initialJobId]);

  async function saveTodos(job, todos, successMessage) {
    if (typeof onUpdate !== "function" || savingJobId) return false;

    setSavingJobId(String(job.id));
    setPageMessage("Saving TODOs...");

    try {
      await onUpdate({
        ...job,
        todos,
        updatedAt: new Date().toISOString(),
      });
      setPageMessage(successMessage);
      return true;
    } catch (error) {
      console.error("Could not save TODOs:", error);
      setPageMessage("Could not save that change.");
      return false;
    } finally {
      setSavingJobId("");
    }
  }

  function beginAdd(jobId) {
    const id = String(jobId);
    setAddingJobId(id);
    setDraftText("");
    setDraftHigh(false);
    setPageMessage("");
    setCollapsedJobs((current) => ({ ...current, [id]: false }));
    setShowClearJobs(true);

    window.setTimeout(() => {
      document.getElementById(`todo-input-${id}`)?.focus();
    }, 80);
  }

  function cancelAdd() {
    setAddingJobId("");
    setDraftText("");
    setDraftHigh(false);
  }

  async function addTodo(job) {
    const text = draftText.trim();
    if (!text) {
      setPageMessage("Write the action before adding it.");
      return;
    }

    const nextTodo = {
      id: makeTodoId(job.id),
      text,
      highImportance: draftHigh,
      completed: false,
    };

    const saved = await saveTodos(
      job,
      [...getTodos(job), nextTodo],
      "TODO added.",
    );

    if (saved) cancelAdd();
  }

  async function completeTodo(job, todoId) {
    await saveTodos(
      job,
      getTodos(job).map((todo) =>
        String(todo.id) === String(todoId)
          ? { ...todo, completed: true }
          : todo,
      ),
      "TODO completed.",
    );
  }

  async function toggleImportance(job, todoId) {
    await saveTodos(
      job,
      getTodos(job).map((todo) =>
        String(todo.id) === String(todoId)
          ? { ...todo, highImportance: !todo.highImportance }
          : todo,
      ),
      "Importance updated.",
    );
  }

  async function deleteTodo(job, todoId) {
    await saveTodos(
      job,
      getTodos(job).filter((todo) => String(todo.id) !== String(todoId)),
      "TODO deleted.",
    );
  }

  function toggleJob(jobId) {
    const id = String(jobId);
    setCollapsedJobs((current) => ({
      ...current,
      [id]: !current[id],
    }));
  }

  function renderAddForm(job) {
    if (addingJobId !== String(job.id)) return null;

    return (
      <form
        className="todo-add-form"
        onSubmit={(event) => {
          event.preventDefault();
          addTodo(job);
        }}
      >
        <input
          id={`todo-input-${job.id}`}
          type="text"
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          placeholder="What needs doing on this job?"
          maxLength={240}
        />
        <label className={`todo-high-toggle ${draftHigh ? "active" : ""}`}>
          <input
            type="checkbox"
            checked={draftHigh}
            onChange={(event) => setDraftHigh(event.target.checked)}
          />
          <span aria-hidden="true">★</span>
          High importance
        </label>
        <button
          type="submit"
          className="todo-primary-button"
          disabled={savingJobId === String(job.id)}
        >
          {savingJobId === String(job.id) ? "Saving..." : "Add TODO"}
        </button>
        <button type="button" className="todo-quiet-button" onClick={cancelAdd}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <main className="todo-page">
      <header className="todo-page-header">
        <div>
          <span className="todo-kicker">JNR action board</span>
          <h1>TODOs</h1>
          <p>Simple, actionable jobs that still need your attention.</p>
        </div>

        <div className="todo-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search jobs or TODOs..."
          />
        </div>
      </header>

      <section className="todo-summary-strip" aria-label="TODO summary">
        <div className="todo-summary-item primary">
          <span>Outstanding</span>
          <strong>{totalTodos}</strong>
        </div>
        <div className="todo-summary-item urgent">
          <span>High importance</span>
          <strong>{highPriorityTodos}</strong>
        </div>
        <div className="todo-summary-item">
          <span>Jobs needing action</span>
          <strong>{jobsNeedingAction}</strong>
        </div>
        <div className="todo-summary-item clear">
          <span>Jobs all clear</span>
          <strong>{Math.max(activeJobs.length - jobsNeedingAction, 0)}</strong>
        </div>
      </section>

      {pageMessage && (
        <div
          className={`todo-page-message ${pageMessage.startsWith("Could not") ? "error" : ""}`}
          role="status"
        >
          {pageMessage}
        </div>
      )}

      <div className="todo-job-groups">
        {jobsWithTodos.length ? (
          jobsWithTodos.map(({ job, todos, highCount }) => {
            const jobId = String(job.id);
            const isCollapsed = collapsedJobs[jobId] === true;

            return (
              <section
                className={`todo-job-group ${highCount ? "has-high" : ""}`}
                id={`todo-job-${jobId}`}
                style={{ "--job-colour": getJobColour(job) }}
                key={job.id}
              >
                <div className="todo-job-header">
                  <button
                    type="button"
                    className="todo-job-toggle"
                    onClick={() => toggleJob(job.id)}
                  >
                    <span className="todo-job-colour" />
                    <span className="todo-job-title">
                      <strong>{job.name || "Unnamed job"}</strong>
                      <small>{job.address || "No address saved"}</small>
                    </span>
                    <span className="todo-job-count">{todos.length}</span>
                    {highCount > 0 && (
                      <span className="todo-job-high">★ {highCount} high</span>
                    )}
                    <span className={`todo-chevron ${isCollapsed ? "collapsed" : ""}`}>⌃</span>
                  </button>

                  <div className="todo-job-actions">
                    <button
                      type="button"
                      className="todo-quiet-button"
                      onClick={() => navigate?.("JobCard", { jobId: job.id })}
                    >
                      Open job
                    </button>
                    <button
                      type="button"
                      className="todo-primary-button"
                      onClick={() => beginAdd(job.id)}
                    >
                      + Add TODO
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="todo-job-body">
                    {renderAddForm(job)}
                    <div className="todo-list">
                      {todos.map((todo) => (
                        <article
                          className={`todo-item ${todo.highImportance ? "high" : ""}`}
                          key={todo.id}
                        >
                          <button
                            type="button"
                            className="todo-complete-button"
                            onClick={() => completeTodo(job, todo.id)}
                            disabled={savingJobId === jobId}
                            title="Mark complete"
                            aria-label={`Complete ${todo.text}`}
                          >
                            ✓
                          </button>
                          <p>{todo.text}</p>
                          <button
                            type="button"
                            className={`todo-importance-button ${todo.highImportance ? "active" : ""}`}
                            onClick={() => toggleImportance(job, todo.id)}
                            disabled={savingJobId === jobId}
                            title={todo.highImportance ? "Remove high importance" : "Mark high importance"}
                          >
                            ★ <span>{todo.highImportance ? "High" : "Make high"}</span>
                          </button>
                          <button
                            type="button"
                            className="todo-delete-button"
                            onClick={() => deleteTodo(job, todo.id)}
                            disabled={savingJobId === jobId}
                            title="Delete TODO"
                            aria-label={`Delete ${todo.text}`}
                          >
                            ×
                          </button>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })
        ) : (
          <section className="todo-empty-state">
            <span>✓</span>
            <h2>{search ? "No matching TODOs" : "Everything is clear"}</h2>
            <p>
              {search
                ? "Try a different job name or search term."
                : "Add the next action from one of the jobs below."}
            </p>
          </section>
        )}

        {clearJobs.length > 0 && (
          <section className="todo-clear-group">
            <button
              type="button"
              className="todo-clear-header"
              onClick={() => setShowClearJobs((current) => !current)}
            >
              <span>
                <strong>No active TODOs</strong>
                <small>{clearJobs.length} job{clearJobs.length === 1 ? "" : "s"} hidden</small>
              </span>
              <span className={`todo-chevron ${!showClearJobs ? "collapsed" : ""}`}>⌃</span>
            </button>

            {showClearJobs && (
              <div className="todo-clear-list">
                {clearJobs.map(({ job }) => (
                  <article
                    id={`todo-job-${job.id}`}
                    className="todo-clear-job"
                    style={{ "--job-colour": getJobColour(job) }}
                    key={job.id}
                  >
                    <span className="todo-job-colour" />
                    <span className="todo-job-title">
                      <strong>{job.name || "Unnamed job"}</strong>
                      <small>{job.address || "No address saved"}</small>
                    </span>
                    <span className="todo-all-clear">✓ All clear</span>
                    <button
                      type="button"
                      className="todo-quiet-button"
                      onClick={() => navigate?.("JobCard", { jobId: job.id })}
                    >
                      Open job
                    </button>
                    <button
                      type="button"
                      className="todo-primary-button"
                      onClick={() => beginAdd(job.id)}
                    >
                      + Add TODO
                    </button>
                    {renderAddForm(job)}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
