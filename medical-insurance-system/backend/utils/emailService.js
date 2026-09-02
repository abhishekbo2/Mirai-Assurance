const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const { SMTP_HOST, SMTP_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) {
    throw new Error('Email service is not configured. Check SMTP environment variables.');
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: EMAIL_FROM,
    to: options.email,
    subject: options.subject,
    text: options.message,
  });
};

module.exports = sendEmail;
