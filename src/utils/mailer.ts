import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

let transporter: nodemailer.Transporter | null = null;

export const isProduction = () =>
  process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

export const hasRealSMTP = () => Boolean(process.env.SMTP_HOST);

const resolveInbucketSmtpHost = (): string => {
  return process.env.INBUCKET_SMTP_HOST || '172.25.0.7';
};

const createTransporter = async () => {
  if (transporter) return transporter;

  const hasSMTP = hasRealSMTP();

  // ─── SMTP REAL (Configurado via .env) ───
  if (hasSMTP) {
    console.log(`📧 [SMTP REAL] Configurando serviço de e-mail (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})...`);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || '',
      } : undefined,
    });
    return transporter;
  }

  if (isProduction()) {
    console.error('❌ ERRO CRÍTICO: Nenhuma chave SMTP_HOST configurada em ambiente de PRODUÇÃO!');
    throw new Error('Serviço de e-mail não configurado em ambiente de Produção.');
  }

  // ─── DESENVOLVIMENTO: Inbucket/Mailpit do Supabase local ───
  const inbucketHost = resolveInbucketSmtpHost();
  const inbucketPort = Number(process.env.INBUCKET_SMTP_PORT) || 1025;
  const inbucketWebPort = process.env.INBUCKET_WEB_PORT || '54644';

  console.log(`📬 [DEV SMTP] Conectando ao Inbucket local (${inbucketHost}:${inbucketPort}). E-mails capturados em http://localhost:${inbucketWebPort}`);
  transporter = nodemailer.createTransport({
    host: inbucketHost,
    port: inbucketPort,
    secure: false,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    tls: { rejectUnauthorized: false },
  });

  return transporter;
};

export const sendEmail = async ({
  to,
  subject,
  html,
  from
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) => {
  try {
    const tp = await createTransporter();

    const defaultFrom = process.env.SMTP_FROM || '"Gestor de Obras" <no-reply@gestordeobras.com>';
    const sender = from || defaultFrom;

    const info = await tp.sendMail({
      from: sender,
      to,
      subject,
      html,
    });

    const isRealSmtp = hasRealSMTP();
    const env = isRealSmtp ? 'SMTP REAL' : 'DEV MAILTRAP';
    const inbucketWebPort = process.env.INBUCKET_WEB_PORT || '54644';

    console.log(`📩 [${env}] E-mail disparado de [${sender}] para [${to}]. Message ID: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      isRealSmtp,
      previewUrl: !isRealSmtp ? `http://localhost:${inbucketWebPort}` : undefined
    };
  } catch (error: any) {
    console.error("❌ Erro ao enviar e-mail:", error?.message || error);
    return { 
      success: false, 
      error: error?.message || String(error),
      isRealSmtp: hasRealSMTP() 
    };
  }
};

