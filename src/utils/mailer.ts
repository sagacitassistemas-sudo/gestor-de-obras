import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

let transporter: nodemailer.Transporter | null = null;

export const isProduction = () =>
  process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

/**
 * Resolve o endereço SMTP do Inbucket/Mailpit do Supabase local.
 * Como a porta 1025 do container não é exposta ao host, usamos o IP interno da rede Docker.
 * Fallback: tenta a variável INBUCKET_SMTP_HOST do .env, depois o IP padrão do container.
 */
const resolveInbucketSmtpHost = (): string => {
  return process.env.INBUCKET_SMTP_HOST || '172.25.0.7';
};

const createTransporter = async () => {
  if (transporter) return transporter;

  const hasSMTPConfig = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  // ─── PRODUÇÃO: SMTP real obrigatório ───
  if (hasSMTPConfig) {
    console.log(`📧 [PROD SMTP] Configurando serviço de e-mail SMTP (${process.env.SMTP_HOST})...`);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  if (isProduction()) {
    console.error('❌ ERRO CRÍTICO: Nenhuma chave SMTP_HOST/SMTP_USER configurada em ambiente de PRODUÇÃO!');
    throw new Error('Serviço de e-mail não configurado em ambiente de Produção.');
  }

  // ─── DESENVOLVIMENTO: Inbucket/Mailpit do Supabase local ───
  const inbucketHost = resolveInbucketSmtpHost();
  const inbucketPort = Number(process.env.INBUCKET_SMTP_PORT) || 1025;
  const inbucketWebPort = process.env.INBUCKET_WEB_PORT || '54644';

  console.log(`📬 [DEV SMTP] Conectando ao Inbucket/Mailpit do Supabase local (${inbucketHost}:${inbucketPort})...`);
  transporter = nodemailer.createTransport({
    host: inbucketHost,
    port: inbucketPort,
    secure: false,
    tls: { rejectUnauthorized: false },
  });

  console.log(`✅ [DEV SMTP] Inbucket configurado! Visualize os e-mails em: http://localhost:${inbucketWebPort}`);
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

    const env = isProduction() ? 'PROD' : 'DEV';
    const inbucketWebPort = process.env.INBUCKET_WEB_PORT || '54644';

    console.log(`📩 [${env}] E-mail disparado de [${sender}] para [${to}]. Message ID: ${info.messageId}`);

    if (!isProduction()) {
      console.log(`👁️‍🗨️ [DEV] Visualize em: http://localhost:${inbucketWebPort}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: !isProduction() ? `http://localhost:${inbucketWebPort}` : undefined
    };
  } catch (error) {
    console.error("❌ Erro ao enviar e-mail:", error);
    return { success: false, error };
  }
};
