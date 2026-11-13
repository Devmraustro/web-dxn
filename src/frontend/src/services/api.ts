import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  try {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("dxn_token") : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // Ignore storage access errors in restricted browsers
  }
  return config;
});

export default api;
