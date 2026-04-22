import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail, { MailDataRequired } from '@sendgrid/mail';

const OTP_EXPIRY_MINUTES = 10;

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly replyTo?: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('sendgrid.apiKey') ?? '';
    this.fromEmail =
      this.config.get<string>('sendgrid.fromEmail') ?? 'noreply@velocal.cc';
    this.fromName = this.config.get<string>('sendgrid.fromName') ?? 'VeloCal';
    this.replyTo = this.config.get<string>('sendgrid.replyTo') || undefined;
    this.enabled = apiKey.startsWith('SG.');

    if (this.enabled) {
      sgMail.setApiKey(apiKey);
    } else {
      this.logger.warn(
        'SendGrid API key not configured — emails will be logged to console',
      );
    }
  }

  async sendOtp(email: string, code: string): Promise<void> {
    if (!this.enabled) {
      this.logger.log(`[DEV] OTP for ${email}: ${code}`);
      return;
    }

    const subject = 'Your VeloCal login code';
    const preheader = `Your login code is ${code}. Expires in ${OTP_EXPIRY_MINUTES} minutes.`;

    await this.send({
      to: email,
      from: { email: this.fromEmail, name: this.fromName },
      ...(this.replyTo ? { replyTo: this.replyTo } : {}),
      subject,
      text: this.otpText(code),
      html: this.otpHtml(code, preheader),
      categories: ['transactional', 'auth-otp'],
      // Transactional security mail: don't let SendGrid rewrite links
      // (none here, but defense in depth) or inject open-tracking pixels
      // that hurt deliverability.
      trackingSettings: {
        clickTracking: { enable: false, enableText: false },
        openTracking: { enable: false },
        subscriptionTracking: { enable: false },
      },
      mailSettings: {
        // Tells receiving MTAs this is transactional, not bulk — improves
        // Gmail/Apple Mail classification.
        bypassListManagement: { enable: false },
      },
    });
  }

  private async send(msg: MailDataRequired): Promise<void> {
    try {
      await sgMail.send(msg);
    } catch (err: unknown) {
      const e = err as {
        code?: number;
        message?: string;
        response?: { body?: unknown };
      };
      this.logger.error(
        `SendGrid send failed: code=${e.code} message=${e.message}`,
        JSON.stringify(e.response?.body ?? {}),
      );
      throw new ServiceUnavailableException('Failed to send email');
    }
  }

  private otpText(code: string): string {
    return [
      'VeloCal login code',
      '',
      `Your code: ${code}`,
      '',
      `This code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      `If you didn't request this, you can ignore this email.`,
      '',
      '— VeloCal',
    ].join('\n');
  }

  private otpHtml(code: string, preheader: string): string {
    const safeCode = this.esc(code);
    const safePreheader = this.esc(preheader);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>VeloCal login code</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;color:#18181b">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px;line-height:1px;max-height:0;max-width:0;overflow:hidden">${safePreheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table role="presentation" width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
        <tr><td style="text-align:center">
          <h1 style="margin:0 0 8px;font-size:22px;color:#18181b">VeloCal</h1>
          <p style="margin:0 0 24px;color:#71717a;font-size:14px">Your login code</p>
          <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px">
            <span style="font-size:32px;letter-spacing:8px;font-weight:700;color:#18181b;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${safeCode}</span>
          </div>
          <p style="margin:0 0 16px;color:#71717a;font-size:13px;line-height:1.5">
            This code expires in ${OTP_EXPIRY_MINUTES} minutes.<br>
            If you didn't request this, you can safely ignore this email.
          </p>
          <p style="margin:24px 0 0;color:#a1a1aa;font-size:11px">Sent by VeloCal · velocal.cc</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private esc(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (c) => map[c]);
  }
}
