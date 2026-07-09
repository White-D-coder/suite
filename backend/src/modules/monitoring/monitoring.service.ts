import { Injectable, OnModuleInit, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import * as cron from 'node-cron';
import * as tls from 'tls';
import { URL } from 'url';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Schedule check every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.logger.log('Executing scheduled website monitoring status checks...');
      this.checkAllMonitors().catch((err) => {
        this.logger.error(`Scheduled monitoring failed: ${(err as Error).message}`);
      });
    });
    this.logger.log('Scheduled website monitoring cron job registered (5m interval).');
  }

  private getHostname(urlString: string): string | null {
    try {
      const url = new URL(urlString);
      return url.hostname;
    } catch {
      return null;
    }
  }

  private async checkSSLExpiry(hostname: string): Promise<Date | null> {
    return new Promise((resolve) => {
      try {
        const socket = tls.connect(
          {
            host: hostname,
            port: 443,
            servername: hostname,
            rejectUnauthorized: false,
          },
          () => {
            const cert = socket.getPeerCertificate();
            socket.destroy();
            if (cert && cert.valid_to) {
              resolve(new Date(cert.valid_to));
            } else {
              resolve(null);
            }
          },
        );

        socket.on('error', () => {
          resolve(null);
        });

        socket.setTimeout(5000, () => {
          socket.destroy();
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  async checkProjectMonitor(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websiteMonitors: true },
    });

    if (!project) {
      throw new BadRequestException(`Project with ID ${projectId} not found`);
    }

    if (!project.liveUrl) {
      return { status: 'skipped', message: 'No live URL configured for this project.' };
    }

    const url = project.liveUrl;
    const hostname = this.getHostname(url);
    
    let lastStatus = 'offline';
    let sslExpiryDate: Date | null = null;
    
    // Check Uptime status
    try {
      // Direct HTTP fetch status audit
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 6000);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'AgencySuite-Monitor/1.0' },
      });
      
      clearTimeout(id);

      if (response.status >= 200 && response.status < 400) {
        lastStatus = 'online';
      }
    } catch (error) {
      lastStatus = 'offline';
    }

    // Check SSL Expiry if HTTPS
    if (url.startsWith('https://') && hostname) {
      sslExpiryDate = await this.checkSSLExpiry(hostname);
    }

    // Mock Domain Expiry WHOIS check (fallback to 1 year mock validity)
    const domainExpiryDate = hostname ? new Date(Date.now() + 365 * 24 * 3600000) : null;

    // Check if monitor record exists
    const existingMonitor = project.websiteMonitors[0];

    if (existingMonitor) {
      return this.prisma.websiteMonitor.update({
        where: { id: existingMonitor.id },
        data: {
          lastStatus,
          sslExpiryDate,
          domainExpiryDate,
          lastCheckedAt: new Date(),
        },
      });
    } else {
      return this.prisma.websiteMonitor.create({
        data: {
          projectId,
          url,
          lastStatus,
          sslExpiryDate,
          domainExpiryDate,
          lastCheckedAt: new Date(),
        },
      });
    }
  }

  async checkAllMonitors() {
    const projects = await this.prisma.project.findMany({
      where: {
        liveUrl: {
          not: null,
        },
      },
    });

    this.logger.log(`Running monitoring checks across ${projects.length} live projects.`);
    for (const project of projects) {
      try {
        await this.checkProjectMonitor(project.id);
      } catch (err) {
        this.logger.error(`Failed to monitor project ${project.name} (${project.id}): ${(err as Error).message}`);
      }
    }
  }
}
