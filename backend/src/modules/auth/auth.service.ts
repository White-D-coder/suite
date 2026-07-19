import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EncryptionService } from '../../common/services/encryption.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async onModuleInit() {
    try {
      // 1. Core administrative users (always check / upsert)
      let owner = await this.prisma.user.findUnique({ where: { email: 'owner@agency.com' } });
      if (!owner) {
        owner = await this.prisma.user.create({
          data: {
            email: 'owner@agency.com',
            name: 'Alice Owner',
            role: 'owner',
            passwordHash: await bcrypt.hash('ownerpassword123', 10),
            company: {
              create: {
                companyName: 'My Digital Agency',
                currency: 'USD',
                invoicePrefix: 'INV-',
              },
            },
          },
        });
      }

      let admin = await this.prisma.user.findUnique({ where: { email: 'admin@agency.com' } });
      if (!admin) {
        admin = await this.prisma.user.create({
          data: {
            email: 'admin@agency.com',
            name: 'Bob Admin',
            role: 'admin',
            passwordHash: await bcrypt.hash('adminpassword123', 10),
          },
        });
      }

      let finance = await this.prisma.user.findUnique({ where: { email: 'finance@agency.com' } });
      if (!finance) {
        finance = await this.prisma.user.create({
          data: {
            email: 'finance@agency.com',
            name: 'Diana Finance',
            role: 'finance',
            passwordHash: await bcrypt.hash('financepassword123', 10),
          },
        });
      }

      let empDefault = await this.prisma.user.findUnique({ where: { email: 'employee@agency.com' } });
      if (!empDefault) {
        empDefault = await this.prisma.user.create({
          data: {
            email: 'employee@agency.com',
            name: 'Charlie Employee (US, NA)',
            role: 'employee',
            passwordHash: await bcrypt.hash('employeepassword123', 10),
          },
        });
      }

      console.log('[SEED] Core administrative users verified successfully.');
    } catch (error) {
      console.error('[SEED ERROR] Failed to seed core administrative users:', error.message);
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }
}
