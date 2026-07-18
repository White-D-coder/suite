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
      // Fix existing mock credentials if present in the database so they decrypt correctly
      try {
        const oldSecrets = await this.prisma.vaultSecret.findMany({
          where: {
            encryptedValue: {
              in: ['8a221f7a:f62a:mockencryptedpassword', '9f23821a:123a:mockstripekey']
            }
          }
        });
        for (const sec of oldSecrets) {
          const newVal = sec.username === 'aws-db-admin' ? 'aws-db-admin-password123' : 'sk_live_stripe_secret_key_value_xyz';
          await this.prisma.vaultSecret.update({
            where: { id: sec.id },
            data: { encryptedValue: this.encryptionService.encrypt(newVal) }
          });
        }
      } catch (dbErr) {
        console.warn('[SEED] Could not run vaultSecret auto-correction check (possibly tables not migrated yet):', dbErr.message);
      }

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

      // 2. Clear out other dynamic users (employees), clients, projects, etc.
      // This allows us to re-seed dynamically if the user requests new mock sets!
      await this.prisma.projectAssignment.deleteMany({});
      await this.prisma.accessRequest.deleteMany({});
      await this.prisma.auditLog.deleteMany({});
      await this.prisma.invoiceSchedule.deleteMany({});
      await this.prisma.invoiceLineItem.deleteMany({});
      await this.prisma.income.deleteMany({});
      await this.prisma.expense.deleteMany({});
      await this.prisma.subscription.deleteMany({});
      await this.prisma.vaultSecret.deleteMany({});
      await this.prisma.vaultCollection.deleteMany({});
      await this.prisma.websiteMonitor.deleteMany({});
      await this.prisma.task.deleteMany({});
      await this.prisma.project.deleteMany({});
      await this.prisma.invoice.deleteMany({});
      await this.prisma.clientContact.deleteMany({});
      await this.prisma.client.deleteMany({});
      await this.prisma.salaryRecord.deleteMany({});
      
      await this.prisma.user.deleteMany({
        where: {
          email: {
            notIn: ['owner@agency.com', 'admin@agency.com', 'employee@agency.com', 'finance@agency.com']
          }
        }
      });

      let empDefault = await this.prisma.user.findUnique({ where: { email: 'employee@agency.com' } });
      if (empDefault) {
        // Update default employee name to contain region
        empDefault = await this.prisma.user.update({
          where: { email: 'employee@agency.com' },
          data: { name: 'Charlie Employee (US, NA)' }
        });
      } else {
        empDefault = await this.prisma.user.create({
          data: {
            email: 'employee@agency.com',
            name: 'Charlie Employee (US, NA)',
            role: 'employee',
            passwordHash: await bcrypt.hash('employeepassword123', 10),
          },
        });
      }

      // 3. Seed 20 employees from different regions!
      const mockEmployeesRaw = [
        { name: 'Aarav Patel (India, APAC)', email: 'aarav.patel@agency.com' },
        { name: 'Suki Sato (Japan, APAC)', email: 'suki.sato@agency.com' },
        { name: 'Mei Chen (Singapore, APAC)', email: 'mei.chen@agency.com' },
        { name: 'Ji-Woo Kim (South Korea, APAC)', email: 'jiwoo.kim@agency.com' },
        { name: 'Minh Nguyen (Vietnam, APAC)', email: 'minh.nguyen@agency.com' },
        { name: 'Fatima Al-Mansoor (UAE, Middle East)', email: 'fatima.almansoor@agency.com' },
        { name: 'Yosef Cohen (Israel, Middle East)', email: 'yosef.cohen@agency.com' },
        { name: 'Jean Dupont (France, EMEA)', email: 'jean.dupont@agency.com' },
        { name: 'Elena Rostova (Germany, EMEA)', email: 'elena.rostova@agency.com' },
        { name: 'Sven Lindqvist (Sweden, EMEA)', email: 'sven.lindqvist@agency.com' },
        { name: 'Matteo Rossi (Italy, EMEA)', email: 'matteo.rossi@agency.com' },
        { name: 'Sofia Rodriguez (Spain, EMEA)', email: 'sofia.rodriguez@agency.com' },
        { name: 'Carlos Santana (Brazil, LATAM)', email: 'carlos.santana@agency.com' },
        { name: 'Mateo Fernandez (Argentina, LATAM)', email: 'mateo.fernandez@agency.com' },
        { name: 'Lucia Gomez (Mexico, LATAM)', email: 'lucia.gomez@agency.com' },
        { name: 'Chinedu Okeke (Nigeria, Africa)', email: 'chinedu.okeke@agency.com' },
        { name: 'Amara Diallo (Senegal, Africa)', email: 'amara.diallo@agency.com' },
        { name: 'Emily Smith (Canada, NA)', email: 'emily.smith@agency.com' },
        { name: 'Jack Thompson (Australia, OCE)', email: 'jack.thompson@agency.com' },
        { name: 'Liam Wilson (New Zealand, OCE)', email: 'liam.wilson@agency.com' },
      ];

      const createdEmployees = [empDefault];
      for (const emp of mockEmployeesRaw) {
        const created = await this.prisma.user.create({
          data: {
            email: emp.email,
            name: emp.name,
            role: 'employee',
            passwordHash: await bcrypt.hash('employeepassword123', 10),
          }
        });
        createdEmployees.push(created);
      }

      // 4. Seed 10 Clients & 10 Projects from different countries!
      const mockClientsProjects = [
        {
          clientName: 'Alpha Tech Services',
          company: 'Alpha Inc.',
          country: 'United States',
          currency: 'USD',
          projectName: 'Alpha Cloud Migrations',
          desc: 'Cloud scaling infrastructure overhaul.',
          tech: ['AWS', 'Terraform', 'Node.js'],
          hosting: 'AWS',
          db: 'DynamoDB',
          deploy: 'GitHub Actions',
        },
        {
          clientName: 'British Trade Brokers',
          company: 'BTB Ltd.',
          country: 'United Kingdom',
          currency: 'GBP',
          projectName: 'BTB FinTech Gateway',
          desc: 'Real-time payment gateway integration.',
          tech: ['Next.js', 'NestJS', 'PostgreSQL'],
          hosting: 'GCP',
          db: 'PostgreSQL',
          deploy: 'Gitlab CI',
        },
        {
          clientName: 'Müller Automatisierung',
          company: 'Müller GmbH',
          country: 'Germany',
          currency: 'EUR',
          projectName: 'Müller Factory Dashboard',
          desc: 'IoT data collection engine.',
          tech: ['React', 'Go', 'InfluxDB'],
          hosting: 'Azure',
          db: 'InfluxDB',
          deploy: 'Jenkins',
        },
        {
          clientName: 'Hindustan Retailers',
          company: 'Hindustan Corp',
          country: 'India',
          currency: 'INR',
          projectName: 'Hindustan e-Commerce App',
          desc: 'B2B supply chain shopping app.',
          tech: ['Flutter', 'Node.js', 'MongoDB'],
          hosting: 'DigitalOcean',
          db: 'MongoDB',
          deploy: 'GitHub Actions',
        },
        {
          clientName: 'Maple Leaf Logistics',
          company: 'Maple Co.',
          country: 'Canada',
          currency: 'CAD',
          projectName: 'Maple Cargo Tracker',
          desc: 'Real-time fleet GPS monitoring platform.',
          tech: ['Angular', 'Python', 'Redis'],
          hosting: 'AWS',
          db: 'PostgreSQL',
          deploy: 'ArgoCD',
        },
        {
          clientName: 'Sydney Harbour Tours',
          company: 'SHT Partners',
          country: 'Australia',
          currency: 'AUD',
          projectName: 'SHT Ticketing System',
          desc: 'High-availability customer booking portal.',
          tech: ['Vue.js', 'Ruby on Rails', 'MySQL'],
          hosting: 'Heroku',
          db: 'MySQL',
          deploy: 'TravisCI',
        },
        {
          clientName: 'Merlion Tech Singapore',
          company: 'Merlion Pte Ltd',
          country: 'Singapore',
          currency: 'SGD',
          projectName: 'Merlion AI Engine',
          desc: 'Natural language analysis pipeline.',
          tech: ['Python', 'FastAPI', 'PyTorch'],
          hosting: 'AWS',
          db: 'Elasticsearch',
          deploy: 'AWS CodePipeline',
        },
        {
          clientName: 'Tokyo Robotic Labs',
          company: 'TRL KK',
          country: 'Japan',
          currency: 'JPY',
          projectName: 'TRL Drone Controls',
          desc: 'Web-socket metrics control panel.',
          tech: ['Svelte', 'Rust', 'WebSockets'],
          hosting: 'GCP',
          db: 'Redis',
          deploy: 'GitHub Actions',
        },
        {
          clientName: 'Geneva Asset Vault',
          company: 'GAV AG',
          country: 'Switzerland',
          currency: 'CHF',
          projectName: 'GAV Encryption Registry',
          desc: 'Zero-knowledge ledger verification system.',
          tech: ['React', 'NestJS', 'Solidity'],
          hosting: 'Azure',
          db: 'PostgreSQL',
          deploy: 'Self-hosted',
        },
        {
          clientName: 'Paris Fashion Network',
          company: 'PFN SAS',
          country: 'France',
          currency: 'EUR',
          projectName: 'PFN Visual Catalog',
          desc: 'High-definition CDN catalog optimization.',
          tech: ['Next.js', 'Python', 'Cloudflare'],
          hosting: 'Vercel',
          db: 'Supabase',
          deploy: 'Vercel Deploy',
        },
      ];

      for (let i = 0; i < mockClientsProjects.length; i++) {
        const item = mockClientsProjects[i];
        
        const client = await this.prisma.client.create({
          data: {
            name: `Client POC ${i + 1}`,
            company: item.company,
            email: `billing@${item.company.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com`,
            phone: `+0 12345${i}`,
            country: item.country,
            currency: item.currency,
            paymentTerms: 'Net 30',
            notes: `High importance client from ${item.country}.`,
            contacts: {
              create: {
                name: item.clientName,
                email: `poc@${item.company.toLowerCase().replace(/[^a-z0-9]/g, '') || 'company'}.com`,
                primaryNumber: `+0 12345${i}`,
                role: 'decision maker',
                isPrimary: true,
                channels: {
                  create: {
                    phoneType: 'WhatsApp',
                    numberOrAddress: `+0 12345${i}`,
                    isPreferred: true,
                  }
                }
              }
            }
          }
        });

        const assignedEmp1 = createdEmployees[i % createdEmployees.length];
        const assignedEmp2 = createdEmployees[(i + 5) % createdEmployees.length];

        const project = await this.prisma.project.create({
          data: {
            name: item.projectName,
            clientId: client.id,
            status: i % 4 === 3 ? 'completed' : 'active',
            description: item.desc,
            githubRepoUrl: `https://github.com/${item.company.toLowerCase().replace(/[^a-z0-9]/g, '')}/${item.projectName.toLowerCase().replace(/ /g, '-')}`,
            liveUrl: `https://demo.${item.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
            hostingPlatform: item.hosting,
            databasePlatform: item.db,
            deploymentPlatform: item.deploy,
            techStack: item.tech,
            websiteMonitors: {
              create: {
                url: `https://demo.${item.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
                lastStatus: i === 1 ? 'offline' : 'online',
                sslExpiryDate: new Date(Date.now() + (30 + i * 10) * 24 * 3600 * 1000),
                domainExpiryDate: new Date(Date.now() + 150 * 24 * 3600 * 1000),
                lastCheckedAt: new Date(),
              }
            },
            assignments: {
              createMany: {
                data: [
                  {
                    employeeId: assignedEmp1.id,
                    roleOnProject: 'Developer',
                    accessLevel: 'view',
                    dueDate: new Date(Date.now() + 60 * 24 * 3600 * 1000),
                  },
                  {
                    employeeId: assignedEmp2.id,
                    roleOnProject: 'Designer',
                    accessLevel: 'view',
                    dueDate: new Date(Date.now() + 60 * 24 * 3600 * 1000),
                  }
                ]
              }
            },
            vaultCollections: {
              create: {
                provider: `${item.hosting} Secrets Manager`,
                rotationPolicy: 'every 90 days',
                lastRotationDate: new Date(),
                secrets: {
                  createMany: {
                    data: [
                      {
                        secretType: 'password',
                        username: 'db-admin',
                        encryptedValue: this.encryptionService.encrypt(`pwd-${item.projectName}-123`),
                        tool: item.db,
                        environment: 'production',
                        owner: 'Owner',
                      },
                      {
                        secretType: 'api_key',
                        username: 'gateway-api-key',
                        encryptedValue: this.encryptionService.encrypt(`api-key-${item.projectName}-xyz`),
                        tool: item.projectName,
                        environment: 'production',
                        owner: 'Owner',
                      }
                    ]
                  }
                }
              }
            }
          }
        });

        const totalAmount = 5000 + i * 1500;
        const schRate = item.currency === 'USD' ? 1.0 : item.currency === 'EUR' ? 0.92 : item.currency === 'GBP' ? 0.78 : item.currency === 'INR' ? 83.5 : item.currency === 'CAD' ? 1.36 : item.currency === 'AUD' ? 1.51 : item.currency === 'SGD' ? 1.35 : item.currency === 'JPY' ? 158.0 : item.currency === 'CHF' ? 0.89 : 1.0;
        await this.prisma.invoice.create({
          data: {
            clientId: client.id,
            projectId: project.id,
            invoiceNumber: `INV-2026-00${i + 1}`,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
            currency: item.currency,
            subtotal: totalAmount,
            taxRate: 0.0,
            taxAmount: 0.0,
            total: totalAmount,
            status: i % 3 === 0 ? 'paid' : i % 3 === 1 ? 'partially_paid' : 'draft',
            paidAmount: i % 3 === 0 ? totalAmount : i % 3 === 1 ? totalAmount / 2 : 0,
            remainingBalance: i % 3 === 0 ? 0 : i % 3 === 1 ? totalAmount / 2 : totalAmount,
            fxRate: schRate,
            fxSource: 'ExchangeRateAPI',
            lineItems: {
              create: {
                description: `Initial project design and architecture setup for ${item.projectName}`,
                quantity: 1,
                unitPrice: totalAmount,
                total: totalAmount,
              }
            },
            schedules: {
              createMany: {
                data: [
                  {
                    milestoneName: 'Deposit (36%)',
                    percentage: 36.36,
                    amountDue: totalAmount * 0.3636,
                    paymentStatus: i % 3 === 2 ? 'pending' : 'paid',
                    dueDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
                  },
                  {
                    milestoneName: 'Final Balance',
                    percentage: 63.64,
                    amountDue: totalAmount * 0.6364,
                    paymentStatus: i % 3 === 0 ? 'paid' : 'pending',
                    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
                  }
                ]
              }
            }
          }
        });

        await this.prisma.expense.create({
          data: {
            description: `Tool subscription seat for ${item.projectName}.`,
            amount: 150 + i * 25,
            currency: 'USD',
            category: 'SaaS Software',
            paymentDate: new Date(),
            paymentMethod: 'Credit Card',
            projectId: project.id,
          }
        });
      }

      console.log(`[SEED] Successfully re-seeded 10 multi-country projects & 20 regional employees.`);
    } catch (error) {
      console.error(`[SEED ERROR] Failed to seed default data: ${(error as Error).message}`);
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
