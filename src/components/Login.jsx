import { useState } from "react";
import logo from "../assets/logo.png";
import "./Login.css";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Login failed.");
      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Could not log in.");
    } finally {
      setSubmitting(false);
    }
  }

  function detectCapsLock(event) {
    setCapsLock(event.getModifierState?.("CapsLock") === true);
  }

  return (
    <main className="hqLoginPage">
      <div className="hqLoginGlow" />
      <section className="hqLoginShell">
        <div className="hqLoginBrandPanel">
          <div className="hqLoginBrandTop">
            <img className="hqLoginLogo" src={logo} alt="JNR Plastering & Building" />
            <div>
              <span className="hqLoginKicker">JNR Plastering & Building</span>
              <h1>JNR HQ</h1>
              <p>Operations dashboard</p>
            </div>
          </div>

          <div className="hqLoginSquares" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => <i key={index} />)}
          </div>

          <div className="hqLoginSecureBadge">
            <span className="hqLoginStatusDot" />
            Secure private system
          </div>
        </div>

        <div className="hqLoginFormPanel">
          <div className="hqLoginFormHeading">
            <span>Authorised access</span>
            <h2>Welcome back</h2>
            <p>Sign in to jobs, files and business operations.</p>
          </div>

          {error && <div className="hqLoginError">{error}</div>}

          <form onSubmit={handleSubmit} className="hqLoginForm">
            <label>
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </label>

            <label>
              <span>Password</span>
              <div className="hqLoginPasswordField">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={detectCapsLock}
                  onKeyUp={detectCapsLock}
                  autoComplete="current-password"
                  required
                />
                <button type="button" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {capsLock && <small className="hqLoginCapsWarning">Caps Lock is on</small>}
            </label>

            <button className="hqLoginSubmit" type="submit" disabled={submitting}>
              {submitting ? <><span className="hqLoginSpinner" /> Signing in…</> : "Sign in to HQ"}
            </button>
          </form>

          <p className="hqLoginFootnote">Internal JNR system · Unauthorised access is prohibited</p>
        </div>
      </section>
    </main>
  );
}

export default Login;
