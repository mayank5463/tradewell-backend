// const nodemailer = require("nodemailer");

// // ══════════════════════════════════════════════════════════════════════
// // EMAIL CONFIGURATION
// // ══════════════════════════════════════════════════════════════════════

// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASSWORD,
//   },
// });

// // Alternative: Use SendGrid or custom SMTP
// // const transporter = nodemailer.createTransport({
// //   host: process.env.SMTP_HOST,
// //   port: process.env.SMTP_PORT,
// //   secure: true,
// //   auth: {
// //     user: process.env.SMTP_USER,
// //     pass: process.env.SMTP_PASSWORD,
// //   },
// // });

// // ══════════════════════════════════════════════════════════════════════
// // SEND EMAIL FUNCTION
// // ══════════════════════════════════════════════════════════════════════

// async function sendEmail({ to, subject, html, text }) {
//   try {
//     if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
//       console.error("[EMAIL] Missing EMAIL_USER or EMAIL_PASSWORD in .env");
//       return null;
//     }

//     console.log(`[EMAIL] Sending "${subject}" to ${to}`);

//     const mailOptions = {
//       from: `"Tradewell" <${process.env.EMAIL_USER}>`,
//       to: to,
//       subject: subject,
//       html: html || text,
//       text: text || html.replace(/<[^>]*>/g, ""),
//     };

//     const info = await transporter.sendMail(mailOptions);
//     console.log(`[EMAIL] ✅ Sent (ID: ${info.messageId})`);
//     return info;
//   } catch (error) {
//     console.error(`[EMAIL] ❌ Failed: ${error.message}`);
//     return null;
//   }
// }

// // ══════════════════════════════════════════════════════════════════════
// // EMAIL TEMPLATES
// // ══════════════════════════════════════════════════════════════════════

// function verificationEmailTemplate(verificationLink, userName) {
//   return `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <meta charset="UTF-8">
//       <meta name="viewport" content="width=device-width, initial-scale=1.0">
//       <style>
//         * { margin: 0; padding: 0; box-sizing: border-box; }
//         body { 
//           font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
//           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
//           padding: 20px;
//           min-height: 100vh;
//         }
//         .container {
//           max-width: 500px;
//           margin: 0 auto;
//           background: #ffffff;
//           border-radius: 16px;
//           overflow: hidden;
//           box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
//         }
//         .header {
//           background: linear-gradient(135deg, #1e40af, #2F6FED);
//           padding: 40px 20px;
//           text-align: center;
//           color: #ffffff;
//         }
//         .header-logo {
//           font-size: 32px;
//           font-weight: 700;
//           letter-spacing: -1px;
//           margin-bottom: 10px;
//         }
//         .header-subtitle {
//           font-size: 14px;
//           opacity: 0.9;
//         }
//         .content {
//           padding: 40px 30px;
//           text-align: center;
//         }
//         .greeting {
//           font-size: 22px;
//           font-weight: 600;
//           color: #1a1f36;
//           margin-bottom: 15px;
//         }
//         .description {
//           font-size: 15px;
//           color: #4b5468;
//           line-height: 1.6;
//           margin-bottom: 30px;
//         }
//         .button {
//           display: inline-block;
//           padding: 14px 40px;
//           background: linear-gradient(135deg, #1e40af, #2F6FED);
//           color: #ffffff;
//           text-decoration: none;
//           border-radius: 10px;
//           font-weight: 600;
//           font-size: 15px;
//           transition: all 0.3s ease;
//           box-shadow: 0 4px 15px rgba(30, 64, 175, 0.3);
//         }
//         .button:hover {
//           transform: translateY(-2px);
//           box-shadow: 0 8px 25px rgba(30, 64, 175, 0.4);
//         }
//         .divider {
//           height: 1px;
//           background: #e5e7eb;
//           margin: 30px 0;
//         }
//         .warning {
//           font-size: 12px;
//           color: #6b7280;
//           background: #f3f4f6;
//           padding: 12px 15px;
//           border-radius: 8px;
//           margin: 20px 0;
//           border-left: 4px solid #fbbf24;
//         }
//         .footer {
//           text-align: center;
//           padding: 30px 20px;
//           background: #f9fafb;
//           border-top: 1px solid #e5e7eb;
//           font-size: 12px;
//           color: #9ca3af;
//         }
//         .features {
//           margin: 20px 0;
//           text-align: left;
//         }
//         .feature {
//           font-size: 14px;
//           color: #4b5468;
//           margin: 8px 0;
//           padding-left: 20px;
//           position: relative;
//         }
//         .feature:before {
//           content: "✓";
//           position: absolute;
//           left: 0;
//           color: #10b981;
//           font-weight: bold;
//         }
//       </style>
//     </head>
//     <body>
//       <div class="container">
//         <div class="header">
//           <div class="header-logo">📈 Tradewell</div>
//           <div class="header-subtitle">Paper Trading Made Easy</div>
//         </div>
        
