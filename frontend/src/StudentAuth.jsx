
import { useEffect, useState } from "react";
import axios from "axios";
import "./StudentAuth.css";

const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export default function StudentAuth({ onLogin, onClose }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleResendCode() {
    if (resendCooldown > 0 || loading) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const endpoint =
        mode === "reset"
          ? `${API_BASE}/api/student-auth/forgot-password`
          : `${API_BASE}/api/student-auth/resend-verification`;
      const response = await axios.post(endpoint, {
        email: email.trim().toLowerCase(),
      });
      setNotice(response.data.message || "A new 6-digit code was sent to your SRM email.");
      setResendCooldown(30);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not resend code. Please wait a moment."
      );
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      if (mode === "register") {
        const response = await axios.post(
          `${API_BASE}/api/student-auth/register`,
          { email: email.trim().toLowerCase(), username: username.trim(), password }
        );

        setMode("verify");
        setNotice(response.data.message || "Check your SRM email for the verification code.");
      } else if (mode === "verify") {
        const response = await axios.post(
          `${API_BASE}/api/student-auth/verify-email`,
          { email: email.trim().toLowerCase(), code: code.trim() }
        );

        setMode("login");
        setNotice(response.data.message || "Email verified. You can now sign in.");
        setPassword("");
        setCode("");
      } else if (mode === "forgot") {
        const response = await axios.post(
          `${API_BASE}/api/student-auth/forgot-password`,
          { email: email.trim().toLowerCase() }
        );

        setMode("reset");
        setNotice(response.data.message || "Check your SRM email for the 6-digit reset code.");
        setCode("");
        setPassword("");
      } else if (mode === "reset") {
        const response = await axios.post(
          `${API_BASE}/api/student-auth/reset-password`,
          {
            email: email.trim().toLowerCase(),
            code: code.trim(),
            newPassword: password,
          }
        );

        setMode("login");
        setNotice(response.data.message || "Password updated. You can now sign in.");
        setPassword("");
        setCode("");
      } else {
        const response = await axios.post(
          `${API_BASE}/api/student-auth/login`,
          { email: email.trim().toLowerCase(), password }
        );

        if (!response.data.token) {
          throw new Error("The server did not return a login token.");
        }

        localStorage.setItem("srm-student-token", response.data.token);
        localStorage.setItem("srm-student-email", email.trim().toLowerCase());

        onLogin?.(response.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="student-auth-overlay">
      <section className="student-auth-card">
        <button
          type="button"
          className="student-auth-close"
          onClick={onClose}
          aria-label="Close student authentication"
        >
          ×
        </button>

        <div className="student-auth-brand">SRM</div>
        <span className="student-auth-tag">STUDENT ACCESS</span>

        <h1>
          {mode === "register"
            ? "Create your account"
            : mode === "verify"
            ? "Verify your email"
            : mode === "forgot"
            ? "Reset your password"
            : mode === "reset"
            ? "Enter reset code"
            : "Welcome back"}
        </h1>

        <p className="student-auth-subtitle">
          {mode === "register"
            ? "Register with your official SRM student email."
            : mode === "verify"
            ? `Enter the verification code sent to ${email}.`
            : mode === "forgot"
            ? "Enter your @srmist.edu.in email to receive a 6-digit reset code."
            : mode === "reset"
            ? `Enter the 6-digit code sent to ${email} and choose a new password.`
            : "Sign in to access your private student messages."}
        </p>

        {error && <div className="student-auth-error">{error}</div>}
        {notice && <div className="student-auth-notice">{notice}</div>}

        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Name
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your name"
                maxLength={100}
                autoComplete="name"
                required
              />
            </label>
          )}

          {mode !== "verify" && mode !== "reset" && (
            <label>
              SRM email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@srmist.edu.in"
                autoComplete="email"
                pattern="^[a-zA-Z0-9._%+-]+@srmist\.edu\.in$"
                title="Use your @srmist.edu.in email address."
                required
              />
            </label>
          )}

          {(mode === "verify" || mode === "reset") && (
            <>
              <label>
                {mode === "reset" ? "Reset code" : "Verification code"}
                <input
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  minLength={6}
                  maxLength={6}
                  required
                />
              </label>

              <div className="student-auth-code-actions">
                {mode === "verify" ? (
                  <button
                    type="button"
                    className="student-auth-text-button"
                    onClick={() => {
                      setMode("register");
                      setNotice("");
                      setError("");
                    }}
                  >
                    Back to registration
                  </button>
                ) : (
                  <span />
                )}

                <button
                  type="button"
                  className="student-auth-text-button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResendCode}
                >
                  {resendCooldown > 0
                    ? `Resend code (${resendCooldown}s)`
                    : "Resend code"}
                </button>
              </div>
            </>
          )}

          {(mode === "login" || mode === "register" || mode === "reset") && (
            <label>
              {mode === "reset" ? "New password" : "Password"}
              <div className="student-auth-password-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    mode === "register" || mode === "reset"
                      ? "At least 10 characters"
                      : "Your password"
                  }
                  minLength={mode === "register" || mode === "reset" ? 10 : undefined}
                  maxLength={128}
                  autoComplete={
                    mode === "register" || mode === "reset"
                      ? "new-password"
                      : "current-password"
                  }
                  required
                />
                <button
                  type="button"
                  className="student-auth-eye-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>
          )}

          {mode === "login" && (
            <div className="student-auth-forgot-row">
              <button
                type="button"
                className="student-auth-text-button"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setNotice("");
                  setPassword("");
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          <button className="student-auth-submit" disabled={loading} type="submit">
            {loading
              ? "Please wait..."
              : mode === "register"
              ? "Create account"
              : mode === "verify"
              ? "Verify email"
              : mode === "forgot"
              ? "Send reset code"
              : mode === "reset"
              ? "Reset password"
              : "Sign in"}
          </button>
        </form>

        {(mode === "forgot" || mode === "reset") && (
          <p className="student-auth-switch">
            Remembered your password?{" "}
            <button
              type="button"
              className="student-auth-text-button"
              onClick={() => {
                setMode("login");
                setError("");
                setNotice("");
                setCode("");
                setPassword("");
              }}
            >
              Back to sign in
            </button>
          </p>
        )}

        {(mode === "login" || mode === "register") && (
          <p className="student-auth-switch">
            {mode === "login" ? "New student?" : "Already registered?"}{" "}
            <button
              type="button"
              className="student-auth-text-button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
                setNotice("");
              }}
            >
              {mode === "login" ? "Create account" : "Sign in"}
            </button>
          </p>
        )}
      </section>
    </div>
  );
}
