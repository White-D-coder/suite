import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { SendEmailDto } from './dto/send-email.dto';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import * as nodemailer from 'nodemailer';
import twilio from 'twilio';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class CommsService {
  private readonly logger = new Logger(CommsService.name);
  private emailTransporter: nodemailer.Transporter | null = null;
  private twilioClient: any = null;
  private twilioFrom = '';

  constructor(private readonly prisma: PrismaService) {
    // Initialize Nodemailer
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpUser && smtpUser !== 'your-email@gmail.com' && !smtpUser.startsWith('dev-')) {
      this.emailTransporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log('Nodemailer SMTP transport initialized.');
    } else {
      this.logger.warn('Nodemailer SMTP configuration is missing or placeholder. Running in mock console log mode.');
    }

    // Initialize Twilio
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    this.twilioFrom = process.env.TWILIO_WHATSAPP_FROM || '+14155238886';

    if (twilioSid && twilioSid !== 'ACxxxx' && !twilioSid.startsWith('ACmock')) {
      this.twilioClient = twilio(twilioSid, twilioToken);
      this.logger.log('Twilio client initialized.');
    } else {
      this.logger.warn('Twilio configuration is missing or placeholder. Running in mock console log mode.');
    }
  }

  async sendEmail(sendEmailDto: SendEmailDto) {
    const { clientId, projectId, to, subject, content, attachmentUrl } = sendEmailDto;
    this.logger.log(`Sending email to: ${to}, subject: ${subject}`);

    const attachments: any[] = [];

    // Resolve local attachment if applicable
    if (attachmentUrl) {
      if (attachmentUrl.includes('/uploads/invoices/')) {
        const parts = attachmentUrl.split('/uploads/invoices/');
        const fileName = parts[parts.length - 1];
        const localPath = path.resolve(process.cwd(), 'uploads/invoices', fileName);
        
        if (fs.existsSync(localPath)) {
          attachments.push({
            filename: fileName,
            path: localPath,
          });
          this.logger.log(`Resolved local attachment for email: ${localPath}`);
        } else {
          this.logger.warn(`Attachment path not found locally: ${localPath}`);
        }
      } else {
        // Fallback: attach remote URL
        attachments.push({
          filename: 'invoice.pdf',
          path: attachmentUrl,
        });
      }
    }

    let status = 'success';

    if (this.emailTransporter) {
      try {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_USER,
          to,
          subject,
          html: content.replace(/\n/g, '<br/>'),
          attachments,
        });
      } catch (error) {
        status = 'failed';
        this.logger.error(`Failed to send email via SMTP: ${(error as Error).message}`);
      }
    } else {
      this.logger.log(`[MOCK EMAIL SENT] To: ${to} | Subject: ${subject} | Body: ${content} | Attachments: ${attachments.map(a => a.filename).join(', ')}`);
    }

    // Save to communication log
    return this.prisma.communication.create({
      data: {
        clientId,
        projectId,
        type: 'email',
        subject,
        content: `To: ${to}\n\n${content}${attachmentUrl ? `\n\nAttachment: ${attachmentUrl}` : ''}`,
        direction: 'outgoing',
        sentAt: new Date(),
      },
    });
  }

  async sendWhatsapp(sendWhatsappDto: SendWhatsappDto) {
    const { clientId, projectId, to, content } = sendWhatsappDto;
    this.logger.log(`Sending WhatsApp message to: ${to}`);

    let status = 'success';

    if (this.twilioClient) {
      try {
        const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
        const formattedFrom = this.twilioFrom.startsWith('whatsapp:') ? this.twilioFrom : `whatsapp:${this.twilioFrom}`;
        
        await this.twilioClient.messages.create({
          from: formattedFrom,
          to: formattedTo,
          body: content,
        });
      } catch (error) {
        status = 'failed';
        this.logger.error(`Failed to send WhatsApp message via Twilio: ${(error as Error).message}`);
      }
    } else {
      this.logger.log(`[MOCK WHATSAPP SENT] To: ${to} | From: ${this.twilioFrom} | Body: ${content}`);
    }

    // Save to communication log
    return this.prisma.communication.create({
      data: {
        clientId,
        projectId,
        type: 'whatsapp',
        content: `To: ${to}\n\n${content}`,
        direction: 'outgoing',
        sentAt: new Date(),
      },
    });
  }

  async getClientHistory(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new BadRequestException(`Client with ID ${clientId} not found`);
    }

    return this.prisma.communication.findMany({
      where: { clientId },
      orderBy: { sentAt: 'desc' },
    });
  }
}
