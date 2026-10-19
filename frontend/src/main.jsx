import React from "react";
import ReactDOM from "react-dom/client";
import "./App.css";
import App from "./App.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("APP CRASH:", error);
    console.error("COMPONENT INFO:", info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            background: "#12070d",
            color: "#ffffff",
            minHeight: "100vh",
            padding: "30px",
            fontFamily: "Arial, sans-serif",
            boxSizing: "border-box",
          }}
        >
          <h1 style={{ color: "#ff5c7c" }}>
            SRM Note Finder — App Error
          </h1>

          <h2>Something crashed inside App.jsx</h2>

          <pre
            style={{
              color: "#fecdd3",
              background: "#1f0a12",
              padding: "20px",
              borderRadius: "12px",
              whiteSpace: "pre-wrap",
              overflow: "auto",
              fontSize: "14px",
              lineHeight: "1.6",
            }}
          >
            {String(
              this.state.error?.stack ||
                this.state.error
            )}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);