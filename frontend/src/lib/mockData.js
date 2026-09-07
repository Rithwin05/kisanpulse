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
        label: "Sell today at local Mandi",
        counterparty: "Lasalgaon APMC",
        price_per_q: 2100,
        source: "simulated local fallback",
        economics: { nrv: 2050 * body.qty_q, gross: 2100 * body.qty_q, transport: 40 * body.qty_q, handling: 10 * body.qty_q, commission: 0, risk_adjustment: 0, storage: 0, spoilage: 0 }
      },
      pathways: [
        { 
          key: "mandi_now", label: "Mandi Now", counterparty: body.market || "Lasalgaon APMC", price_per_q: 2100, risk: "low", days_to_cash: 1, source: "simulated",
          economics: { nrv: 2050 * body.qty_q, gross: 2100 * body.qty_q, transport: 40 * body.qty_q, handling: 10 * body.qty_q, commission: 0, risk_adjustment: 0, storage: 0, spoilage: 0, risk_breakdown: { payment: 0, rejection: 0, volatility: 0 } }
        },
        { 
          key: "store_sell_later", label: "Store & Sell Later", counterparty: "Future Market", price_per_q: 2300, risk: "high", days_to_cash: 30, source: "forecast",
          economics: { nrv: 2000 * body.qty_q, gross: 2300 * body.qty_q, transport: 40 * body.qty_q, handling: 10 * body.qty_q, commission: 0, risk_adjustment: 15000, storage: 20 * body.qty_q, spoilage: 10 * body.qty_q, risk_breakdown: { payment: 0, rejection: 0, volatility: 15000 } }
        },
        { 
          key: "fpo_pool", label: "FPO Pooling", counterparty: "Niphad FPC", price_per_q: 2150, risk: "medium", days_to_cash: 7, source: "simulated",
          economics: { nrv: 2080 * body.qty_q, gross: 2150 * body.qty_q, transport: 25 * body.qty_q, handling: 5 * body.qty_q, commission: 2000, risk_adjustment: 5000, storage: 0, spoilage: 0, risk_breakdown: { payment: 3000, rejection: 2000, volatility: 0 } }
        },
        { 
          key: "processor_contract", label: "Processor Contract", counterparty: "Sahyadri Farms", price_per_q: 2200, risk: "medium", days_to_cash: 14, source: "simulated",
          economics: { nrv: 2060 * body.qty_q, gross: 2200 * body.qty_q, transport: 60 * body.qty_q, handling: 10 * body.qty_q, commission: 0, risk_adjustment: 10000, storage: 0, spoilage: 0, risk_breakdown: { payment: 5000, rejection: 5000, volatility: 0 } }
        },
        { 
          key: "distant_mandi", label: "Sell at Distant Mandi", counterparty: "Pune APMC", price_per_q: 2350, risk: "high", days_to_cash: 3, source: "simulated",
          economics: { nrv: 1950 * body.qty_q, gross: 2350 * body.qty_q, transport: 150 * body.qty_q, handling: 20 * body.qty_q, commission: 0, risk_adjustment: 8000, storage: 0, spoilage: 0, risk_breakdown: { payment: 0, rejection: 0, volatility: 8000 } }
        }
      ],
      confidence: { score: 85, factors: [{ factor: "High local volume", delta: "+5" }, { factor: "Model variance", delta: "-2" }] },
      why: [
        { text: "Current prices are strong across neighboring mandis.", source: "mandi trends" },
        { text: "Short-term forecast predicts only marginal gains which do not offset storage costs.", source: "engine reasoning" }
      ],
      min_acceptable_value: 2050 * body.qty_q,
      baseline_mandi_nrv: 2100 * body.qty_q,
      liquidity_impact: { cash_within_2_days: 2100 * body.qty_q, cash_later: 0, days_to_full_cash: 2 },
      alternatives: [
        { key: "fpo_pool", label: "FPO pooling could save ₹4,000 on transport.", delta_vs_best: -2500 }
      ],
      latency_ms: 125,
      context: {
        demo_today: today,
        mandi: { name: body.market || "Lasalgaon", modal_price: 2100, date: today, source: "synthetic-seasonal", distance_km: 15.4 },
        forecast_summary: {
          p10: [1900], p50: [2150], p90: [2300], dates: [today], backtest: { champion: "lgbm", mape: { lgbm: 8.4, ets: 11.2, snaive: 14.5 } }, source_chip: "synthetic-seasonal"
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
        { commodity: "Onion", market: "Lasalgaon", champion: "lgbm", mape: { lgbm: 8.4, ets: 11.2, snaive: 14.5 }, history_days: 1095, source_chip: "synthetic-seasonal", band_coverage_p10_p90: 0.88 }
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
  },
  lot: (id) => {
    const l = MOCK_DATA.lots()[0];
    l.id = id;
    l.offers = [
      { id: "offer-1", buyer_name: "Sahyadri Farms", buyer_type: "Processor", distance_km: 22.4, price_per_q: 2150, value: 2150 * 300, payment_days: 7, trust_band: "A", nrv: 2150 * 300 - 10000, status: "open", below_mav: false, created_at: new Date().toISOString() },
      { id: "offer-2", buyer_name: "Local Trader APMC", buyer_type: "Trader", distance_km: 15.4, price_per_q: 1800, value: 1800 * 300, payment_days: 1, trust_band: "C", nrv: 1800 * 300 - 10000, status: "open", below_mav: true, created_at: new Date().toISOString() }
    ];
    l.transaction = null;
    return l;
  },
  acceptOffer: (id) => {
    return {
      id: "tx-mock-1",
      lot_id: "mock-lot-1",
      offer_id: id,
      buyer_name: "Sahyadri Farms",
      commodity: "Onion",
      qty_q: 300,
      price_per_q: 2150,
      agreed_value: 2150 * 300,
      stage: "accepted",
      stages: [{ stage: "accepted", at: new Date().toISOString(), note: "Offer accepted via Mock Data" }],
      predicted: { price_per_q: 2150, nrv: 635000, baseline_mandi_nrv: 630000, recommended_pathway: "mandi_now" }
    };
  },
  advance: (txId) => {
    return {
      id: txId,
      stage: "closed",
      stages: [{ stage: "accepted", at: new Date().toISOString(), note: "Offer accepted via Mock Data" }, { stage: "closed", at: new Date().toISOString(), note: "Transaction closed in Mock Mode" }],
      logistics: { cost: 12000, vehicle: "Pickup" },
      payment: { amount: 645000 },
      outcome: { realised_nrv: 633000, delta_vs_baseline: 3000 }
    };
  },
  moneyMeter: (lotId) => {
    return {
      lot_id: lotId,
      stage: "closed",
      complete: true,
      baseline: { label: "Mandi now", nrv: 630000, breakdown: { gross: 630000, transport: -12000, handling: -3000 } },
      realised: { label: "Sold to Mock Buyer", nrv: 633000, breakdown: { gross_paid: 645000, transport: -12000, handling: -3000 } },
      delta: 3000,
      ledger: []
    };
  },
  audit: () => {
    return [{ id: "a1", ts: new Date().toISOString(), event: "demo_mode_active", actor: "system", payload: {} }];
  }
};
