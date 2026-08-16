import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

let transporter: nodemailer.Transporter | null = null;

const createTransporter = async () => {
  if (transporter) return transporter;

  // Use real SMTP if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  // Fallback to Ethereal Email for testing
  console.log('⚠️ Nenhuma configuração SMTP encontrada no .env. Gerando conta Ethereal para testes...');
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
  console.log('✅ Ethereal configurado! E-mails enviados poderão ser vistos na URL do console.');
  return transporter;
};

export const sendEmail = async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
  try {
    const tp = await createTransporter();
    
    const info = await tp.sendMail({
      from: process.env.SMTP_FROM || '"Gestor de Obras" <no-reply@gestordeobras.com>',
      to,
      subject,
      html,
    });

    console.log(`📩 E-mail disparado para ${to}. Message ID: ${info.messageId}`);
    
    // Log ethereal url if using ethereal
    if (info.messageId && !process.env.SMTP_HOST) {
      console.log(`👁️‍🗨️ Preview URL do E-mail (Ethereal Test): ${nodemailer.getTestMessageUrl(info)}`);
    }

    return true;
  } catch (error) {
    console.error("❌ Erro ao enviar e-mail:", error);
    return false;
  }
};
