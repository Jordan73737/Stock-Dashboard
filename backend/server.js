// Import required modules
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const dotenv = require("dotenv");
const axios = require("axios");
dotenv.config();

// Initialize Express app
const app = express();
const allowedOrigins = ["https://stock-dashboard-drab.vercel.app"];
// CORS browser security feature tells backend that its ok to fetch data for a different front domain (CORS prevents unauthorized cross-origin requests)
// Adds response headers like:
// Access-Control-Allow-Origin: https://stock-dashboard-drab.vercel.app
// Access-Control-Allow-Credentials: true

//Function call to use CORS middlewhere with settings: allow this origin to accept credentials
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // cookies or headers are allowed
  })
);

app.use(express.json());

// Set up PostgreSQL database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize database tables if they don't already exist
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        balance NUMERIC DEFAULT 100000,  -- Default balance
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
      quantity NUMERIC NOT NULL,  -- ✅ was INTEGER
      buy_price NUMERIC NOT NULL, -- ✅ was likely fine
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, symbol)
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

// ---------------------- AUTH MIDDLEWARE ---------------------- //

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

app.post("/api/holdings/buy", authenticateToken, async (req, res) => {
  const { symbol, name, quantity, buy_price } = req.body;
  try {
    await pool.query(
      `INSERT INTO holdings (user_id, symbol, name, quantity, buy_price)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, symbol)
       DO UPDATE SET quantity = holdings.quantity + $4`,
      [req.user.id, symbol, name, quantity, buy_price]
    );

    // Deduct balance too
    const totalCost = quantity * buy_price;
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

  // ✅ Add this log to inspect incoming payload
  console.log("🟡 Sell request received:", {
    user: req.user.id,
    symbol,
    quantity,
  });

  if (!symbol || quantity === undefined || isNaN(quantity) || quantity <= 0) {
    console.warn("❌ Invalid sell payload:", { symbol, quantity });
    return res.status(400).json({ error: "Invalid sell request payload" });
  }

  try {
    // ✅ Add log before fetching from DB
    console.log("🔍 Fetching current holding for", symbol);

    const result = await pool.query(
      `SELECT quantity, buy_price FROM holdings WHERE user_id = $1 AND symbol = $2`,
      [req.user.id, symbol]
    );

    if (result.rows.length === 0) {
      console.warn("⚠️ No holdings found for symbol:", symbol);
      return res.status(400).json({ error: "You don't own this stock" });
    }

    const current = result.rows[0];

    if (quantity > current.quantity) {
      console.warn("⚠️ Trying to sell more than owned:", {
        owned: current.quantity,
        tryingToSell: quantity,
      });
      return res.status(400).json({ error: "Insufficient stock quantity" });
    }

    const proceeds = quantity * current.buy_price;

    // ✅ Log what's about to happen
    console.log(
      `🟢 Selling ${quantity} of ${symbol}, proceeds = $${proceeds.toFixed(2)}`
    );

    // Update or delete holding
    if (quantity === current.quantity) {
      await pool.query(
        `DELETE FROM holdings WHERE user_id = $1 AND symbol = $2`,
        [req.user.id, symbol]
      );
      console.log(`🧹 Fully sold ${symbol}, holding deleted.`);
    } else {
      await pool.query(
        `UPDATE holdings SET quantity = quantity - $1 WHERE user_id = $2 AND symbol = $3`,
        [quantity, req.user.id, symbol]
      );
      console.log(`✏️ Partially sold ${symbol}, updated remaining quantity.`);
    }

    // ✅ Log balance update
    await pool.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [
      proceeds,
      req.user.id,
    ]);
    console.log(`💰 Balance updated: +$${proceeds.toFixed(2)}`);

    res.json({ message: "Stock sold", proceeds });
  } catch (err) {
    console.error("❌ Sell failed:", err.message, err.stack);
    res.status(500).json({ error: "Sell failed", details: err.message });
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
    "BRK.B",
    "JPM",
    "V",
    "UNH",
    "PG",
    "XOM",
    "HD",
    "MA",
    "PFE",
    "BAC",
    "KO",
    "DIS",
    "NFLX",
  ];

  const nameMap = {
    AAPL: "Apple Inc.",
    MSFT: "Microsoft Corporation",
    GOOGL: "Alphabet Inc.",
    AMZN: "Amazon.com, Inc.",
    TSLA: "Tesla, Inc.",
    META: "Meta Platforms, Inc.",
    NVDA: "NVIDIA Corporation",
    "BRK.B": "Berkshire Hathaway Inc.",
    JPM: "JPMorgan Chase & Co.",
    V: "Visa Inc.",
    UNH: "United Health Group Incorporated",
    PG: "Procter & Gamble Company",
    XOM: "Exxon Mobil Corporation",
    HD: "The Home Depot, Inc.",
    MA: "Mastercard Inc.",
    PFE: "Pfizer Inc.",
    BAC: "Bank of America Corporation",
    KO: "Coca-Cola",
    DIS: "The Walt Disney Company",
    NFLX: "Netflix Inc.",
  };

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const encodedSymbol = encodeURIComponent(symbol);
          const quoteRes = await axios.get(
            `https://finnhub.io/api/v1/quote?symbol=${encodedSymbol}&token=${process.env.FINNHUB_API_KEY}`
          );

          const price = quoteRes.data.c;

          return {
            name: nameMap[symbol] || symbol,
            symbol,
            change: quoteRes.data.dp?.toFixed(2) + "%" || "N/A",
            sell: `$${price?.toFixed(2) || "N/A"}`,
            buy: `$${(price + 1)?.toFixed(2) || "N/A"}`,
          };
        } catch (innerErr) {
          console.warn(`Skipping ${symbol}: ${innerErr.message}`);
          return null;
        }
      })
    );

    res.json(results.filter(Boolean)); // Filter out any null (failed) results
  } catch (err) {
    console.error("Error fetching stocks from Finnhub:", err.message);
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

// Get holdings
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

// ---------------------- PASSWORD RESET ---------------------- //

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// ---------------------- START SERVER ---------------------- //

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
