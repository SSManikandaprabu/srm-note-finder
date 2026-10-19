import React, { useState } from "react";
import axios from "axios";
import Dashboard from "./Dashboard";
import "./App.css";

const API_BASE =
  (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("srm-admin-token")
  );

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      alert("Please enter your username and password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE}/api/admin/login`,
        {
          username: username,
          password: password,
        }
      );

      if (response.data.success && response.data.token) {
        localStorage.setItem(
          "srm-admin-token",
          response.data.token
        );

        localStorage.setItem(
          "srm-admin-username",
          response.data.username || username
        );

        setIsLoggedIn(true);
      } else {
        alert("Login failed.");
      }
    } catch (error) {
      console.error("Login error:", error);

      alert(
        error.response?.data?.message ||
          "Invalid username or password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("srm-admin-token");
    localStorage.removeItem("srm-admin-username");

    setUsername("");
    setPassword("");
    setIsLoggedIn(false);
  };

  if (isLoggedIn) {
    return (
      <Dashboard
        username={
          localStorage.getItem("srm-admin-username") ||
          username ||
          "Admin"
        }
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="stage">

      {/* LEFT VIDEO */}
      <section className="photo">

        <video
          className="photo-img"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260813_052122_e77a27e6-17f1-4794-889b-3ceaa0e9e8cb.mp4"
            type="video/mp4"
          />
        </video>

        <div className="scrim"></div>

        <div className="hero">

          <div className="badge">
            <span className="badge-icon">↗</span>
            <span>SRM Admin Portal</span>
          </div>

        </div>

      </section>

      {/* RIGHT LOGIN AREA */}
      <section className="pane">

        <div className="card">

          <div className="card-content">

            {/* TITLE */}
            <div className="login-heading">

              <h1>Welcome back.</h1>

              <p className="subtitle">
                Sign in to manage your notes, resources, and users.
              </p>

            </div>

            {/* LOGIN FORM */}
            <form onSubmit={handleLogin}>

              {/* USERNAME */}
              <div className="field">

                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                  placeholder="Username"
                  autoComplete="username"
                  aria-label="Username"
                />

              </div>

              {/* PASSWORD */}
              <div className="field password-field">

                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Password"
                  autoComplete="current-password"
                  aria-label="Password"
                />

              </div>

              {/* LOGIN BUTTON */}
              <button
                type="submit"
                className="login-button"
                disabled={isLoading}
              >

                <span>
                  {isLoading
                    ? "Signing in..."
                    : "Enter Admin Panel"}
                </span>

                {!isLoading && (
                  <span className="arrow">
                    →
                  </span>
                )}

              </button>

            </form>

          </div>

        </div>

      </section>

    </div>
  );
}