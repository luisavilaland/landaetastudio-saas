import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025"),
  secure: false,
});

export async function sendOrderConfirmationEmail(
  email: string,
  orderId: string,
  total: number,
  customerName: string
) {
  const from = process.env.SMTP_FROM || "noreply@saas.local";

  const mailOptions = {
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
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Confirmation sent to ${email} for order ${orderId}`);
  } catch (error) {
    console.error("[Email] Error sending confirmation:", error);
  }
}