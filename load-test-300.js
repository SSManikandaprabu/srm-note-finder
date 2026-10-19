import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "30s", target: 200 },
    { duration: "30s", target: 300 },
    { duration: "30s", target: 0 },
  ],

  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
  },
};

export default function () {
  const url =
    "http://localhost:5000/api/resources?semester=5&subject=Computer%20Networks";

  const response = http.get(url, {
    timeout: "30s",
    tags: { endpoint: "resources" },
  });

  check(response, {
    "status is 200": (r) => r.status === 200,
    "API reports success": (r) => {
      try {
        return JSON.parse(r.body).success === true;
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}