//         <div class="content">
//           <div class="greeting">Welcome, ${userName}!</div>
//           <div class="description">
//             Thank you for joining Tradewell! We're excited to have you on board.
//             <br><br>
//             Ready to start trading with ₹5,00,000 virtual capital?
//           </div>

//           <div class="features">
//             <div class="feature">Real-time market data</div>
//             <div class="feature">Paper trading with virtual money</div>
//             <div class="feature">Advanced charting tools</div>
//             <div class="feature">Personalized watchlist</div>
//           </div>

//           <div class="divider"></div>

//           <div style="font-size: 13px; color: #6b7280; margin-bottom: 25px;">
//             Let's get started by verifying your email
//           </div>

//           <a href="${verificationLink}" class="button">Verify Email Address</a>

//           <div class="warning">
//             This link expires in <strong>24 hours</strong>. If you didn't create this account, please ignore this email.
//           </div>
//         </div>

//         <div class="footer">
//           <p>© ${new Date().getFullYear()} Tradewell. All rights reserved.</p>
//           <p style="margin-top: 10px;">Questions? Contact us at support@tradewell.com</p>
//         </div>
//       </div>
//     </body>
//     </html>
//   `;
// }

// function passwordResetEmailTemplate(resetLink, userName) {
//   return `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <meta charset="UTF-8">
//       <meta name="viewport" content="width=device-width, initial-scale=1.0">
//       <style>
//         * { margin: 0; padding: 0; box-sizing: border-box; }
//         body {
//           font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
//           background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
//           padding: 20px;
//           min-height: 100vh;
//         }
//         .container {
//           max-width: 500px;
//           margin: 0 auto;
//           background: #ffffff;
//           border-radius: 16px;
//           overflow: hidden;
//           box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
//         }
//         .header {
//           background: linear-gradient(135deg, #b5610a, #d97706);
//           padding: 40px 20px;
//           text-align: center;
//           color: #ffffff;
//         }
//         .header-icon {
//           font-size: 40px;
//           margin-bottom: 10px;
//         }
//         .header-title {
//           font-size: 24px;
//           font-weight: 700;
//           margin-bottom: 5px;
//         }
//         .content {
//           padding: 40px 30px;
//           text-align: center;
//         }
//         .subtitle {
//           font-size: 15px;
//           color: #4b5468;
//           line-height: 1.6;
//           margin-bottom: 30px;
//         }
//         .button {
//           display: inline-block;
//           padding: 14px 40px;
//           background: linear-gradient(135deg, #b5610a, #d97706);
//           color: #ffffff;
//           text-decoration: none;
//           border-radius: 10px;
//           font-weight: 600;
//           font-size: 15px;
//           transition: all 0.3s ease;
//           box-shadow: 0 4px 15px rgba(181, 97, 10, 0.3);
//           margin: 20px 0;
//         }
//         .button:hover {
//           transform: translateY(-2px);
//           box-shadow: 0 8px 25px rgba(181, 97, 10, 0.4);
//         }
//         .alert {
//           background: #fef3c7;
//           border: 2px solid #fbbf24;
//           border-radius: 10px;
//           padding: 20px;
//           margin: 30px 0;
//           text-align: left;
//           color: #92400e;
//         }
//         .alert-title {
//           font-weight: 600;
//           font-size: 14px;
//           margin-bottom: 8px;
//         }
//         .alert-text {
//           font-size: 13px;
//           line-height: 1.5;
//         }
//         .timeline {
//           font-size: 12px;
//           color: #6b7280;
//           margin: 20px 0;
//           padding: 10px;
//           background: #f3f4f6;
//           border-radius: 8px;
//         }
//         .footer {
//           text-align: center;
//           padding: 30px 20px;
//           background: #f9fafb;
//           border-top: 1px solid #e5e7eb;
//           font-size: 12px;
//           color: #9ca3af;
//         }
//       </style>
//     </head>
//     <body>
//       <div class="container">
//         <div class="header">
//           <div class="header-icon">🔐</div>
//           <div class="header-title">Password Reset</div>
//         </div>

