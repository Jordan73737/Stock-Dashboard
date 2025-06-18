const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const dotenv = require("dotenv");
const axios = require("axios");
dotenv.config();
const quoteCache = new Map();

const app = express();
const allowedOrigins = ["https://stock-dashboard-drab.vercel.app"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        balance NUMERIC DEFAULT 100000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        symbol VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, symbol)
      );

      CREATE TABLE IF NOT EXISTS holdings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        symbol VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        quantity NUMERIC NOT NULL,
        buy_price NUMERIC NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, symbol)
      );

      CREATE TABLE IF NOT EXISTS User_Value_History (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        balance NUMERIC NOT NULL,
        investments NUMERIC NOT NULL,
        total_value NUMERIC NOT NULL,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
}
initDatabase();

// ---------------------- AUTH ROUTES ---------------------- //

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
      [email, hashedPassword]
    );

    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, email });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "This user already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, email });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// ---------------------- FAVORITES API ---------------------- //

app.get("/api/favorites", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/favorites", authenticateToken, async (req, res) => {
  const { symbol, name } = req.body;
  try {
    await pool.query(
      "INSERT INTO favorites (user_id, symbol, name) VALUES ($1, $2, $3) ON CONFLICT (user_id, symbol) DO NOTHING",
      [req.user.id, symbol, name]
    );
    res.json({ message: "Favorite added" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/favorites/:symbol", authenticateToken, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM favorites WHERE user_id = $1 AND symbol = $2",
      [req.user.id, req.params.symbol]
    );
    res.json({ message: "Favorite removed" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------- HOLDINGS API ---------------------- //

app.post("/api/holdings/buy", authenticateToken, async (req, res) => {
  const { symbol, name, quantity, buy_price } = req.body;

  try {
    const totalCost = quantity * buy_price;

    await pool.query(
      `INSERT INTO holdings (user_id, symbol, name, quantity, buy_price)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, symbol)
       DO UPDATE SET quantity = holdings.quantity + $4`,
      [req.user.id, symbol, name, quantity, buy_price]
    );

    await pool.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [
      totalCost,
      req.user.id,
    ]);

    res.json({ message: "Stock purchased" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to purchase stock" });
  }
});

app.post("/api/holdings/sell", authenticateToken, async (req, res) => {
  const { symbol, quantity } = req.body;

  try {
    const result = await pool.query(
      `SELECT quantity, buy_price FROM holdings WHERE user_id = $1 AND symbol = $2`,
      [req.user.id, symbol]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "You don't own this stock" });
    }

    const current = result.rows[0];
    if (quantity > current.quantity) {
      return res.status(400).json({ error: "Insufficient stock quantity" });
    }

    const proceeds = quantity * current.buy_price;

    if (current.quantity - quantity < 0.0001) {
      await pool.query(
        `DELETE FROM holdings WHERE user_id = $1 AND symbol = $2`,
        [req.user.id, symbol]
      );
    } else {
      await pool.query(
        `UPDATE holdings SET quantity = quantity - $1 WHERE user_id = $2 AND symbol = $3`,
        [quantity, req.user.id, symbol]
      );
    }

    await pool.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [
      proceeds,
      req.user.id,
    ]);

    res.json({ message: "Stock sold", proceeds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sell failed" });
  }
});

app.get("/api/holdings", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM holdings WHERE user_id = $1`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to get holdings" });
  }
});
// ---------------------- POPULAR STOCKS API ---------------------- //

app.get("/api/popular-stocks", async (req, res) => {
  const symbols = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "META",
    "NVDA",
    "JPM",
    "V",
    "UNH",
  ];

  const cleanSymbols = symbols.filter((sym) => !sym.includes(".")); // exclude dot symbol

  const nameMap = {
    AAPL: "Apple Inc.",
    MSFT: "Microsoft Corporation",
    GOOGL: "Alphabet Inc.",
    AMZN: "Amazon.com, Inc.",
    TSLA: "Tesla, Inc.",
    META: "Meta Platforms, Inc.",
    NVDA: "NVIDIA Corporation",
    JPM: "JPMorgan Chase & Co.",
    V: "Visa Inc.",
    UNH: "United Health Group Incorporated",
  };

  try {
    const results = await Promise.all(
      cleanSymbols.map(async (symbol) => {
        const now = Date.now();
        const cached = quoteCache.get(symbol);

        // If cached and under 2 mins old, return it
        if (cached && now - cached.timestamp < 120000) {
          return cached.data;
        }

        try {
          const encoded = encodeURIComponent(symbol);
          const quoteRes = await axios.get(
            `https://finnhub.io/api/v1/quote?symbol=${encoded}&token=${process.env.FINNHUB_API_KEY}`
          );

          const price = quoteRes.data.c;
          const data = {
            name: nameMap[symbol] || symbol,
            symbol,
            change: quoteRes.data.dp?.toFixed(2) + "%" || "N/A",
            sell: `$${price?.toFixed(2) || "N/A"}`,
            buy: `$${(price + 1)?.toFixed(2) || "N/A"}`,
          };

          // Cache it
          quoteCache.set(symbol, { timestamp: now, data });

          return data;
        } catch (err) {
          console.warn(`Skipping ${symbol}: ${err.message}`);
          return null;
        }
      })
    );

    res.json(results.filter(Boolean));
  } catch (err) {
    console.error("Error fetching stocks:", err.message);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});

