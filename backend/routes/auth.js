// backend/routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
const router = express.Router();

const { getUserByEmail, updateUserPassword } = require("../db/users");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// POST /api/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: "Email not found" });

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset/${token}`;

    const msg = {
      to: email,
      from: process.env.FROM_EMAIL,
      subject: "Reset your password",
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" target="_blank">Reset Password</a>
        <p>If you didn’t request this, you can ignore this email.</p>
      `,
    };

    await sgMail.send(msg);
    res.json({ message: "Reset email sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/reset-password/:token
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    if (!user) return res.status(404).json({ error: "User not found" });

    await updateUserPassword(user.email, password);

    res.json({ message: "Password has been reset" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(400).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;
