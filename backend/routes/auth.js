// Load required packages
const express = require("express");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");

// Create an Express router to define endpoints
const router = express.Router();

// Import helper functions to interact with the database
const { getUserByEmail, updateUserPassword } = require("../db/users");

// Set SendGrid API key for sending emails
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Route to handle password reset requests
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Look up user in the database by email
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: "Email not found" });

    // Generate a JWT token with the user's email and expiration time
    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Construct a password reset URL to send to the user
    const resetUrl = `${process.env.CLIENT_URL}/reset/${token}`;

    // Build the email message to be sent
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

    // Send the password reset email
    await sgMail.send(msg);
    res.json({ message: "Reset email sent" });

  } catch (err) {
    // Log and respond with a generic error
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Route to handle password reset form submission
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;       // Extract token from URL
  const { password } = req.body;      // Extract new password from request body

  try {
    // Decode and verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Look up the user again using the email in the token
    const user = await getUserByEmail(decoded.email);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Update the user's password in the database
    await updateUserPassword(user.email, password);

    res.json({ message: "Password has been reset" });

  } catch (err) {
    // Log and respond with error if token is invalid or expired
    console.error("Reset password error:", err);
    res.status(400).json({ error: "Invalid or expired token" });
  }
});






// Export the router so it can be used in server.js
module.exports = router;
