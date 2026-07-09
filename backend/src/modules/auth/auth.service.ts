import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    try {
      const adminCount = await this.prisma.admin.count();
      if (adminCount === 0) {
        const email = 'admin@agency.com';
        const password = 'adminpassword123';
        const passwordHash = await bcrypt.hash(password, 10);
        
        await this.prisma.admin.create({
          data: {
            email,
            passwordHash,
            company: {
              create: {
                companyName: 'My Digital Agency',
                currency: 'USD',
                invoicePrefix: 'INV-',
              },
            },
          },
        });
        console.log(`[SEED] Created default admin account: ${email} / ${password}`);
      }

      // Seed visual telemetry data if none exists
      const clientCount = await this.prisma.client.count();
      if (clientCount === 0) {
        const client = await this.prisma.client.create({
          data: {
            name: 'John Doe',
            company: 'Acme Corporation',
            email: 'billing@acme.com',
            phone: '+1 555-0199',
            country: 'United States',
            currency: 'USD',
            paymentTerms: 'Net 30',
            notes: 'High value client, handles e-commerce operations.',
          },
        });

        // Project 1 (Online)
        await this.prisma.project.create({
          data: {
            name: 'Acme E-Commerce Platform',
            clientId: client.id,
            status: 'active',
            description: 'Acme online shop rebuild with microservices.',
            githubRepoUrl: 'https://github.com/acme/shop-rebuild',
            liveUrl: 'https://acme-shop-demo.com',
            hostingPlatform: 'AWS',
            databasePlatform: 'PostgreSQL',
            deploymentPlatform: 'GitHub Actions',
            techStack: ['NestJS', 'React', 'TypeScript', 'Tailwind'],
            websiteMonitors: {
              create: {
                url: 'https://acme-shop-demo.com',
                lastStatus: 'online',
                sslExpiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000), // 30 days out
                domainExpiryDate: new Date(Date.now() + 120 * 24 * 3600 * 1000),
                lastCheckedAt: new Date(),
              },
            },
            tasks: {
              createMany: {
                data: [
                  {
                    name: 'Configure AWS database replication',
                    assignedTo: 'Lead Dev',
                    progress: 75,
                    status: 'in_progress',
                    deadline: new Date(Date.now() + 5 * 24 * 3600 * 1000),
                  },
                  {
                    name: 'Design Stripe checkout templates',
                    assignedTo: 'UX Lead',
                    progress: 100,
                    status: 'done',
                    deadline: new Date(Date.now() - 2 * 24 * 3600 * 1000),
                  },
                ],
              },
            },
          },
        });

        // Project 2 (Offline - trigger warning)
        await this.prisma.project.create({
          data: {
            name: 'Internal Legacy Portal',
            clientId: client.id,
            status: 'active',
            description: 'Legacy employee dashboard instance.',
            githubRepoUrl: 'https://github.com/acme/legacy-portal',
            liveUrl: 'https://legacy-portal-offline-demo.com',
            hostingPlatform: 'Heroku',
            databasePlatform: 'MongoDB',
            deploymentPlatform: 'Manual',
            techStack: ['Node.js', 'Express', 'EJS'],
            websiteMonitors: {
              create: {
                url: 'https://legacy-portal-offline-demo.com',
                lastStatus: 'offline',
                sslExpiryDate: new Date(Date.now() - 2 * 24 * 3600 * 1000), // Expired
                domainExpiryDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
                lastCheckedAt: new Date(),
              },
            },
            tasks: {
              create: {
                name: 'Migrate server instance to ECS',
                assignedTo: 'DevOps Eng',
                progress: 10,
                status: 'todo',
                deadline: new Date(Date.now() + 14 * 24 * 3600 * 1000),
              },
            },
          },
        });

        // Income
        await this.prisma.income.create({
          data: {
            clientId: client.id,
            amount: 5200.00,
            currency: 'USD',
            exchangeRate: 1.0,
            paymentDate: new Date(),
            paymentMethod: 'Bank Wire',
            status: 'completed',
          },
        });

        // Expense
        await this.prisma.expense.create({
          data: {
            description: 'Figma and Vercel team subscription seats.',
            amount: 320.00,
            currency: 'USD',
            category: 'SaaS Software',
            paymentDate: new Date(),
            paymentMethod: 'Credit Card',
          },
        });

        // Subscriptions
        await this.prisma.subscription.create({
          data: {
            provider: 'Vercel Inc',
            serviceName: 'Enterprise Team Seats',
            cost: 160.00,
            billingCycle: 'monthly',
            renewalDate: new Date(Date.now() + 4 * 24 * 3600 * 1000), // 4 days out
            paymentMethod: 'Credit Card',
            reminderDays: 7,
          },
        });

        await this.prisma.subscription.create({
          data: {
            provider: 'GitHub Inc',
            serviceName: 'Copilot Enterprise',
            cost: 190.00,
            billingCycle: 'monthly',
            renewalDate: new Date(Date.now() + 25 * 24 * 3600 * 1000),
            paymentMethod: 'Credit Card',
            reminderDays: 7,
          },
        });

        console.log(`[SEED] Created default telemetry data.`);
      }
    } catch (error) {
      console.error(`[SEED ERROR] Failed to seed default data: ${(error as Error).message}`);
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: admin.id, email: admin.email };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
