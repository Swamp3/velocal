import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpToken } from './entities/otp-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import type { User } from '../users/entities/user.entity';

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    preferredLanguage: string;
    preferredLocale: string;
    isAdmin: boolean;
    emailVerified: boolean;
    hasPassword: boolean;
  };
}

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_PER_HOUR = 5;
const RESET_TOKEN_TTL_HOURS = 4;
const RESET_MAX_PER_HOUR = 3;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    @InjectRepository(OtpToken)
    private readonly otpRepository: Repository<OtpToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetRepository: Repository<PasswordResetToken>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async requestOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    await this.enforceOtpRateLimit(normalizedEmail);

    await this.otpRepository.delete({
      email: normalizedEmail,
      expiresAt: LessThan(new Date()),
    });

    const code = String(randomInt(100_000, 999_999));
    const codeHash = createHash('sha256').update(code).digest('hex');

    await this.otpRepository
      .createQueryBuilder()
      .delete()
      .where('email = :email', { email: normalizedEmail })
      .execute();

    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    await this.otpRepository.save(
      this.otpRepository.create({
        email: normalizedEmail,
        codeHash,
        expiresAt,
      }),
    );

    await this.mailService.sendOtp(normalizedEmail, code);

    return { message: 'OTP sent' };
  }

  async verifyOtp(
    email: string,
    code: string,
  ): Promise<AuthResponse> {
    const normalizedEmail = email.toLowerCase().trim();

    const token = await this.otpRepository.findOne({
      where: {
        email: normalizedEmail,
        expiresAt: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    if (!token) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    if (token.attempts >= OTP_MAX_ATTEMPTS) {
      await this.otpRepository.delete({ id: token.id });
      throw new UnauthorizedException('Too many attempts. Request a new code.');
    }

    const incomingHash = createHash('sha256').update(code).digest('hex');

    if (incomingHash !== token.codeHash) {
      token.attempts += 1;
      await this.otpRepository.save(token);
      throw new UnauthorizedException('Invalid or expired code');
    }

    await this.otpRepository.delete({ email: normalizedEmail });

    let user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      user = await this.usersService.create({
        email: normalizedEmail,
        emailVerified: true,
      });
    } else if (!user.emailVerified) {
      user.emailVerified = true;
      user = await this.usersService.update(user);
    }

    return this.buildAuthResponse(user);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (user) {
      await this.enforceResetRateLimit(user.id);
      await this.sendResetEmail(user);
    }

    return { message: 'If an account exists, a reset email has been sent.' };
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<AuthResponse> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const resetToken = await this.resetRepository.findOne({
      where: {
        tokenHash,
        usedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const user = await this.usersService.findById(resetToken.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    user.passwordHash = passwordHash;
    if (!user.emailVerified) user.emailVerified = true;
    const updated = await this.usersService.update(user);

    resetToken.usedAt = new Date();
    await this.resetRepository.save(resetToken);

    await this.resetRepository
      .createQueryBuilder()
      .delete()
      .where('"userId" = :userId AND "id" != :id', {
        userId: user.id,
        id: resetToken.id,
      })
      .execute();

    return this.buildAuthResponse(updated);
  }

  async changePassword(userId: string): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.enforceResetRateLimit(user.id);
    await this.sendResetEmail(user);

    return { message: 'Reset email sent.' };
  }

  private async sendResetEmail(user: User): Promise<void> {
    await this.resetRepository
      .createQueryBuilder()
      .delete()
      .where('"userId" = :userId AND "usedAt" IS NULL', {
        userId: user.id,
      })
      .execute();

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_HOURS * 3600_000,
    );

    await this.resetRepository.save(
      this.resetRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    const siteUrl = (
      this.configService.get<string>('SITE_URL') ?? 'https://velocal.cc'
    ).replace(/\/$/, '');
    const resetUrl = `${siteUrl}/auth/reset-password?token=${rawToken}`;

    await this.mailService.sendPasswordReset(user.email, resetUrl);
  }

  private async enforceResetRateLimit(userId: string): Promise<void> {
    const hourAgo = new Date(Date.now() - 3600_000);
    const count = await this.resetRepository.count({
      where: {
        userId,
        createdAt: MoreThan(hourAgo),
      },
    });
    if (count >= RESET_MAX_PER_HOUR) {
      throw new UnauthorizedException('Too many requests. Try again later.');
    }
  }

  buildAuthResponse(user: User): AuthResponse {
    const payload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        preferredLanguage: user.preferredLanguage,
        preferredLocale: user.preferredLocale,
        isAdmin: user.isAdmin,
        emailVerified: user.emailVerified,
        hasPassword: !!user.passwordHash,
      },
    };
  }

  private async enforceOtpRateLimit(email: string): Promise<void> {
    const cooldownThreshold = new Date(
      Date.now() - OTP_COOLDOWN_SECONDS * 1000,
    );
    const recentToken = await this.otpRepository.findOne({
      where: {
        email,
        createdAt: MoreThan(cooldownThreshold),
      },
    });
    if (recentToken) {
      throw new UnauthorizedException(
        `Please wait before requesting another code`,
      );
    }

    const hourAgo = new Date(Date.now() - 3600_000);
    const hourlyCount = await this.otpRepository.count({
      where: {
        email,
        createdAt: MoreThan(hourAgo),
      },
    });
    if (hourlyCount >= OTP_MAX_PER_HOUR) {
      throw new UnauthorizedException('Too many requests. Try again later.');
    }
  }
}
