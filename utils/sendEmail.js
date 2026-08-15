const nodemailer = require("nodemailer");

// ── EMAIL CONFIGURATION ─────────────────────────────────────────────────
// WHY: Sends verification and password reset emails
// Options:
// 1. Gmail (free, but requires app password)
// 2. SendGrid (professional, 100 emails/day free)
// 3. Mailgun (10,000 emails/month free)
// 4. Amazon SES (62,000 emails/month free)

// ── TRANSPORTER SETUP ──────────────────────────────────────────────────
// Using Gmail as example (you can switch to any provider)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your.email@gmail.com
    pass: process.env.EMAIL_PASSWORD, // App password (NOT your regular password)
  },
});

// ── ALTERNATIVE: Using SMTP directly ───────────────────────────────────
// For production, use professional email service
/*
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST, // smtp.sendgrid.net
  port: process.env.SMTP_PORT, // 587
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});
*/

// ── SEND EMAIL FUNCTION ────────────────────────────────────────────────
// WHY: Centralized email sending with error handling
async function sendEmail({ to, subject, html, text }) {
  try {
    console.log("[EMAIL] Sending email to:", to);
    console.log("[EMAIL] Subject:", subject);

    const mailOptions = {
      from: `"Tradewell" <${process.env.EMAIL_USER || "noreply@tradewell.com"}>`,
      to: to,
      subject: subject,
      html: html || text,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("[EMAIL] ✅ Sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("[EMAIL] ❌ Failed to send:", error.message);
    // Don't throw - email failure shouldn't crash the app
    return null;
  }
}

// ── EMAIL TEMPLATES ────────────────────────────────────────────────────
// WHY: Consistent, professional email templates

function verificationEmailTemplate(verificationLink, userName) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f7fa; }
        .container { max-width: 500px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1e40af, #2F6FED); padding: 30px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .content { padding: 30px 25px; }
        .content p { color: #333; font-size: 15px; line-height: 1.6; margin: 10px 0; }
        .button { display: inline-block; padding: 13px 30px; background: #2F6FED; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 20px 0; }
        .button:hover { background: #1d4ed8; }
        .footer { text-align: center; padding: 20px; background: #f9fafb; color: #888; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 Tradewell</h1>
        </div>
        <div class="content">
          <h2>Welcome, ${userName}!</h2>
          <p>Thank you for signing up for Tradewell. Please verify your email address to get started.</p>
          <p>Your virtual ₹5,00,000 is waiting for you!</p>
          <a href="${verificationLink}" class="button">Verify Email</a>
          <p style="color: #888; font-size: 13px;">This link expires in 24 hours.</p>
          <p style="color: #888; font-size: 13px;">If you didn't create this account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Tradewell. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function passwordResetEmailTemplate(resetLink, userName) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f7fa; }
        .container { max-width: 500px; margin: 20px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #b5610a, #f59e0b); padding: 30px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
        .content { padding: 30px 25px; }
        .content p { color: #333; font-size: 15px; line-height: 1.6; margin: 10px 0; }
        .button { display: inline-block; padding: 13px 30px; background: #f59e0b; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 20px 0; }
        .button:hover { background: #b5610a; }
        .warning { background: #fef3c7; border: 1px solid #fbbf24; padding: 12px; border-radius: 8px; color: #92400e; font-size: 13px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; background: #f9fafb; color: #888; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset</h1>
        </div>
        <div class="content">
          <h2>Hello, ${userName}!</h2>
          <p>We received a request to reset your password.</p>
          <a href="${resetLink}" class="button">Reset Password</a>
          <p style="color: #888; font-size: 13px;">This link expires in 30 minutes.</p>
          <div class="warning">
            <strong>⚠️ Security Alert:</strong> If you didn't request this, please ignore this email. Your password won't change.
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Tradewell. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { 
  sendEmail, 
  verificationEmailTemplate, 
  passwordResetEmailTemplate 
};