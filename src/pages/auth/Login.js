import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from?.pathname || "/";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(form);
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="page form-page auth-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1>Log in to CampusDesk</h1>
          <p className="lede">Enter your credentials to reach your dashboard.</p>
        </div>
      </section>

      <form className="student-form" onSubmit={handleSubmit}>
        {error && <p className="form-error">{error}</p>}
        <div className="form-grid">
          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </label>
        </div>
        <p style={{ marginTop: "-8px" }}>
          <Link className="text-link" to="/forgot-password">
            Forgot password?
          </Link>
        </p>
        <div className="form-actions">
          <Link className="button secondary-button" to="/signup">
            Create account
          </Link>
          <button className="button primary-button" type="submit" disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default Login;
