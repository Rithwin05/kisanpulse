import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const http = axios.create({ baseURL: API });

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
