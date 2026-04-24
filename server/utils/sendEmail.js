import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendOtpEmail(to, otp) {
  await transporter.sendMail({
    from: `"MenuLens" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your MenuLens OTP',
    text: `Your one-time password is: ${otp}\n\nThis OTP expires in 10 minutes. Do not share it with anyone.`,
    html: `<p>Your one-time password is: <strong>${otp}</strong></p><p>This OTP expires in 10 minutes. Do not share it with anyone.</p>`,
  });
}