//         <div class="content">
//           <div style="font-size: 18px; font-weight: 600; color: #1a1f36; margin-bottom: 15px;">
//             Hello, ${userName}!
//           </div>

//           <div class="subtitle">
//             We received a request to reset your password. Click the button below to set a new password.
//           </div>

//           <a href="${resetLink}" class="button">Reset Password Now</a>

//           <div class="timeline">
//             ⏱️ This reset link expires in <strong>30 minutes</strong>
//           </div>

//           <div class="alert">
//             <div class="alert-title">🛡️ Security Notice</div>
//             <div class="alert-text">
//               If you didn't request a password reset, your account is still secure. You can ignore this email and your password will remain unchanged.
//               <br><br>
//               <strong>Do not share this link with anyone.</strong>
//             </div>
//           </div>

//           <div style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
//             For security, never share your reset link or password with anyone.
//           </div>
//         </div>

//         <div class="footer">
//           <p>© ${new Date().getFullYear()} Tradewell. All rights reserved.</p>
//           <p style="margin-top: 10px;">Need help? Contact support@tradewell.com</p>
//         </div>
//       </div>
//     </body>
//     </html>
//   `;
// }

// function premiumWelcomeTemplate(verificationLink, userName) {
//   return `
//     <!DOCTYPE html>
//     <html>
//     <head>
//       <meta charset="UTF-8">
//       <meta name="viewport" content="width=device-width, initial-scale=1.0">
//       <style>
//         * { margin: 0; padding: 0; box-sizing: border-box; }
//         body {
//           font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
//           background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%);
//           padding: 20px;
//           min-height: 100vh;
//         }
//         .container {
//           max-width: 550px;
//           margin: 0 auto;
//           background: #ffffff;
//           border-radius: 16px;
//           overflow: hidden;
//           box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
//         }
//         .header {
//           background: linear-gradient(135deg, #8b5cf6, #d946ef);
//           padding: 50px 20px;
//           text-align: center;
//           color: #ffffff;
//           position: relative;
//           overflow: hidden;
//         }
//         .header::before {
//           content: "";
//           position: absolute;
//           top: -50%;
//           right: -50%;
//           width: 300px;
//           height: 300px;
//           background: rgba(255, 255, 255, 0.1);
//           border-radius: 50%;
//         }
//         .header-content {
//           position: relative;
//           z-index: 1;
//         }
//         .badge {
//           display: inline-block;
//           background: rgba(255, 255, 255, 0.2);
//           padding: 6px 16px;
//           border-radius: 20px;
//           font-size: 12px;
//           font-weight: 600;
//           margin-bottom: 15px;
//           backdrop-filter: blur(10px);
//         }
//         .header-title {
//           font-size: 32px;
//           font-weight: 700;
//           margin-bottom: 10px;
//           letter-spacing: -0.5px;
//         }
//         .header-subtitle {
//           font-size: 16px;
//           opacity: 0.95;
//         }
//         .content {
//           padding: 45px 35px;
//         }
//         .welcome-message {
//           font-size: 18px;
//           font-weight: 600;
//           color: #1a1f36;
//           margin-bottom: 20px;
//         }
//         .intro-text {
//           font-size: 15px;
//           color: #4b5468;
//           line-height: 1.7;
//           margin-bottom: 30px;
//         }
//         .benefits-section {
//           background: linear-gradient(135deg, #f0f4ff, #fef5ff);
//           border-radius: 12px;
//           padding: 25px;
//           margin: 30px 0;
//           border-left: 4px solid #8b5cf6;
//         }
//         .benefits-title {
//           font-size: 14px;
//           font-weight: 700;
//           color: #6d28d9;
//           margin-bottom: 15px;
//           text-transform: uppercase;
//           letter-spacing: 0.5px;
//         }
//         .benefit {
//           font-size: 14px;
//           color: #4b5468;
//           margin: 10px 0;
//           padding-left: 24px;
//           position: relative;
//         }
//         .benefit::before {
//           content: "⭐";
//           position: absolute;
//           left: 0;
//           font-size: 16px;
//         }
//         .cta-section {
//           text-align: center;
//           margin: 35px 0;
//         }
//         .button {
//           display: inline-block;
//           padding: 15px 45px;
//           background: linear-gradient(135deg, #8b5cf6, #d946ef);
//           color: #ffffff;
//           text-decoration: none;
//           border-radius: 10px;
//           font-weight: 600;
//           font-size: 15px;
//           transition: all 0.3s ease;
//           box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
//         }
//         .button:hover {
//           transform: translateY(-3px);
//           box-shadow: 0 8px 30px rgba(139, 92, 246, 0.6);
//         }
//         .note {
//           font-size: 13px;
//           color: #6b7280;
//           text-align: center;
//           margin: 20px 0;
//           padding: 12px;
//           background: #f3f4f6;
//           border-radius: 8px;
//         }
//         .premium-badge {
//           display: inline-block;
//           background: linear-gradient(135deg, #8b5cf6, #d946ef);
//           color: #ffffff;
//           padding: 4px 12px;
//           border-radius: 20px;
//           font-size: 11px;
//           font-weight: 700;
//           margin-left: 8px;
//           text-transform: uppercase;
//         }
//         .footer {
//           text-align: center;
//           padding: 30px 20px;
//           background: #f9fafb;
//           border-top: 1px solid #e5e7eb;
//           font-size: 12px;
//           color: #9ca3af;
//         }
//       </style>
//     </head>
//     <body>
//       <div class="container">
//         <div class="header">
//           <div class="header-content">
//             <div class="badge">🎉 PREMIUM ACTIVATED</div>
//             <div class="header-title">Welcome to Tradewell Premium</div>
//             <div class="header-subtitle">Unlock advanced trading features</div>
//           </div>
//         </div>

