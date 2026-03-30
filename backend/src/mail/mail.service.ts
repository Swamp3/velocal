import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('sendgrid.apiKey') || '';
    this.fromEmail = this.config.get<string>('sendgrid.fromEmail')!;
    this.fromName = this.config.get<string>('sendgrid.fromName')!;
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
    const subject = 'Your VeloCal login code';
    const html = this.otpTemplate(code);

    if (!this.enabled) {
      this.logger.log(`[DEV] OTP for ${email}: ${code}`);
      return;
    }

    await sgMail.send({
      to: email,
      from: { email: this.fromEmail, name: this.fromName },
      subject,
      html,
    });
  }

  private otpTemplate(code: string): string {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <tr><td style="text-align:center">
          <h1 style="margin:0 0 8px;font-size:22px;color:#18181b">VeloCal</h1>
          <p style="margin:0 0 24px;color:#71717a;font-size:14px">Your login code</p>
          <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px">
            <span style="font-size:32px;letter-spacing:8px;font-weight:700;color:#18181b">${code}</span>
          </div>
          <p style="margin:0;color:#71717a;font-size:13px">This code expires in 10 minutes.<br>If you didn't request this, you can ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
  }
}
