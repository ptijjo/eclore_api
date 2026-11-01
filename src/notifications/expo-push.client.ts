import { Injectable, Logger } from '@nestjs/common';

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default' | null;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
};

/**
 * Client HTTP vers Expo Push Notification Service.
 * Permet d’alerter hors app sans Socket.IO ni FCM direct dans le code métier.
 */
@Injectable()
export class ExpoPushClient {
  private readonly logger = new Logger(ExpoPushClient.name);

  async send(messages: ExpoPushMessage[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn(`Expo Push HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
  }
}
