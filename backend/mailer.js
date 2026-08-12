const nodemailer = require('nodemailer');
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'mhub3580@gmail.com';

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendContactEmail(message) {
  const transporter = createTransporter();
  if (!transporter) return { sent: false, reason: 'SMTP is not configured.' };
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: CONTACT_TO_EMAIL,
    replyTo: message.email,
    subject: `[MobileHub] ${message.subject}`,
    text: `Name: ${message.name}\nEmail: ${message.email}\nPhone: ${message.phone || 'Not provided'}\n\n${message.message}`,
  });
  return { sent: true };
}
module.exports = { CONTACT_TO_EMAIL, sendContactEmail };
