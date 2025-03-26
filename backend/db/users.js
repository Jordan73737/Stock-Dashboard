// backend/db/users.js
const pool = require("../db"); 
const bcrypt = require("bcryptjs");

async function getUserByEmail(email) {
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return result.rows[0];
}

async function updateUserPassword(email, newPassword) {
  const hashed = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password = $1 WHERE email = $2", [hashed, email]);
}

module.exports = {
  getUserByEmail,
  updateUserPassword,
};
