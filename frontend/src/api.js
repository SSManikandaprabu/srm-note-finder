import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

export const testBackend = () => {
  return axios.get("http://localhost:5000/");
};

export const getResource = (semester, subject) => {
  return API.get("/resources", {
    params: {
      semester,
      subject,
    },
  });
};

export default API;