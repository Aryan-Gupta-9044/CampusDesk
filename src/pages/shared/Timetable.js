import React, { useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { listClasses } from "../../lib/queries/classes";
import { listSubjects } from "../../lib/queries/classes";
import { listActiveTeachersForDropdown } from "../../lib/queries/classes";
import { listTimetableForClass, listMyTimetable, addTimetableEntry, deleteTimetableEntry } from "../../lib/queries/timetable";
import { getStudent } from "../../lib/queries/students";
import { getStudentIdForParent } from "../../lib/queries/me";
import { listMyTeachingAssignments } from "../../lib/queries/attendance";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const emptyForm = { subjectId: "", teacherId: "", dayOfWeek: "1", startTime: "", endTime: "" };

function groupByDay(entries) {
  const byDay = {};
  entries.forEach((e) => {
    byDay[e.day_of_week] = byDay[e.day_of_week] || [];
    byDay[e.day_of_week].push(e);
  });
  return byDay;
}

function TimetableGrid({ entries, showTeacher, onDelete }) {
  const byDay = groupByDay(entries);
  return (
    <div className="detail-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      {DAYS.map((day, idx) => (
        <div className="panel" key={idx}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{day}</p>
            </div>
          </div>
          {(byDay[idx] || []).length === 0 ? (
            <p className="lede" style={{ padding: "16px 20px" }}>
              No periods.
            </p>
          ) : (
            (byDay[idx] || []).map((e) => (
              <div className="recent-row" key={e.id}>
                <span className="student-summary">
                  <strong>{e.subjects?.name}</strong>
                  <small>
                    {e.start_time} – {e.end_time}
                    {showTeacher && e.teachers?.profiles?.full_name ? ` · ${e.teachers.profiles.full_name}` : ""}
                    {!showTeacher && e.classes ? ` · ${e.classes.name}-${e.classes.section}` : ""}
                  </small>
                </span>
                {onDelete && (
                  <button className="delete-button" type="button" onClick={() => onDelete(e.id)} title="Delete">
                    ×
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function AdminTimetable() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    listClasses().then(setClasses).catch((err) => setError(err.message));
    listActiveTeachersForDropdown().then(setTeachers).catch(() => {});
  }, []);

  const load = (id) => {
    listTimetableForClass(id).then(setEntries).catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (classId) {
      listSubjects(classId).then(setSubjects).catch(() => {});
      load(classId);
    } else {
      setSubjects([]);
      setEntries([]);
    }
  }, [classId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.subjectId || !form.startTime || !form.endTime) {
      setError("Subject, start time, and end time are required.");
      return;
    }
    setError("");
    try {
      await addTimetableEntry({ ...form, classId });
      setForm(emptyForm);
      load(classId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this period?")) return;
    try {
      await deleteTimetableEntry(id);
      load(classId);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Academics</p>
          <h1>Timetable</h1>
          <p className="lede">Build a weekly schedule per class.</p>
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
        <p className="lede">Pick a class to view and edit its timetable.</p>
      ) : (
        <>
          <form onSubmit={handleAdd} className="student-form">
            <p className="eyebrow">Add a period</p>
            <div className="form-grid">
              <label>
                Subject
                <select name="subjectId" value={form.subjectId} onChange={handleChange} required>
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Teacher
                <select name="teacherId" value={form.teacherId} onChange={handleChange}>
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.profiles?.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Day
                <select name="dayOfWeek" value={form.dayOfWeek} onChange={handleChange}>
                  {DAYS.map((d, idx) => (
                    <option key={idx} value={idx}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start time
                <input type="time" name="startTime" value={form.startTime} onChange={handleChange} required />
              </label>
              <label>
                End time
                <input type="time" name="endTime" value={form.endTime} onChange={handleChange} required />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="button primary-button">
                Add period
              </button>
            </div>
          </form>

          <div style={{ marginTop: "20px" }}>
            <TimetableGrid entries={entries} showTeacher onDelete={handleDelete} />
          </div>
        </>
      )}
    </div>
  );
}

function TeacherTimetable({ teacherId }) {
  const [entries, setEntries] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ assignment: "", dayOfWeek: "1", startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    listMyTimetable(teacherId)
      .then(setEntries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    listMyTeachingAssignments(teacherId).then(setAssignments).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.assignment || !form.startTime || !form.endTime) {
      setError("Pick a class/subject, start time, and end time.");
      return;
    }
    const [classId, subjectId] = form.assignment.split("::");
    setSaving(true);
    setError("");
    try {
      await addTimetableEntry({
        classId,
        subjectId,
        teacherId,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
      });
      setForm({ assignment: "", dayOfWeek: "1", startTime: "", endTime: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this period?")) return;
    try {
      await deleteTimetableEntry(id);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Academics</p>
          <h1>My timetable</h1>
          <p className="lede">Add periods for the classes and subjects you teach.</p>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}

      <form onSubmit={handleAdd} className="student-form">
        <p className="eyebrow">Add a period</p>
        <div className="form-grid">
          <label>
            Class & subject
            <select name="assignment" value={form.assignment} onChange={handleChange} required>
              <option value="">Select</option>
              {assignments.map((a) => (
                <option key={a.id} value={`${a.class_id}::${a.subject_id}`}>
                  {a.classes?.name}-{a.classes?.section} · {a.subjects?.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Day
            <select name="dayOfWeek" value={form.dayOfWeek} onChange={handleChange}>
              {DAYS.map((d, idx) => (
                <option key={idx} value={idx}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start time
            <input type="time" name="startTime" value={form.startTime} onChange={handleChange} required />
          </label>
          <label>
            End time
            <input type="time" name="endTime" value={form.endTime} onChange={handleChange} required />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="button primary-button" disabled={saving}>
            {saving ? "Adding…" : "Add period"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: "20px" }}>
        {loading ? <p className="lede">Loading…</p> : <TimetableGrid entries={entries} showTeacher={false} onDelete={handleDelete} />}
      </div>
    </div>
  );
}

function StudentTimetable({ studentId, heading }) {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      try {
        const student = await getStudent(studentId);
        if (!student.class_id) {
          setEntries([]);
          return;
        }
        const data = await listTimetableForClass(student.class_id);
        setEntries(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Academics</p>
          <h1>{heading}</h1>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      {loading ? <p className="lede">Loading…</p> : <TimetableGrid entries={entries} showTeacher />}
    </div>
  );
}

function Timetable() {
  const { role, user } = useAuth();
  const [linkedStudentId, setLinkedStudentId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role === "parent") {
      getStudentIdForParent(user.id).then(setLinkedStudentId).catch((err) => setError(err.message));
    }
  }, [role, user]);

  if (role === "admin") return <AdminTimetable />;
  if (role === "teacher") return <TeacherTimetable teacherId={user.id} />;
  if (role === "student") return <StudentTimetable studentId={user.id} heading="My timetable" />;
  if (role === "parent") {
    if (error) return <p className="form-error page">{error}</p>;
    if (!linkedStudentId)
      return (
        <div className="page">
          <p className="lede">Not linked to a child's account yet. Ask your school's administrator to set the link.</p>
        </div>
      );
    return <StudentTimetable studentId={linkedStudentId} heading="Child's timetable" />;
  }
  return null;
}

export default Timetable;
