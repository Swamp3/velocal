import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomInt } from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpToken } from './entities/otp-token.entity';
import type { User } from '../users/entities/user.entity';

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    preferredLocale: string;
    isAdmin: boolean;
    emailVerified: boolean;
  };
}

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 3;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_PER_HOUR = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRepository(OtpToken)
    private readonly otpRepository: Repository<OtpToken>,
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

  buildAuthResponse(user: User): AuthResponse {
    const payload = { sub: user.id, email: user.email, isAdmin: user.isAdmin };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        preferredLocale: user.preferredLocale,
        isAdmin: user.isAdmin,
        emailVerified: user.emailVerified,
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
