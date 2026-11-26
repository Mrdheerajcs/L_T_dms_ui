import axios from "axios";
import { API_HOST } from "./apiConfig";

// Public calls — no auth headers (used before login)
const publicApi = axios.create({
  baseURL: API_HOST,
  headers: { "Content-Type": "application/json" },
  timeout: 5000, // 5 sec timeout
});

export const licenseApi = {
  getStatus: async () => {
    const res = await publicApi.get("/license/status");
    return res.data;
  },

  getHardwareId: async () => {
    const res = await publicApi.get("/license/hardware-id");
    return res.data;
  },

  activate: async (licenseKey) => {
    const res = await publicApi.post("/license/activate", { licenseKey });
    return res.data;
  },
};