// ---------------------- BALANCE & HOLDINGS ---------------------- //

// Set fake balance
app.post("/api/balance", authenticateToken, async (req, res) => {
  const { balance } = req.body;
  try {
    await pool.query(`UPDATE users SET balance = $1 WHERE id = $2`, [
      balance,
      req.user.id,
    ]);
    res.json({ message: "Balance updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to set balance" });
  }
});

// Get balance
app.get("/api/balance", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT balance FROM users WHERE id = $1`, [
      req.user.id,
    ]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch balance" });
  }
});

// Buy stock (add holding)
app.post("/api/holdings", authenticateToken, async (req, res) => {
  const { symbol, name, quantity, buy_price } = req.body;
  try {
    await pool.query(
      `
      INSERT INTO holdings (user_id, symbol, name, quantity, buy_price)
      VALUES ($1, $2, $3, $4, $5)
    `,
      [req.user.id, symbol, name, quantity, buy_price]
    );

    // Deduct from user balance
    const totalCost = quantity * buy_price;
    await pool.query(`UPDATE users SET balance = balance - $1 WHERE id = $2`, [
      totalCost,
      req.user.id,
    ]);

    res.json({ message: "Stock purchased" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to buy stock" });
  }
});

app.post("/api/sell", authenticateToken, async (req, res) => {
  const { symbol, quantity } = req.body;

  try {
    // Get the existing holding
    const result = await pool.query(
      `SELECT quantity, buy_price FROM holdings WHERE user_id = $1 AND symbol = $2`,
      [req.user.id, symbol]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "You don't own this stock" });
    }

    const current = result.rows[0];

    if (quantity > current.quantity) {
      return res.status(400).json({ error: "Insufficient stock quantity" });
    }

    const proceeds = quantity * current.buy_price;

    // Update or delete the holding
    if (quantity === current.quantity) {
      await pool.query(
        `DELETE FROM holdings WHERE user_id = $1 AND symbol = $2`,
        [req.user.id, symbol]
      );
    } else {
      await pool.query(
        `UPDATE holdings SET quantity = quantity - $1 WHERE user_id = $2 AND symbol = $3`,
        [quantity, req.user.id, symbol]
      );
    }

    // Update balance
    await pool.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [
      proceeds,
      req.user.id,
    ]);

    res.json({ message: "Stock sold", proceeds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Sell failed" });
  }
});

// ---------------------- Daily Value Calculations ---------------------- //


async function recordDailyUserValues() {
  const users = await pool.query("SELECT id, balance FROM users");

  for (const user of users.rows) {
    const holdings = await pool.query(
      "SELECT symbol, quantity FROM holdings WHERE user_id = $1",
      [user.id]
    );

    let totalInvestments = 0;

    for (const h of holdings.rows) {
      try {
        const quoteRes = await axios.get(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(h.symbol)}&token=${process.env.FINNHUB_API_KEY}`
        );
        const currentPrice = quoteRes.data.c;
        totalInvestments += currentPrice * h.quantity;
      } catch (err) {
        console.warn(`Price fetch failed for ${h.symbol}: ${err.message}`);
      }
    }

    const totalValue = Number(user.balance) + totalInvestments;

    await pool.query(
      `INSERT INTO User_Value_History (user_id, balance, investments, total_value)
       VALUES ($1, $2, $3, $4)`,
      [user.id, user.balance, totalInvestments, totalValue]
    );
  }
}
// ---------------------- Daily Value Calculations Route---------------------- //

app.post("/api/run-daily-snapshot", async (req, res) => {
  try {
    await recordDailyUserValues();
    res.json({ message: "User values recorded successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Snapshot failed" });
  }
});


app.get("/api/user-history", authenticateToken, async (req, res) => {
  const filter = req.query.filter || "daily"; // daily/monthly/yearly

  let groupClause = "DATE_TRUNC('day', recorded_at)";
  if (filter === "monthly") groupClause = "DATE_TRUNC('month', recorded_at)";
  else if (filter === "yearly") groupClause = "DATE_TRUNC('year', recorded_at)";

  const result = await pool.query(
    `SELECT ${groupClause} as date, AVG(total_value) as avg_value
     FROM User_Value_History
     WHERE user_id = $1
     GROUP BY date
     ORDER BY date`,
    [req.user.id]
  );
  console.log("User history response:", result.rows);
  res.json(result.rows);
});




// ---------------------- PASSWORD RESET ---------------------- //

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// ---------------------- START SERVER ---------------------- //

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
