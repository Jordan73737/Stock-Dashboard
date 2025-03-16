import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const process = { env: require("dotenv").config().parsed };
const { Pool } = pg;

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create tables if they don't exist
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
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
    client.release();
  }
}

initDatabase();

// Authentication Routes
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user into database
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
      [username, hashedPassword]
    );

    // Generate token
    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, username });
  } catch (err) {
    res.status(400).json({ error: "Username already exists" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find user
    const result = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    req.user = user;
    next();
  });
}

// Favorites API
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
