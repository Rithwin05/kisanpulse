export const MOCK_DATA = {
  demoState: {
    demo_today: new Date().toISOString().split('T')[0],
    pinned: false,
    farmer: {
      name: "Ramesh Patil",
      village: "Niphad",
      district: "Nashik",
      lat: 20.08,
      lon: 74.11,
      fpo: "Niphad Farmer Producer Co.",
    },
    price_source: "synthetic-seasonal (Mock)",
    source_chip: "synthetic-seasonal " + new Date().toISOString().split('T')[0],
    lots: 3,
    forecast_ready: true,
    stale_threshold_days: 3,
  },
  pricesMeta: {
    demo_today: new Date().toISOString().split('T')[0],
    commodities: [
      {
        commodity: "Onion",
        records: 45000,
        anomalies_flagged: 120,
        source: "synthetic-seasonal",
        latest_date: new Date().toISOString().split('T')[0],
        first_date: "2010-01-01",
        markets: [
          "Lasalgaon",
          "Pimpalgaon Baswant",
          "Yeola",
          "Solapur",
          "Pune",
          "Rahuri",
          "Kolhapur",
          "Nagpur",
        ],
      },
      {
        commodity: "Tomato",
        records: 30000,
        anomalies_flagged: 80,
        source: "synthetic-seasonal",
        latest_date: new Date().toISOString().split('T')[0],
        first_date: "2010-01-01",
        markets: [
          "Nashik",
          "Pimpalgaon Baswant",
          "Pune",
          "Narayangaon",
          "Sangamner",
          "Nagpur",
        ],
      },
    ],
    last_ingest: new Date().toISOString(),
    note: "Mock Data Mode Active",
  },
  latestPrices: (commodity) => {
    const today = new Date().toISOString().split('T')[0];
    const isOnion = commodity === "Onion";
    return {
      commodity,
      demo_today: today,
      markets: [
        {
          market: isOnion ? "Lasalgaon" : "Nashik",
          district: "Nashik",
          modal: isOnion ? 2100 : 1500,
          min: isOnion ? 1800 : 1200,
          max: isOnion ? 2500 : 1800,
          date: today,
          source_chip: `synthetic-seasonal ${today}`,
          freshness_days: 0,
          stale: false,
          wow_pct: 4.2,
          distance_km: 15.4,
        },
        {
          market: "Pimpalgaon Baswant",
          district: "Nashik",
          modal: isOnion ? 2150 : 1550,
          min: isOnion ? 1850 : 1250,
          max: isOnion ? 2550 : 1850,
          date: today,
          source_chip: `synthetic-seasonal ${today}`,
          freshness_days: 1,
          stale: false,
          wow_pct: 2.1,
          distance_km: 25.1,
        },
        {
          market: "Pune",
          district: "Pune",
          modal: isOnion ? 2400 : 1700,
          min: isOnion ? 2000 : 1400,
          max: isOnion ? 2800 : 2000,
          date: today,
          source_chip: `synthetic-seasonal ${today}`,
          freshness_days: 0,
          stale: false,
          wow_pct: 5.6,
          distance_km: 210.5,
        },
        {
          market: "Nagpur",
          district: "Nagpur",
          modal: isOnion ? 2800 : 2200,
          min: isOnion ? 2500 : 1800,
          max: isOnion ? 3200 : 2600,
          date: today,
          source_chip: `synthetic-seasonal ${today}`,
          freshness_days: 2,
          stale: false,
          wow_pct: -1.2,
          distance_km: 650.3,
        }
      ]
    };
  },
  series: (commodity, market, days = 180) => {
    const points = [];
    let currentPrice = commodity === "Onion" ? 1800 : 1200;
    const now = new Date();
    for (let i = days; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const change = (Math.random() - 0.45) * 50; 
      currentPrice = Math.max(800, currentPrice + change);
      points.push({
        date: dateStr,
        modal: Math.round(currentPrice),
        min: Math.round(currentPrice * 0.85),
        max: Math.round(currentPrice * 1.15),
        anomaly: Math.random() > 0.95,
        source: "synthetic-seasonal"
      });
    }
    return { commodity, market, points };
  },
  forecast: (commodity, market) => {
    const today = new Date();
    const dates = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i + 1);
      return d.toISOString().split('T')[0];
    });
    const basePrice = commodity === "Onion" ? 2100 : 1500;
    const p50 = dates.map((_, i) => Math.round(basePrice + (i * 15) + (Math.sin(i / 3) * 50)));
    const p10 = p50.map(v => Math.round(v * 0.85));
    const p90 = p50.map(v => Math.round(v * 1.15));

    return {
      commodity,
      market,
      series_market: market,
      fallback_level: "local",
      source: "synthetic-seasonal",
      source_chip: `synthetic-seasonal ${today.toISOString().split('T')[0]}`,
      freshness_days: 0,
      stale: false,
      as_of: today.toISOString().split('T')[0],
      computed_at: today.toISOString(),
      dates,
      p10,
      p50,
      p90,
      backtest: {
        champion: "Prophet",
        mape: { Prophet: 8.4, XGBoost: 12.1, SARIMA: 15.3 }
      }
    };
  },
  decide: (body) => {
    const today = new Date().toISOString().split('T')[0];
    return {
      action: "mandi_now",
      action_label: "Sell today at local Mandi",
      recommended: {
        key: "mandi_now",
        economics: { nrv: 2100 * body.qty_q, gross: 2100 * body.qty_q, transport: -12000, handling: -3000, commission: 0, risk_adjustment: 0 }
      },
      pathways: [
        { key: "mandi_now", label: "Mandi Now", economics: { nrv: 2100 * body.qty_q, gross: 2100 * body.qty_q, transport: -12000, handling: -3000, commission: 0, risk_adjustment: 0 } },
        { key: "store_sell_later", label: "Store & Sell Later", economics: { nrv: 2050 * body.qty_q, gross: 2300 * body.qty_q, transport: -12000, handling: -3000, commission: 0, risk_adjustment: -15000 } }
      ],
      confidence: "High",
      why: "Current prices are strong and short-term forecast predicts only marginal gains which do not offset storage costs and weight loss risks.",
      min_acceptable_value: 2050 * body.qty_q,
      baseline_mandi_nrv: 2100 * body.qty_q,
      liquidity_impact: "Immediate payment",
      alternatives: ["FPO pooling could save ₹4,000 on transport."],
      context: {
        demo_today: today,
        mandi: { name: body.market || "Lasalgaon", modal_price: 2100, date: today, source: "synthetic-seasonal", distance_km: 15.4 },
        forecast_summary: {
          p10: [1900], p50: [2150], p90: [2300], dates: [today], backtest: { champion: "Prophet", mape: { Prophet: 8.4 } }, source_chip: "synthetic-seasonal"
        },
        stale: false,
        freshness_days: 0,
        fallback_level: "local",
        buyers: [
          { id: "b1", name: "Sahyadri Farms", type: "Processor", city: "Nashik", distance_km: 22.4, offer_price: 2150, payment_days: 7, rejection_prob: 0.05, trust_score: 92, trust_band: "A", match_score: 88, source: "simulated" },
          { id: "b2", name: "Reliance Retail", type: "Retailer", city: "Pune", distance_km: 210.5, offer_price: 2400, payment_days: 14, rejection_prob: 0.02, trust_score: 98, trust_band: "A", match_score: 85, source: "simulated" }
        ],
        request: body
      }
    };
  },
  buyersMatch: (params) => {
    return {
      ref_price: 2100,
      weights: { price: 30, distance: 20, quality: 15, payment: 15, trust: 10, volume: 10 },
      buyers: [
        { id: "b1", name: "Sahyadri Farms", type: "Processor", city: "Nashik", distance_km: 22.4, offer_price: 2150, payment_days: 7, rejection_prob: 0.05, trust_score: 92, trust_band: "A", match_score: 88, source: "simulated" },
        { id: "b2", name: "Reliance Retail", type: "Retailer", city: "Pune", distance_km: 210.5, offer_price: 2400, payment_days: 14, rejection_prob: 0.02, trust_score: 98, trust_band: "A", match_score: 85, source: "simulated" },
        { id: "b3", name: "Local Trader APMC", type: "Trader", city: "Lasalgaon", distance_km: 15.4, offer_price: 2080, payment_days: 1, rejection_prob: 0.10, trust_score: 75, trust_band: "C", match_score: 78, source: "simulated" }
      ]
    };
  },
  pulse: (commodity) => {
    const today = new Date().toISOString().split('T')[0];
    return {
      commodity,
      demo_today: today,
      districts: [
        { district: "Nashik", state: "Maharashtra", lat: 20.0, lon: 73.78, arrivals_q_per_day: 45000, demand_q_per_day: 42000, ratio: 1.07, status: "balanced", price_trend_pct: 2.4, avg_modal: 2100 },
        { district: "Pune", state: "Maharashtra", lat: 18.52, lon: 73.85, arrivals_q_per_day: 15000, demand_q_per_day: 28000, ratio: 0.53, status: "shortage", price_trend_pct: 8.5, avg_modal: 2400 },
        { district: "Ahmednagar", state: "Maharashtra", lat: 19.09, lon: 74.74, arrivals_q_per_day: 35000, demand_q_per_day: 12000, ratio: 2.91, status: "surplus", price_trend_pct: -5.2, avg_modal: 1850 },
      ],
      source: "arrivals & demand simulated; prices from mock data"
    };
  },
  console: () => {
    const today = new Date().toISOString().split('T')[0];
    return {
      demo_today: today,
      data: MOCK_DATA.pricesMeta,
      lots: 142,
      closed_transactions: 89,
      total_delta_vs_baseline: 452000.50,
      backtests: [
        { commodity: "Onion", market: "Lasalgaon", champion: "Prophet", mape: { Prophet: 8.4 }, history_days: 1095, source_chip: "synthetic-seasonal" }
      ],
      top_arrivals_7d: [
        { commodity: "Onion", district: "Nashik", arrivals_q: 315000 },
        { commodity: "Onion", district: "Ahmednagar", arrivals_q: 245000 }
      ],
      buyers: 450,
      warehouses: [],
      transport_rates: []
    };
  },
  lots: () => {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        id: "mock-lot-1",
        farmer: MOCK_DATA.demoState.farmer,
        commodity: "Onion",
        qty_q: 300,
        grade: "A",
        moisture_pct: 12,
        market: "Lasalgaon",
        status: "open",
        created_at: new Date().toISOString(),
        decision: MOCK_DATA.decide({qty_q: 300, market: "Lasalgaon"}),
        offers_expected: 3
      }
    ];
  }
};