//         <div class="content">
//           <div class="welcome-message">
//             Welcome, ${userName}! <span class="premium-badge">Pro</span>
//           </div>

//           <div class="intro-text">
//             Congratulations! You now have access to Tradewell Premium. Your account has been upgraded with exclusive features to enhance your trading experience.
//           </div>

//           <div class="benefits-section">
//             <div class="benefits-title">Premium Features Included</div>
//             <div class="benefit">Advanced technical analysis tools</div>
//             <div class="benefit">Priority market alerts & notifications</div>
//             <div class="benefit">Extended trading hours simulation</div>
//             <div class="benefit">Advanced portfolio analytics</div>
//             <div class="benefit">Priority customer support</div>
//             <div class="benefit">Unlimited watchlist & strategy backtesting</div>
//           </div>

//           <div class="cta-section">
//             <p style="font-size: 14px; color: #4b5468; margin-bottom: 20px;">
//               Let's get started! Verify your email to unlock all premium features.
//             </p>
//             <a href="${verificationLink}" class="button">Verify Email & Start Trading</a>
//           </div>

//           <div class="note">
//             ⏱️ Verification link expires in <strong>24 hours</strong>
//           </div>
//         </div>

//         <div class="footer">
//           <p><strong>Premium Account Status:</strong> Active for 30 days</p>
//           <p style="margin-top: 10px; color: #d1d5db;">© ${new Date().getFullYear()} Tradewell. All rights reserved.</p>
//           <p style="margin-top: 8px;">Questions? Email support@tradewell.com</p>
//         </div>
//       </div>
//     </body>
//     </html>
//   `;
// }

