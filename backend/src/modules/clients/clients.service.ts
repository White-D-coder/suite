import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    return this.prisma.client.create({
      data: {
        id: randomUUID(),
        ...createClientDto,
      },
    });
  }

  async findAll() {
    return this.prisma.client.findMany({
      include: {
        contacts: {
          include: {
            channels: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            assignments: {
              include: {
                employee: true,
              },
            },
          },
        },
        invoices: {
          include: {
            lineItems: true,
            schedules: true,
            project: true,
          }
        },
        communications: {
          orderBy: { sentAt: 'desc' },
        },
        income: true,
        contacts: {
          include: {
            channels: true,
          },
        },
      },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }
    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.client.delete({
      where: { id },
    });
  }

  // Client Contacts CRUD
  async addContact(clientId: string, data: any) {
    await this.findOne(clientId);
    return this.prisma.clientContact.create({
      data: {
        id: randomUUID(),
        clientId,
        name: data.name,
        role: data.role || 'POC',
        email: data.email,
        primaryNumber: data.primaryNumber,
        relationshipLabel: data.relationshipLabel,
        isPrimary: data.isPrimary ?? false,
        preferredForBilling: data.preferredForBilling ?? false,
        preferredForUrgent: data.preferredForUrgent ?? false,
        timeZone: data.timeZone || 'UTC',
        consentStatus: data.consentStatus || 'granted',
      },
    });
  }

  async removeContact(contactId: string) {
    const contact = await this.prisma.clientContact.findUnique({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException(`Contact not found`);
    }
    return this.prisma.clientContact.delete({
      where: { id: contactId },
    });
  }

  // Contact Channels CRUD
  async addChannel(contactId: string, data: any) {
    const contact = await this.prisma.clientContact.findUnique({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException(`Contact not found`);
    }
    return this.prisma.contactChannel.create({
      data: {
        id: randomUUID(),
        contactId,
        phoneType: data.phoneType,
        numberOrAddress: data.numberOrAddress,
        isPreferred: data.isPreferred ?? false,
      },
    });
  }

  async removeChannel(channelId: string) {
    const channel = await this.prisma.contactChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new NotFoundException(`Channel not found`);
    }
    return this.prisma.contactChannel.delete({
      where: { id: channelId },
    });
  }
}
