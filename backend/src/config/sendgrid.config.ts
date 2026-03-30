import { registerAs } from '@nestjs/config';

export default registerAs('sendgrid', () => ({
  apiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@velocal.cc',
  fromName: process.env.SENDGRID_FROM_NAME || 'VeloCal',
}));
