import axios from "axios";

import { MOCK_DATA } from "./mockData";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;
const http = axios.create({ baseURL: API });

const getMockData = (config) => {
  const url = config?.url || "";
  const method = config?.method?.toLowerCase() || "get";
  
  if (url.includes("/demo/state")) return MOCK_DATA.demoState;
  if (url.includes("/prices/meta")) return MOCK_DATA.pricesMeta;
  if (url.includes("/prices/latest")) return MOCK_DATA.latestPrices(config?.params?.commodity || "Onion");
  if (url.includes("/prices/series")) return MOCK_DATA.series(config?.params?.commodity || "Onion", config?.params?.market || "Lasalgaon", config?.params?.days);
  if (url.includes("/forecast")) return MOCK_DATA.forecast(config?.params?.commodity || "Onion", config?.params?.market || "Lasalgaon");
  if (url.includes("/decide")) return MOCK_DATA.decide(config?.data ? JSON.parse(config.data) : {qty_q: 300, market: "Lasalgaon"});
  if (url.includes("/buyers/match")) return MOCK_DATA.buyersMatch();
  if (url.includes("/pulse")) return MOCK_DATA.pulse(config?.params?.commodity || "Onion");
  if (url.includes("/console")) return MOCK_DATA.console();
  
  if (url.includes("/money-meter")) return MOCK_DATA.moneyMeter("mock-lot-1");
  if (url.includes("/accept")) return MOCK_DATA.acceptOffer("offer-1");
  if (url.includes("/advance")) return MOCK_DATA.advance("tx-mock-1");
  if (url.includes("/audit")) return MOCK_DATA.audit();
  
  if (url.includes("/lots")) {
    if (method === 'post') return MOCK_DATA.lots()[0]; // createLot returns single lot
    if (url.match(/\/lots\/[^/]+$/)) return MOCK_DATA.lot("mock-lot-1"); // single lot get
    return MOCK_DATA.lots(); // list lots
  }

  return { ok: true };
};

http.interceptors.response.use(
  (response) => {
    if (typeof response.data === 'string' && response.data.includes('<html')) {
      console.warn("Vercel HTML fallback detected. Using offline mock data.");
      return { ...response, data: getMockData(response.config) };
    }
    return response;
  },
  (error) => {
    console.warn("API Error intercepted. Falling back to offline mock data.", error.message);
    if (error.config) {
      return Promise.resolve({ data: getMockData(error.config) });
    }
    return Promise.reject(error);
  }
);

export const api = {
  demoState: () => http.get("/demo/state").then((r) => r.data),
  pricesMeta: () => http.get("/prices/meta").then((r) => r.data),
  latest: (commodity, district = "Nashik") => http.get("/prices/latest", { params: { commodity, district } }).then((r) => r.data),
  series: (commodity, market, days = 365) => http.get("/prices/series", { params: { commodity, market, days } }).then((r) => r.data),
  forecast: (commodity, market) => http.get("/forecast", { params: { commodity, market } }).then((r) => r.data),
  decide: (body) => http.post("/decide", body).then((r) => r.data),
  matchBuyers: (params) => http.get("/buyers/match", { params }).then((r) => r.data),
  createLot: (body) => http.post("/lots", body).then((r) => r.data),
  lots: () => http.get("/lots").then((r) => r.data),
  lot: (id) => http.get(`/lots/${id}`).then((r) => r.data),
  acceptOffer: (id, override = false) => http.post(`/offers/${id}/accept`, { override }).then((r) => r.data),
  advance: (txId) => http.post(`/transactions/${txId}/advance`).then((r) => r.data),
  moneyMeter: (lotId) => http.get(`/lots/${lotId}/money-meter`).then((r) => r.data),
  audit: (lotId) => http.get("/audit", { params: lotId ? { lot_id: lotId } : {} }).then((r) => r.data),
  pulse: (commodity) => http.get("/pulse", { params: { commodity } }).then((r) => r.data),
  console: () => http.get("/console").then((r) => r.data),
  reset: () => http.post("/demo/reset").then((r) => r.data),
};

export const DEFAULT_LOT = { commodity: "Onion", qty_q: 300, grade: "A", moisture_pct: 12, market: "Lasalgaon", lat: 20.08, lon: 74.11 };
export const MARKETS = {
  Onion: ["Lasalgaon", "Pimpalgaon Baswant", "Yeola", "Solapur", "Pune", "Rahuri", "Kolhapur", "Nagpur"],
  Tomato: ["Nashik", "Pimpalgaon Baswant", "Pune", "Narayangaon", "Sangamner", "Nagpur"],
  Soyabean: ["Latur", "Nagpur", "Akola", "Amravati", "Washim"],
};
