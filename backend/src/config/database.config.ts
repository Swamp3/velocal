import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER || 'velocal',
  password: process.env.DB_PASSWORD || 'velocal',
  database: process.env.DB_NAME || 'velocal',
  autoLoadEntities: true,
  synchronize: false,
}));
