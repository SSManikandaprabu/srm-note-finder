const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const SESSION_KEY = "srm-live-session-id";
const USER_KEY = "srm-live-user-id";

function createId(prefix) {
  return (
    prefix +
    "-" +
    Date.now() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 10)
  );
}

function getSessionId() {
  let sessionId =
    sessionStorage.getItem(
      SESSION_KEY
    );

  if (!sessionId) {
    sessionId = createId("session");

    sessionStorage.setItem(
      SESSION_KEY,
      sessionId
    );
  }

  return sessionId;
}

function getUserId() {
  let userId =
    localStorage.getItem(
      USER_KEY
    );

  if (!userId) {
    userId = createId("user");

    localStorage.setItem(
      USER_KEY,
      userId
    );
  }

  return userId;
}

 let currentState = {
  currentPage: "Home",
  semester: "",
  subject: "",
  activity: "Browsing",
};

export function updateLiveState(options = {}) {
  currentState = {
    ...currentState,
    ...options,
  };

  sendHeartbeat(currentState);
}

export async function startLiveSession(
  options = {}
) {
  currentState = {
    ...currentState,
    ...options,
  };

  const sessionId =
    getSessionId();

  const userId =
    getUserId();

  try {
    await fetch(
      `${API_BASE}/api/sessions/start`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          sessionId,
          userId,

          name:
            localStorage.getItem(
              "srm-user-name"
            ) ||
            "Guest Student",

          email:
            localStorage.getItem(
              "srm-user-email"
            ) ||
            "",

          semester:
            currentState.semester,

          subject:
            currentState.subject,

          currentPage:
            currentState.currentPage,

          activity:
            currentState.activity,
        }),
      }
    );
  } catch (error) {
    console.error(
      "Live session start error:",
      error
    );
  }
}


export async function sendHeartbeat(options = {}) {
  currentState = {
    ...currentState,
    ...options,
  };

  const sessionId = getSessionId();

  try {
    const response = await fetch(
      `${API_BASE}/api/sessions/heartbeat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          currentPage: currentState.currentPage,
          semester: currentState.semester,
          subject: currentState.subject,
          activity: currentState.activity,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Heartbeat failed:", {
        status: response.status,
        message: data.message,
        sessionId,
      });
      return;
    }

    console.log("Heartbeat successful:", data);
  } catch (error) {
    console.error("Live heartbeat error:", error);
  }
}
export async function recordActivity(
  eventType,
  options = {}
) {
  currentState = {
    ...currentState,
    ...options,
  };

  const sessionId =
    getSessionId();

  const userId =
    getUserId();

  try {
    await fetch(
      `${API_BASE}/api/activity`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          userId,
          sessionId,

          eventType,

          page:
            currentState.currentPage,

          semester:
            currentState.semester,

          subject:
            currentState.subject,

          details:
            options.details || "",
        }),
      }
    );
  } catch (error) {
    console.error(
      "Activity error:",
      error
    );
  }
}

export async function endLiveSession() {
  const sessionId =
    sessionStorage.getItem(
      SESSION_KEY
    );

  if (!sessionId) {
    return;
  }

  try {
    await fetch(
      `${API_BASE}/api/sessions/end`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          sessionId,
        }),
      }
    );
  } catch (error) {
    console.error(
      "Live session end error:",
      error
    );
  }
}

export function startLiveTracking(
  options = {}
) {
  startLiveSession(options);

  const interval =
    setInterval(() => {
      sendHeartbeat();
    }, 20000);

  const handleBeforeUnload =
    () => {
      const sessionId =
        sessionStorage.getItem(
          SESSION_KEY
        );

      if (!sessionId) {
        return;
      }

      fetch(
        `${API_BASE}/api/sessions/end`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            sessionId,
          }),

          keepalive: true,
        }
      );
    };

  window.addEventListener(
    "beforeunload",
    handleBeforeUnload
  );

  return () => {
    clearInterval(interval);

    window.removeEventListener(
      "beforeunload",
      handleBeforeUnload
    );

    endLiveSession();
  };
}