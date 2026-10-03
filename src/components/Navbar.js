import React from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import RoleStamp from "./RoleStamp";
import NotificationBell from "./NotificationBell";

function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <Link className="brand" to="/">
        <span className="brand-mark">C</span>
        <span>
          CampusDesk
          <small>Student records, simplified</small>
        </span>
      </Link>

      <div className="nav-links">
        {user && <NavLink to="/">Dashboard</NavLink>}
        {profile?.role === "admin" && (
          <>
            <NavLink to="/students">Students</NavLink>
            <NavLink to="/teachers">Teachers</NavLink>
            <NavLink to="/classes">Classes</NavLink>
            <NavLink to="/attendance">Attendance</NavLink>
            <NavLink to="/results">Exams</NavLink>
            <NavLink to="/timetable">Timetable</NavLink>
            <NavLink to="/fees">Fees</NavLink>
            <NavLink to="/notices">Notices</NavLink>
            <NavLink to="/events">Events</NavLink>
            <NavLink to="/leave">Leave</NavLink>
            <NavLink to="/audit-log">Audit</NavLink>
          </>
        )}
        {profile?.role === "teacher" && (
          <>
            <NavLink to="/attendance">Attendance</NavLink>
            <NavLink to="/results">Marks</NavLink>
            <NavLink to="/report">Report</NavLink>
            <NavLink to="/timetable">Timetable</NavLink>
            <NavLink to="/notices">Notices</NavLink>
            <NavLink to="/events">Events</NavLink>
            <NavLink to="/leave">Leave</NavLink>
            <NavLink to="/chat">Queries</NavLink>
          </>
        )}
        {(profile?.role === "student" || profile?.role === "parent") && (
          <>
            <NavLink to="/attendance">Attendance</NavLink>
            <NavLink to="/results">Results</NavLink>
            <NavLink to="/report">Report</NavLink>
            <NavLink to="/timetable">Timetable</NavLink>
            <NavLink to="/fees">Fees</NavLink>
            <NavLink to="/notices">Notices</NavLink>
            <NavLink to="/events">Events</NavLink>
            {profile?.role === "student" && <NavLink to="/leave">Leave</NavLink>}
            <NavLink to="/chat">Chat</NavLink>
          </>
        )}
        {user && <NavLink to="/documents">Documents</NavLink>}
      </div>

      {user ? (
        <div className="nav-user">
          <NotificationBell />
          {profile?.avatar_url && (
            <img
              src={profile.avatar_url}
              alt=""
              style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }}
            />
          )}
          <RoleStamp role={profile?.role || "…"} size="sm" />
          <Link className="nav-user-name" to="/settings" style={{ textDecoration: "none" }}>
            {profile?.full_name || user.email}
          </Link>
          <button className="button secondary-button" onClick={handleLogout} type="button">
            Log out
          </button>
        </div>
      ) : (
        <Link className="nav-action" to="/login">
          Log in
        </Link>
      )}
    </nav>
  );
}

export default Navbar;
