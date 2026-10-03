import React, { useEffect, useState } from "react";

import { listClasses } from "../../lib/queries/classes";
import {
  listExamsForClass,
  createExam,
  deleteExam,
  computeAndPublishResults,
  listResultsForExam,
} from "../../lib/queries/exams";
import { logAction } from "../../lib/queries/audit";
import { useAuth } from "../../context/AuthContext";

const emptyExamForm = { name: "", term: "", startDate: "", endDate: "" };

function AdminExams() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [exams, setExams] = useState([]);
  const [examForm, setExamForm] = useState(emptyExamForm);
  const [error, setError] = useState("");
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [results, setResults] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    listClasses().then(setClasses).catch((err) => setError(err.message));
  }, []);

  const loadExams = async (id) => {
    try {
      const data = await listExamsForClass(id);
      setExams(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (classId) loadExams(classId);
    else setExams([]);
    setSelectedExamId(null);
    setResults([]);
  }, [classId]);

  const handleExamChange = (event) => {
    const { name, value } = event.target;
    setExamForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateExam = async (event) => {
    event.preventDefault();
    if (!examForm.name.trim() || !classId) {
      setError("Pick a class and give the exam a name.");
      return;
    }
    setError("");
    try {
      await createExam({ ...examForm, classId });
      setExamForm(emptyExamForm);
      await loadExams(classId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteExam = async (exam) => {
    if (!window.confirm(`Delete exam "${exam.name}"? This removes its marks and results too.`)) return;
    try {
      await deleteExam(exam.id);
      if (selectedExamId === exam.id) setSelectedExamId(null);
      await loadExams(classId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSelectExam = async (examId) => {
    setSelectedExamId(examId);
    setResultsLoading(true);
    try {
      const data = await listResultsForExam(examId);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setResultsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm("Compute totals and publish results for this exam? This overwrites any previous results.")) return;
    setPublishing(true);
    setError("");
    try {
      await computeAndPublishResults(selectedExamId, classId);
      await logAction(user.id, "publish_results", "exams", selectedExamId, {});
      const data = await listResultsForExam(selectedExamId);
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Academics</p>
          <h1>Exams & results</h1>
          <p className="lede">Create exams per class, then publish computed results once marks are in.</p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="toolbar">
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Select a class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}-{c.section}
            </option>
          ))}
        </select>
      </div>

      {!classId ? (
        <p className="lede">Pick a class to see and create exams.</p>
      ) : (
        <div className="detail-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Exams</p>
                <h2>{exams.length} for this class</h2>
              </div>
            </div>
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="recent-row"
                style={{ cursor: "pointer", background: selectedExamId === exam.id ? "#f6f7f5" : "transparent" }}
                onClick={() => handleSelectExam(exam.id)}
              >
                <span className="student-summary">
                  <strong>{exam.name}</strong>
                  <small>
                    {exam.term} · {exam.start_date || "no date"} → {exam.end_date || "—"}
                  </small>
                </span>
                <button
                  className="delete-button"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteExam(exam);
                  }}
                  title="Delete exam"
                >
                  ×
                </button>
              </div>
            ))}

            <form onSubmit={handleCreateExam} className="student-form" style={{ boxShadow: "none", borderTop: "1px solid var(--line)" }}>
              <p className="eyebrow" style={{ marginTop: "10px" }}>
                New exam
              </p>
              <div className="form-grid">
                <label>
                  Name
                  <input name="name" placeholder="e.g. Mid Term" value={examForm.name} onChange={handleExamChange} required />
                </label>
                <label>
                  Term
                  <input name="term" placeholder="e.g. Term 1" value={examForm.term} onChange={handleExamChange} />
                </label>
                <label>
                  Start date
                  <input type="date" name="startDate" value={examForm.startDate} onChange={handleExamChange} />
                </label>
                <label>
                  End date
                  <input type="date" name="endDate" value={examForm.endDate} onChange={handleExamChange} />
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="button primary-button">
                  Create exam
                </button>
              </div>
            </form>
          </div>

          <div className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Results</p>
                <h2>{selectedExamId ? "Ranked" : "Select an exam"}</h2>
              </div>
              {selectedExamId && (
                <button className="button primary-button" type="button" onClick={handlePublish} disabled={publishing}>
                  {publishing ? "Publishing…" : "Compute & publish"}
                </button>
              )}
            </div>
            {!selectedExamId ? (
              <p className="lede" style={{ padding: "20px 26px" }}>
                Click an exam on the left, then publish once marks are entered by teachers.
              </p>
            ) : resultsLoading ? (
              <p className="lede" style={{ padding: "20px 26px" }}>
                Loading…
              </p>
            ) : results.length === 0 ? (
              <p className="lede" style={{ padding: "20px 26px" }}>
                No results published yet for this exam.
              </p>
            ) : (
              results.map((r) => (
                <div className="recent-row" key={r.id}>
                  <span className="student-summary">
                    <strong>
                      #{r.rank} {r.students?.profiles?.full_name}
                    </strong>
                    <small>Roll no. {r.students?.roll_no || "—"}</small>
                  </span>
                  <span className="course-cell">
                    <strong>{r.percentage}%</strong>
                    <small>Grade {r.grade}</small>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminExams;
