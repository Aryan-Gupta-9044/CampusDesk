import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { listRecentActivity } from "../lib/queries/activity";

function seenKey(userId) {
  return `campusdesk-notifications-seen-${userId}`;
}

function NotificationBell() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [unseenCount, setUnseenCount] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!user) return;
    listRecentActivity(role, user.id).then((data) => {
      setItems(data);
      const lastSeen = localStorage.getItem(seenKey(user.id));
      const lastSeenTime = lastSeen ? new Date(lastSeen) : new Date(0);
      setUnseenCount(data.filter((i) => new Date(i.when) > lastSeenTime).length);
    });
  }, [user, role]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    setOpen((prev) => !prev);
    if (!open && user) {
      localStorage.setItem(seenKey(user.id), new Date().toISOString());
      setUnseenCount(0);
    }
  };

  const handleItemClick = (item) => {
    setOpen(false);
    navigate(item.link);
  };

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={handleToggle}
        className="button secondary-button"
        style={{ position: "relative", padding: "8px 12px" }}
        aria-label="Notifications"
      >
        🔔
        {unseenCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: "var(--coral)",
              color: "#fff",
              borderRadius: "50%",
              width: "16px",
              height: "16px",
              fontSize: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: "300px",
            maxHeight: "400px",
            overflowY: "auto",
            background: "#fff",
            border: "1px solid var(--line)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 20,
          }}
        >
          <p className="eyebrow" style={{ padding: "12px 16px 0" }}>
            Recent activity
          </p>
          {items.length === 0 ? (
            <p className="lede" style={{ padding: "12px 16px 16px" }}>
              Nothing new.
            </p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 16px",
                  borderTop: "1px solid var(--line)",
                  background: "transparent",
                  border: 0,
                  borderTopStyle: "solid",
                  cursor: "pointer",
                }}
              >
                <small style={{ color: "var(--muted)", textTransform: "uppercase", fontSize: "10px" }}>{item.type}</small>
                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#1d3547" }}>{item.title}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