// module.exports = {
//   sendEmail,
//   verificationEmailTemplate,
//   passwordResetEmailTemplate,
//   premiumWelcomeTemplate,
// };
































































































































const nodemailer = require("nodemailer");

// ══════════════════════════════════════════════════════════════════════
// EMAIL CONFIGURATION
// ══════════════════════════════════════════════════════════════════════

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// ══════════════════════════════════════════════════════════════════════
// SEND EMAIL FUNCTION
// ══════════════════════════════════════════════════════════════════════

async function sendEmail({ to, subject, html, text }) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.error("[EMAIL] Missing EMAIL_USER or EMAIL_PASSWORD in .env");
      return null;
    }

    console.log(`[EMAIL] Sending "${subject}" to ${to}`);

    const mailOptions = {
      from: `"Tradewell" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html || text,
      text: text || html.replace(/<[^>]*>/g, ""),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] ✅ Sent (ID: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`[EMAIL] ❌ Failed: ${error.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// WELCOME EMAIL TEMPLATE - No Verification Required!
// ══════════════════════════════════════════════════════════════════════

function welcomeEmailTemplate(userName) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Tradewell</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
          background: linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 100%);
          padding: 20px;
          min-height: 100vh;
        }
        .container {
          max-width: 580px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.12);
        }
        .header {
          background: linear-gradient(135deg, #1a2a6c, #2d4a9e, #4a7cf7);
          padding: 45px 30px 35px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: "";
          position: absolute;
          top: -60%;
          right: -30%;
          width: 400px;
          height: 400px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 50%;
        }
        .header::after {
          content: "";
          position: absolute;
          bottom: -40%;
          left: -20%;
          width: 300px;
          height: 300px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 50%;
        }
        .header-content {
          position: relative;
          z-index: 1;
        }
        .logo-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 12px;
        }
        .logo-circle {
          width: 70px;
          height: 70px;
          background: linear-gradient(135deg, #ffffff, #e8edff);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 800;
          color: #1a2a6c;
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
          font-family: 'Arial Black', sans-serif;
          letter-spacing: -1px;
        }
        .logo-text {
          color: #ffffff;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.5px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .logo-text span {
          font-weight: 300;
          opacity: 0.8;
        }
        .header-subtitle {
          color: rgba(255,255,255,0.9);
          font-size: 15px;
          font-weight: 400;
          margin-top: 4px;
          letter-spacing: 0.5px;
        }
        .content {
          padding: 40px 35px 30px;
        }
        .greeting {
          font-size: 26px;
          font-weight: 700;
          color: #1a1f36;
          margin-bottom: 10px;
          letter-spacing: -0.3px;
        }
        .greeting-highlight {
          background: linear-gradient(135deg, #1a2a6c, #4a7cf7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .intro-text {
          font-size: 16px;
          color: #4b5468;
          line-height: 1.7;
          margin-bottom: 25px;
        }
        .intro-text strong {
          color: #1a2a6c;
        }
        .features-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 25px 0 30px;
        }
        .feature-item {
          background: #f8faff;
          border-radius: 12px;
          padding: 16px 18px;
          border-left: 4px solid #4a7cf7;
          transition: all 0.2s ease;
        }
        .feature-item:hover {
          background: #f0f5ff;
          transform: translateX(3px);
        }
        .feature-icon {
          font-size: 20px;
          margin-bottom: 6px;
          display: block;
        }
        .feature-title {
          font-size: 14px;
          font-weight: 600;
          color: #1a1f36;
          margin-bottom: 3px;
        }
        .feature-desc {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
        }
        .stats-section {
          background: linear-gradient(135deg, #f8faff, #f0f5ff);
          border-radius: 14px;
          padding: 20px 25px;
          margin: 25px 0 30px;
          border: 1px solid #e8edf8;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          text-align: center;
        }
        .stat-number {
          font-size: 24px;
          font-weight: 700;
          color: #1a2a6c;
          display: block;
        }
        .stat-label {
          font-size: 12px;
          color: #6b7280;
        }
        .cta-section {
          text-align: center;
          margin: 30px 0 20px;
          padding-top: 25px;
          border-top: 2px solid #f0f4ff;
        }
        .cta-button {
          display: inline-block;
          padding: 16px 50px;
          background: linear-gradient(135deg, #1a2a6c, #4a7cf7);
          color: #ffffff;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(26, 42, 108, 0.3);
        }
        .cta-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 35px rgba(26, 42, 108, 0.4);
        }
        .cta-sub {
          font-size: 13px;
          color: #6b7280;
          margin-top: 12px;
        }
        .divider {
          height: 1px;
          background: #e5e9f2;
          margin: 30px 0 20px;
        }
        .footer {
          text-align: center;
          padding: 25px 30px;
          background: #fafbff;
          border-top: 1px solid #e5e9f2;
          font-size: 12px;
          color: #9ca3af;
        }
        .footer-links {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-bottom: 12px;
        }
        .footer-links a {
          color: #6b7280;
          text-decoration: none;
          font-size: 12px;
        }
        .footer-links a:hover {
          color: #1a2a6c;
        }
        .footer-social {
          display: flex;
          justify-content: center;
          gap: 14px;
          margin: 12px 0;
        }
        .footer-social span {
          color: #6b7280;
          font-size: 18px;
        }
        .footer-copy {
          color: #b0b8c8;
          font-size: 11px;
        }
        @media (max-width: 480px) {
          .features-grid {
            grid-template-columns: 1fr;
          }
          .stats-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .content {
            padding: 30px 20px;
          }
          .logo-circle {
            width: 55px;
            height: 55px;
            font-size: 26px;
          }
          .logo-text {
            font-size: 22px;
          }
          .header {
            padding: 30px 20px 25px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-content">
            <div class="logo-container">
              <div class="logo-circle">TD</div>
              <div class="logo-text">Trade<span>well</span></div>
            </div>
            <div class="header-subtitle">Paper Trading Platform</div>
          </div>
        </div>
        
        <div class="content">
          <div class="greeting">
            Welcome, <span class="greeting-highlight">${userName}</span>! 🎉
          </div>

          <div class="intro-text">
            <strong>You're all set!</strong> Your Tradewell account has been created. 
            You now have <strong>₹5,00,000</strong> in virtual capital to start paper trading 
            — completely risk-free. Learn the markets, test strategies, and build 
            your trading skills without losing real money.
          </div>

          <div class="features-grid">
            <div class="feature-item">
              <span class="feature-icon">📊</span>
              <div class="feature-title">Live Market Data</div>
              <div class="feature-desc">Real-time prices &amp; charts</div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">💰</span>
              <div class="feature-title">Virtual Capital</div>
              <div class="feature-desc">₹5L to trade with</div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📈</span>
              <div class="feature-title">Track Performance</div>
              <div class="feature-desc">Holdings &amp; P&L tracker</div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">⭐</span>
              <div class="feature-title">Watchlist</div>
              <div class="feature-desc">Follow your favorite stocks</div>
            </div>
          </div>

          <div class="stats-section">
            <div class="stats-grid">
              <div>
                <span class="stat-number">1,500+</span>
                <span class="stat-label">Stocks Available</span>
              </div>
              <div>
                <span class="stat-number">₹5L</span>
                <span class="stat-label">Virtual Capital</span>
              </div>
              <div>
                <span class="stat-number">24/7</span>
                <span class="stat-label">Practice Anytime</span>
              </div>
            </div>
          </div>

          <div class="cta-section">
            <a href="${process.env.DASHBOARD_URL || 'http://localhost:3000'}" class="cta-button">
              🚀 Start Trading Now
            </a>
            <div class="cta-sub">Your journey to becoming a confident trader starts here</div>
          </div>

          <div class="divider"></div>

          <div style="font-size: 14px; color: #6b7280; text-align: center; line-height: 1.6;">
            <strong style="color: #1a1f36;">💡 Pro Tip:</strong> Start with small trades, 
            learn the patterns, and gradually build your strategy. Every expert was once a beginner!
          </div>
        </div>

        <div class="footer">
          <div class="footer-links">
            <a href="${process.env.DASHBOARD_URL || 'http://localhost:3000'}/dashboard">Dashboard</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
          </div>
          <div class="footer-social">
            <span>🐦</span>
            <span>📘</span>
            <span>📸</span>
            <span>💼</span>
          </div>
          <div class="footer-copy">
            © ${new Date().getFullYear()} Tradewell. All rights reserved.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ══════════════════════════════════════════════════════════════════════
// PASSWORD RESET TEMPLATE (Keep this)
// ══════════════════════════════════════════════════════════════════════

function passwordResetEmailTemplate(resetLink, userName) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          padding: 20px;
          min-height: 100vh;
        }
        .container {
          max-width: 500px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .header {
          background: linear-gradient(135deg, #1a2a6c, #4a7cf7);
          padding: 35px 20px;
          text-align: center;
          color: #ffffff;
        }
        .logo-circle {
          width: 50px;
          height: 50px;
          background: #ffffff;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          color: #1a2a6c;
          margin-bottom: 8px;
          font-family: 'Arial Black', sans-serif;
        }
        .header-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 2px;
        }
        .header-sub {
          font-size: 13px;
          opacity: 0.85;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .subtitle {
          font-size: 15px;
          color: #4b5468;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .button {
          display: inline-block;
          padding: 14px 40px;
          background: linear-gradient(135deg, #1a2a6c, #4a7cf7);
          color: #ffffff;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 15px;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(26, 42, 108, 0.3);
          margin: 20px 0;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(26, 42, 108, 0.4);
        }
        .alert {
          background: #fef3c7;
          border: 2px solid #fbbf24;
          border-radius: 10px;
          padding: 20px;
          margin: 30px 0;
          text-align: left;
          color: #92400e;
        }
        .alert-title {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .alert-text {
          font-size: 13px;
          line-height: 1.5;
        }
        .timeline {
          font-size: 12px;
          color: #6b7280;
          margin: 20px 0;
          padding: 10px;
          background: #f3f4f6;
          border-radius: 8px;
        }
        .footer {
          text-align: center;
          padding: 25px 20px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-circle">TD</div>
          <div class="header-title">Tradewell</div>
          <div class="header-sub">Password Reset</div>
        </div>

        <div class="content">
          <div style="font-size: 18px; font-weight: 600; color: #1a1f36; margin-bottom: 15px;">
            Hello, ${userName}!
          </div>

          <div class="subtitle">
            We received a request to reset your password. Click the button below to set a new password.
          </div>

          <a href="${resetLink}" class="button">Reset Password Now</a>

          <div class="timeline">
            ⏱️ This reset link expires in <strong>30 minutes</strong>
          </div>

          <div class="alert">
            <div class="alert-title">🛡️ Security Notice</div>
            <div class="alert-text">
              If you didn't request a password reset, your account is still secure. You can ignore this email and your password will remain unchanged.
              <br><br>
              <strong>Do not share this link with anyone.</strong>
            </div>
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
  welcomeEmailTemplate,
  passwordResetEmailTemplate,
};