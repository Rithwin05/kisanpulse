DISTRICTS = {
    "Nashik": (20.00, 73.78, "Maharashtra"), "Pune": (18.52, 73.86, "Maharashtra"), "Ahmednagar": (19.09, 74.74, "Maharashtra"),
    "Solapur": (17.66, 75.90, "Maharashtra"), "Aurangabad": (19.88, 75.34, "Maharashtra"), "Nagpur": (21.15, 79.09, "Maharashtra"),
    "Kolhapur": (16.70, 74.24, "Maharashtra"), "Satara": (17.68, 74.00, "Maharashtra"), "Sangli": (16.85, 74.57, "Maharashtra"),
    "Jalgaon": (21.00, 75.56, "Maharashtra"), "Dhule": (20.90, 74.77, "Maharashtra"), "Latur": (18.40, 76.57, "Maharashtra"),
    "Amravati": (20.93, 77.75, "Maharashtra"), "Akola": (20.70, 77.00, "Maharashtra"), "Thane": (19.20, 72.97, "Maharashtra"),
    "Mumbai": (19.07, 72.87, "Maharashtra"), "Beed": (18.99, 75.76, "Maharashtra"), "Osmanabad": (18.18, 76.04, "Maharashtra"),
    "Buldhana": (20.53, 76.18, "Maharashtra"), "Washim": (20.11, 77.13, "Maharashtra"), "Nanded": (19.15, 77.30, "Maharashtra"),
    "Chandrapur": (19.95, 79.30, "Maharashtra"), "Wardha": (20.75, 78.60, "Maharashtra"), "Raigad": (18.50, 73.20, "Maharashtra"),
    "Ratnagiri": (17.00, 73.30, "Maharashtra"), "Palghar": (19.70, 72.77, "Maharashtra"), "Yavatmal": (20.39, 78.13, "Maharashtra"),
    "Hingoli": (19.72, 77.15, "Maharashtra"), "Parbhani": (19.27, 76.78, "Maharashtra"), "Jalna": (19.84, 75.88, "Maharashtra"),
    "Gondia": (21.46, 80.20, "Maharashtra"), "Bhandara": (21.17, 79.65, "Maharashtra"), "Nandurbar": (21.37, 74.24, "Maharashtra"),
    "Sindhudurg": (16.00, 73.70, "Maharashtra"), "Gadchiroli": (20.18, 80.00, "Maharashtra"),
    "Nalgonda": (17.05, 79.27, "Telangana"), "Hyderabad": (17.38, 78.48, "Telangana"), "Warangal": (18.00, 79.58, "Telangana"),
}

# commodity -> [(market, district, lat, lon, price_index_vs_lasalgaon)]
MARKETS = {
    "Onion": [
        ("Lasalgaon", "Nashik", 20.14, 74.24, 1.00), ("Pimpalgaon Baswant", "Nashik", 20.17, 73.98, 1.02),
        ("Yeola", "Nashik", 20.04, 74.49, 0.97), ("Solapur", "Solapur", 17.66, 75.90, 0.95),
        ("Pune", "Pune", 18.52, 73.86, 1.08), ("Rahuri", "Ahmednagar", 19.39, 74.65, 0.96),
        ("Kolhapur", "Kolhapur", 16.70, 74.24, 1.05), ("Nagpur", "Nagpur", 21.15, 79.09, 1.10),
    ],
    "Tomato": [
        ("Nashik", "Nashik", 20.00, 73.78, 1.00), ("Pimpalgaon Baswant", "Nashik", 20.17, 73.98, 1.01),
        ("Pune", "Pune", 18.52, 73.86, 1.06), ("Narayangaon", "Pune", 19.10, 73.97, 0.98),
        ("Sangamner", "Ahmednagar", 19.57, 74.21, 0.96), ("Nagpur", "Nagpur", 21.15, 79.09, 1.08),
    ],
    "Soyabean": [
        ("Latur", "Latur", 18.40, 76.57, 1.00), ("Nagpur", "Nagpur", 21.15, 79.09, 0.99),
        ("Akola", "Akola", 20.70, 77.00, 0.98), ("Amravati", "Amravati", 20.93, 77.75, 0.985),
        ("Washim", "Washim", 20.11, 77.13, 0.975),
    ],
}

# Seasonal index by month (Jan..Dec) and base price ₹/q — used ONLY for the labelled synthetic fallback
SEASONAL = {
    "Onion": (1650, [1.05, 0.95, 0.80, 0.75, 0.78, 0.85, 0.95, 1.10, 1.30, 1.45, 1.35, 1.15]),
    "Tomato": (1500, [1.20, 1.00, 0.70, 0.60, 0.65, 0.90, 1.50, 1.40, 1.10, 1.00, 1.10, 1.20]),
    "Soyabean": (4400, [1.02, 1.03, 1.04, 1.05, 1.06, 1.05, 1.03, 1.00, 0.95, 0.93, 0.96, 1.00]),
}

# district share of state arrivals (synthetic demand/supply for Market Pulse)
SUPPLY_SHARE = {
    "Onion": {"Nashik": 0.36, "Ahmednagar": 0.14, "Pune": 0.12, "Solapur": 0.10, "Dhule": 0.05, "Jalgaon": 0.04,
              "Aurangabad": 0.04, "Satara": 0.03, "Beed": 0.03, "Osmanabad": 0.02, "Kolhapur": 0.02, "Nagpur": 0.02,
              "Buldhana": 0.02, "Sangli": 0.01},
    "Tomato": {"Nashik": 0.22, "Pune": 0.20, "Ahmednagar": 0.14, "Satara": 0.08, "Aurangabad": 0.07, "Nagpur": 0.07,
               "Solapur": 0.06, "Sangli": 0.05, "Kolhapur": 0.05, "Jalgaon": 0.03, "Latur": 0.03},
    "Soyabean": {"Latur": 0.16, "Nagpur": 0.09, "Akola": 0.09, "Amravati": 0.10, "Washim": 0.07, "Buldhana": 0.08,
                 "Yavatmal": 0.08, "Wardha": 0.06, "Nanded": 0.07, "Hingoli": 0.05, "Parbhani": 0.05, "Osmanabad": 0.05,
                 "Beed": 0.05},
}
