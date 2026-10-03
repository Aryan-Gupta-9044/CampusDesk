import React from "react";
import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Unauthorized from "./pages/auth/Unauthorized";
import Suspended from "./pages/auth/Suspended";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

import Settings from "./pages/account/Settings";

import RoleRouter from "./pages/dashboards/RoleRouter";

import AdminStudents from "./pages/admin/AdminStudents";
import AddStudent from "./pages/admin/AddStudent";
import StudentDetail from "./pages/admin/StudentDetail";
import AdminTeachers from "./pages/admin/AdminTeachers";
import AddTeacher from "./pages/admin/AddTeacher";
import TeacherDetail from "./pages/admin/TeacherDetail";
import Classes from "./pages/admin/Classes";
import StudentFullReport from "./pages/admin/StudentFullReport";
import TeacherFullReport from "./pages/admin/TeacherFullReport";
import AuditLog from "./pages/admin/AuditLog";
import Attendance from "./pages/shared/Attendance";
import ResultsRouter from "./pages/shared/ResultsRouter";
import FeesRouter from "./pages/shared/FeesRouter";
import Notices from "./pages/shared/Notices";
import Events from "./pages/shared/Events";
import LeaveRequests from "./pages/shared/LeaveRequests";
import Timetable from "./pages/shared/Timetable";
import Documents from "./pages/shared/Documents";
import ChatWithTeacher from "./pages/shared/ChatWithTeacher";
import AcademicReport from "./pages/shared/AcademicReport";
import ImportStudents from "./pages/admin/ImportStudents";
import ImportTeachers from "./pages/admin/ImportTeachers";

function App() {
  return (
    <>
      <Navbar />

      <main className="container">
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/suspended" element={<Suspended />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Any logged-in, non-suspended user lands on their role's dashboard */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleRouter />
              </ProtectedRoute>
            }
          />

          {/* Account settings — any logged-in role */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Students — admin only */}
          <Route path="/students" element={<ProtectedRoute allowedRoles={["admin"]}><AdminStudents /></ProtectedRoute>} />
          <Route path="/students/new" element={<ProtectedRoute allowedRoles={["admin"]}><AddStudent /></ProtectedRoute>} />
          <Route path="/students/import" element={<ProtectedRoute allowedRoles={["admin"]}><ImportStudents /></ProtectedRoute>} />
          <Route path="/students/:id" element={<ProtectedRoute allowedRoles={["admin"]}><StudentDetail /></ProtectedRoute>} />
          <Route path="/students/:id/report" element={<ProtectedRoute allowedRoles={["admin"]}><StudentFullReport /></ProtectedRoute>} />

          {/* Teachers — admin only */}
          <Route path="/teachers" element={<ProtectedRoute allowedRoles={["admin"]}><AdminTeachers /></ProtectedRoute>} />
          <Route path="/teachers/new" element={<ProtectedRoute allowedRoles={["admin"]}><AddTeacher /></ProtectedRoute>} />
          <Route path="/teachers/import" element={<ProtectedRoute allowedRoles={["admin"]}><ImportTeachers /></ProtectedRoute>} />
          <Route path="/teachers/:id" element={<ProtectedRoute allowedRoles={["admin"]}><TeacherDetail /></ProtectedRoute>} />
          <Route path="/teachers/:id/report" element={<ProtectedRoute allowedRoles={["admin"]}><TeacherFullReport /></ProtectedRoute>} />

          {/* Classes & subjects — admin only */}
          <Route path="/classes" element={<ProtectedRoute allowedRoles={["admin"]}><Classes /></ProtectedRoute>} />

          {/* Audit log — admin only */}
          <Route path="/audit-log" element={<ProtectedRoute allowedRoles={["admin"]}><AuditLog /></ProtectedRoute>} />

          {/* Exams & results — role-aware inside the router */}
          <Route
            path="/results"
            element={
              <ProtectedRoute allowedRoles={["admin", "teacher", "student", "parent"]}>
                <ResultsRouter />
              </ProtectedRoute>
            }
          />

          {/* Attendance — role-aware inside the page */}
          <Route
            path="/attendance"
            element={
              <ProtectedRoute allowedRoles={["admin", "teacher", "student", "parent"]}>
                <Attendance />
              </ProtectedRoute>
            }
          />

          {/* Fees — admin manages structure/payments; student/parent view status */}
          <Route
            path="/fees"
            element={
              <ProtectedRoute allowedRoles={["admin", "student", "parent"]}>
                <FeesRouter />
              </ProtectedRoute>
            }
          />

          {/* Notices & events — everyone, post capability handled inside each page */}
          <Route
            path="/notices"
            element={
              <ProtectedRoute allowedRoles={["admin", "teacher", "student", "parent"]}>
                <Notices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute allowedRoles={["admin", "teacher", "student", "parent"]}>
                <Events />
              </ProtectedRoute>
            }
          />

          {/* Leave requests — everyone, apply/approve handled inside the page */}
          <Route
            path="/leave"
            element={
              <ProtectedRoute allowedRoles={["admin", "teacher", "student", "parent"]}>
                <LeaveRequests />
              </ProtectedRoute>
            }
          />

          {/* Timetable — role-aware inside the page */}
          <Route
            path="/timetable"
            element={
              <ProtectedRoute allowedRoles={["admin", "teacher", "student", "parent"]}>
                <Timetable />
              </ProtectedRoute>
            }
          />

          {/* Documents — self-service, any logged-in role */}
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <Documents />
              </ProtectedRoute>
            }
          />

          {/* Chat with teacher — student/parent compose, teacher inbox */}
          <Route
            path="/chat"
            element={
              <ProtectedRoute allowedRoles={["teacher", "student", "parent"]}>
                <ChatWithTeacher />
              </ProtectedRoute>
            }
          />

          {/* Academic report — cumulative per-subject attendance + full marks breakdown */}
          <Route
            path="/report"
            element={
              <ProtectedRoute allowedRoles={["teacher", "student", "parent"]}>
                <AcademicReport />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </>
  );
}

export default App;
