// Import required modules
const express = require("express"); // Web framework for creating routes
const cors = require("cors"); // Middleware to handle Cross-Origin requests
const bcrypt = require("bcrypt"); // For password hashing
const jwt = require("jsonwebtoken"); // For token generation and verification
const { Pool } = require("pg"); // PostgreSQL client
const dotenv = require("dotenv"); // For loading environment variables
dotenv.config(); // Load environment variables from .env file

// Initialize Express app
const app = express();
app.use(cors()); // Allow CORS requests
app.use(express.json()); // Automatically parse incoming JSON in requests

// Set up PostgreSQL database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Uses DATABASE_URL from .env
});

// Initialize database: create tables if they don't already exist
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
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
    `);
  } finally {
    client.release(); // Always release the client back to the pool
  }
}
initDatabase(); // Run the DB setup on server start

// ---------------------- AUTHENTICATION ROUTES ---------------------- //

// Register a new user
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Hash the user's password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user into DB and return their new ID
    const result = await pool.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id",
      [email, hashedPassword]
    );

    // Generate a JWT token with the user's ID
    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: "7d", // Token valid for 7 days
    });

    res.json({ token, email }); // Respond with token and email
  } catch (err) {
    // Catch DB errors (like duplicate email)
    if (err.code === "23505") {
      // PostgreSQL unique constraint violation
      return res.status(400).json({ error: "This user already exists" });
    }
    res.status(500).json({ error: "Server error" });
  }
});

// Log in a user
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Compare input password with hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate a JWT token if credentials are valid
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, email }); // Respond with token and email
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------- AUTH MIDDLEWARE ---------------------- //

// Middleware to protect private routes by verifying JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Format: "Bearer <token>"

  if (!token) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user; // Attach user info to request object
    next(); // Proceed to the next middleware or route
  });
}

// ---------------------- FAVORITES API ---------------------- //

// Get user's favorite stocks
app.get("/api/favorites", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM favorites WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(result.rows); // Send back user's favorites
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add a new favorite stock
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

// Remove a favorite stock
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

// ---------------------- MOUNT PASSWORD RESET ROUTES ---------------------- //

// Import and use routes for password reset (handled in separate file)
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes); // Mounts to /api/auth/forgot-password and /reset-password

// ---------------------- START THE SERVER ---------------------- //

// Run server on specified port or default to 5000
const PORT = process.env.PORT || 5000;
// Add this BEFORE app.listen
app.get("/api/popular-stocks", async (req, res) => {
  const axios = require("axios");

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
  ];

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const quoteRes = await axios.get(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
        );
        const profileRes = await axios.get(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
        );

        return {
          name: profileRes.data.name || symbol,
          symbol,
          change: quoteRes.data.dp.toFixed(2) + "%",
          sell: `$${quoteRes.data.c}`,
          buy: `$${(quoteRes.data.c + 1).toFixed(2)}`,
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error("Error fetching stocks from Finnhub:", err.message);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get("/api/popular-stocks", async (req, res) => {
  const axios = require("axios");

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
  ];

  try {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        const quoteRes = await axios.get(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
        );
        const profileRes = await axios.get(
          `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`
        );

        return {
          name: profileRes.data.name || symbol,
          symbol,
          change: quoteRes.data.dp.toFixed(2) + "%",
          sell: `$${quoteRes.data.c}`,
          buy: `$${(quoteRes.data.c + 1).toFixed(2)}`,
        };
      })
    );

    res.json(results);
  } catch (err) {
    console.error("Error fetching stocks from Finnhub:", err.message);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});
