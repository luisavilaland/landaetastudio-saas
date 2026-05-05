import nodemailer from "nodemailer";
import { Resend } from "resend";

const isResend = !!process.env.RESEND_API_KEY;

let resend: Resend | undefined;
let smtpTransporter: nodemailer.Transporter | undefined;

if (isResend) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "1025"),
    secure: false,
  });
}

export async function sendOrderConfirmationEmail(
  email: string,
  orderId: string,
  total: number,
  customerName: string
) {
  const from = isResend
    ? (process.env.RESEND_FROM || "onboarding@resend.dev")
    : (process.env.SMTP_FROM || "noreply@saas.local");

  const mailData = {
    from,
    to: email,
    subject: `Confirmación de tu orden ${orderId}`,
    text: `
Hola ${customerName},

Gracias por tu compra.

Orden: ${orderId}
Total: $${(total / 100).toFixed(2)} UYU

Tu pedido está siendo procesado y te notificaremos cuando esté listo para entrega.

Saludos,
El equipo de la tienda
    `.trim(),
    html: `
<h2>Gracias por tu compra, ${customerName}!</h2>
<p>Orden: <strong>${orderId}</strong></p>
<p>Total: <strong>$${(total / 100).toFixed(2)} UYU</strong></p>
<p>Tu pedido está siendo procesado y te notificaremos cuando esté listo para entrega.</p>
<p>Saludos,<br>El equipo de la tienda</p>
    `.trim(),
  };

  try {
    if (isResend && resend) {
      await resend.emails.send(mailData);
    } else if (smtpTransporter) {
      await smtpTransporter.sendMail(mailData);
    }
    console.log(`[Email] Confirmation sent to ${email} for order ${orderId}`);
  } catch (error) {
    console.error("[Email] Error sending confirmation:", error);
  }
}
