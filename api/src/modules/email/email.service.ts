import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import type { Env } from 'src/config/env';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.from = config.get('SMTP_FROM', { infer: true });
    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      auth: {
        user: config.get('SMTP_USER', { infer: true }),
        pass: config.get('SMTP_PASS', { infer: true }),
      },
    });
  }

  async sendProcessingComplete(
    to: string,
    userName: string,
    documentName: string,
  ) {
    await this.send(to, `Documento processado: ${documentName}`, `
      <h2>Olá, ${userName}!</h2>
      <p>O processamento do seu documento foi concluído com sucesso.</p>
      <table>
        <tr><td><strong>Arquivo:</strong></td><td>${documentName}</td></tr>
        <tr><td><strong>Status:</strong></td><td>✅ Processado</td></tr>
        <tr><td><strong>Horário:</strong></td><td>${new Date().toLocaleString('pt-BR')}</td></tr>
      </table>
      <p>Os dados extraídos já estão disponíveis na plataforma.</p>
    `);
  }

  async sendProcessingError(
    to: string,
    userName: string,
    documentName: string,
    reason: string,
  ) {
    await this.send(to, `Falha no processamento: ${documentName}`, `
      <h2>Olá, ${userName}!</h2>
      <p>Ocorreu um erro durante o processamento do seu documento.</p>
      <table>
        <tr><td><strong>Arquivo:</strong></td><td>${documentName}</td></tr>
        <tr><td><strong>Status:</strong></td><td>❌ Erro</td></tr>
        <tr><td><strong>Motivo:</strong></td><td>${reason}</td></tr>
        <tr><td><strong>Horário:</strong></td><td>${new Date().toLocaleString('pt-BR')}</td></tr>
      </table>
      <p>Verifique o arquivo e tente novamente ou entre em contato com o suporte.</p>
    `);
  }

  private async send(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      this.logger.error(`Falha ao enviar email para ${to}: ${err.message}`);
    }
  }
}
