// Import PostgreSQL client pool to interact with the database
const { Pool } = require("pg");

// Import bcrypt for hashing passwords
const bcrypt = require("bcrypt");

// Load environment variables (like DATABASE_URL)
const dotenv = require("dotenv");
dotenv.config();

// Create a new PostgreSQL connection pool using DATABASE_URL from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// This function fetches a user from the database by their email address
async function getUserByEmail(email) {
  // SQL query to select the user where email matches the parameter
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

  // Return the first matching user (if any)
  return result.rows[0];
}

// This function updates the user's password in the database
async function updateUserPassword(email, newPassword) {
  // Hash the new password with 10 salt rounds for security
  const hashed = await bcrypt.hash(newPassword, 10);

  // Update the password in the users table where the email matches
  await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hashed, email]);
}

// Export the functions so they can be used in other files like auth.js
module.exports = {
  getUserByEmail,
  updateUserPassword,
};
