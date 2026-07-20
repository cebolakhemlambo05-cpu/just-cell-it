const nodemailer = require('nodemailer');

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || 'justcellitza826@gmail.com';

function getMailerConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return {
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass },
  };
}

async function sendContactEmail(contactMessage) {
  const config = getMailerConfig();
  if (!config) {
    return { sent: false, reason: 'SMTP settings are not configured.' };
  }

  const transporter = nodemailer.createTransport(config);
  const from = process.env.MAIL_FROM || `"Just Cell It Website" <${config.auth.user}>`;
  const replyTo = contactMessage.email;

  await transporter.sendMail({
    from,
    to: CONTACT_TO_EMAIL,
    replyTo,
    subject: `Website enquiry: ${contactMessage.subject}`,
    text: [
      `New Just Cell It website enquiry`,
      ``,
      `Name: ${contactMessage.name}`,
      `Email: ${contactMessage.email}`,
      `Phone: ${contactMessage.phone || 'Not provided'}`,
      `Subject: ${contactMessage.subject}`,
      ``,
      contactMessage.message,
    ].join('\n'),
    html: `
      <h2>New Just Cell It website enquiry</h2>
      <p><strong>Name:</strong> ${escapeHtml(contactMessage.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(contactMessage.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(contactMessage.phone || 'Not provided')}</p>
      <p><strong>Subject:</strong> ${escapeHtml(contactMessage.subject)}</p>
      <p>${escapeHtml(contactMessage.message).replace(/\n/g, '<br>')}</p>
    `,
  });

  return { sent: true };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  CONTACT_TO_EMAIL,
  sendContactEmail,
};
