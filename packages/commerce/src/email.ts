import nodemailer from "nodemailer";
import { Resend } from "resend";
import { createLogger } from "@repo/logger";

const logger = createLogger("email-service");

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
    logger.info({ email, orderId }, "Confirmation email sent");
  } catch (error) {
    logger.error({ email, orderId, error }, "Error sending confirmation email");
  }
}

export async function sendWelcomeEmail(
  email: string,
  customerName: string,
  storeName: string,
  storefrontUrl?: string
) {
  const from = isResend
    ? (process.env.RESEND_FROM || "onboarding@resend.dev")
    : (process.env.SMTP_FROM || "noreply@saas.local");

  const homeUrl = storefrontUrl || "";

  const mailData = {
    from,
    to: email,
    subject: `¡Bienvenido a ${storeName}!`,
    text: `
Hola ${customerName},

¡Gracias por registrarte en ${storeName}!

Tu cuenta ha sido creada exitosamente. Ya podés explorar nuestro catálogo y realizar tus compras.

${homeUrl ? `Visitanos en: ${homeUrl}` : ""}

Saludos,
El equipo de ${storeName}
    `.trim(),
    html: `
<h2>¡Bienvenido a ${storeName}, ${customerName}!</h2>
<p>Tu cuenta ha sido creada exitosamente.</p>
<p>Ya podés explorar nuestro catálogo y realizar tus compras.</p>
${homeUrl ? `<p><a href="${homeUrl}">Visitanos en la tienda</a></p>` : ""}
<p>Saludos,<br>El equipo de ${storeName}</p>
    `.trim(),
  };

  try {
    if (isResend && resend) {
      await resend.emails.send(mailData);
    } else if (smtpTransporter) {
      await smtpTransporter.sendMail(mailData);
    }
    logger.info({ email, storeName }, "Welcome email sent");
  } catch (error) {
    logger.error({ email, storeName, error }, "Error sending welcome email");
  }
}
