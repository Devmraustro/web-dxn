import axios from "axios";
import { safeStorageGetItem } from "../utils/safeStorage";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = safeStorageGetItem("dxn_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
