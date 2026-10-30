import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailjet from 'node-mailjet';
import type { Client } from 'node-mailjet';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  // Runtime ESM : seul le default est exporté ; Client.apiConnect y est rattaché.
  private readonly client: Client;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(private readonly configService: ConfigService) {
    this.client = Mailjet.Client.apiConnect(
      this.configService.getOrThrow<string>('MJ_APIKEY_PUBLIC'),
      this.configService.getOrThrow<string>('MJ_APIKEY_PRIVATE'),
    );
    this.senderEmail = this.configService.getOrThrow<string>(
      'MAILJET_SENDER_EMAIL',
    );
    this.senderName = this.configService.getOrThrow<string>(
      'MAILJET_SENDER_NAME',
    );
  }

  async sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Confirme ton adresse email — Éclore',
      text: `Bienvenue sur Éclore.\n\nConfirme ton email en ouvrant ce lien (valable 48 h) :\n${verifyUrl}\n\nEnsuite, ouvre l’application pour te connecter.`,
      html: `<p>Bienvenue sur Éclore.</p><p><a href="${verifyUrl}">Confirmer mon email</a></p><p>Ce lien est valable 48 heures. Ensuite, ouvre l’application pour te connecter.</p>`,
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: 'Réinitialisation du mot de passe — Éclore',
      text: `Tu as demandé une réinitialisation de mot de passe.\n\nOuvre ce lien :\n${resetUrl}\n\nS’il ne s’agit pas de toi, ignore ce message.`,
      html: `<p>Tu as demandé une réinitialisation de mot de passe.</p><p><a href="${resetUrl}">Choisir un nouveau mot de passe</a></p><p>S’il ne s’agit pas de toi, ignore ce message.</p>`,
    });
  }

  private async send(params: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    try {
      await this.client.post('send', { version: 'v3.1' }).request({
        Messages: [
          {
            From: {
              Email: this.senderEmail,
              Name: this.senderName,
            },
            To: [{ Email: params.to }],
            Subject: params.subject,
            TextPart: params.text,
            HTMLPart: params.html,
          },
        ],
      });
    } catch {
      // Ne pas journaliser le corps Mailjet (email / lien).
      this.logger.error('Échec d’envoi email via Mailjet');
      throw new Error('MAIL_SEND_FAILED');
    }
  }
}
