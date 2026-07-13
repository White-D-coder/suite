import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto) {
    const { clientId, startDate, deadline, ...rest } = createProjectDto;

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    return this.prisma.project.create({
      data: {
        ...rest,
        client: { connect: { id: clientId } },
        startDate: startDate ? new Date(startDate) : undefined,
        deadline: deadline ? new Date(deadline) : undefined,
      },
    });
  }

  async findAll(user: any, filters?: any) {
    const where: any = {};

    // 1. Role scoping: Employees only see assigned projects
    if (user.role === 'employee') {
      where.assignments = {
        some: {
          employeeId: user.id,
        },
      };
    }

    // 2. Filters
    if (filters) {
      if (filters.clientId) where.clientId = filters.clientId;
      if (filters.country) where.country = { contains: filters.country, mode: 'insensitive' };
      if (filters.state) where.state = { contains: filters.state, mode: 'insensitive' };
      if (filters.projectCategory) where.projectCategory = filters.projectCategory;
      if (filters.serviceType) where.serviceType = filters.serviceType;
      if (filters.contractStatus) where.contractStatus = filters.contractStatus;
      if (filters.status) where.status = filters.status;
      if (filters.company) {
        where.client = {
          company: { contains: filters.company, mode: 'insensitive' },
        };
      }
      if (filters.techStack) {
        where.techStack = {
          hasSome: Array.isArray(filters.techStack) ? filters.techStack : [filters.techStack],
        };
      }
      if (filters.assigneeId) {
        where.assignments = {
          some: {
            employeeId: filters.assigneeId,
          },
        };
      }
    }

    return this.prisma.project.findMany({
      where,
      include: {
        client: true,
        assignments: {
          include: {
            employee: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: any) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        assignments: {
          include: {
            employee: true,
          },
        },
        vaultCollections: {
          include: {
            secrets: true,
          },
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
        websiteMonitors: true,
        contracts: true,
        accounts: true,
        tools: true,
        progressUpdates: true,
        environments: true,
        profitabilitySnapshot: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    // Role-scoping for reading specific project details
    if (user.role === 'employee') {
      const isAssigned = project.assignments.some(a => a.employeeId === user.id);
      
      const now = new Date();
      const activeGrant = await this.prisma.accessRequest.findFirst({
        where: {
          projectId: id,
          requesterId: user.id,
          status: 'approved',
          expiresAt: { gte: now },
        },
      });

      if (!isAssigned && !activeGrant) {
        throw new ForbiddenException('Access denied. You must be assigned to this project or have an active approved vault access request.');
      }
    }

    return project;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto, user: any) {
    const existing = await this.findOne(id, user);

    const { startDate, deadline, status, ...rest } = updateProjectDto;

    // Handle project completion state transitions
    let finalStatus = status;
    if (status === 'completed' && existing.status !== 'completed_pending_rotation' && existing.status !== 'rotated' && existing.status !== 'closed') {
      finalStatus = 'completed_pending_rotation';

      // Automatically create a rotation task for any vault collections
      const collections = await this.prisma.vaultCollection.findMany({
        where: { projectId: id },
      });

      for (const col of collections) {
        await this.prisma.rotationTask.create({
          data: {
            collectionId: col.id,
            status: 'pending',
            priority: 'high',
            reason: 'Project completed - credential rotation required.',
          },
        });
      }

      // Log project completion to Audit Log
      await this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'project_completed',
          details: JSON.stringify({ projectId: id, projectName: existing.name }),
        },
      });
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        status: finalStatus,
        startDate: startDate ? new Date(startDate) : undefined,
        deadline: deadline ? new Date(deadline) : undefined,
      },
    });
  }

  async remove(id: string, user: any) {
    const existing = await this.findOne(id, user);

    // Audit deletion
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'deletion',
        details: JSON.stringify({ resource: 'project', id, name: existing.name }),
      },
    });

    return this.prisma.project.delete({
      where: { id },
    });
  }

  // Project Assignments
  async assignEmployee(projectId: string, data: any, user: any) {
    await this.findOne(projectId, user);

    // Create assignment and log to audit trail
    const assignment = await this.prisma.projectAssignment.create({
      data: {
        projectId,
        employeeId: data.employeeId,
        roleOnProject: data.roleOnProject || 'Team Member',
        accessLevel: data.accessLevel || 'view',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'due_date_change', // Relates to assignment/schedule updates
        details: JSON.stringify({
          action: 'assign_employee',
          projectId,
          employeeId: data.employeeId,
          roleOnProject: data.roleOnProject,
        }),
      },
    });

    return assignment;
  }

  async removeAssignment(assignmentId: string, user: any) {
    const assignment = await this.prisma.projectAssignment.findUnique({
      where: { id: assignmentId },
    });
    if (!assignment) {
      throw new NotFoundException(`Assignment not found`);
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'deletion',
        details: JSON.stringify({ action: 'remove_assignment', assignmentId, projectId: assignment.projectId }),
      },
    });

    return this.prisma.projectAssignment.delete({
      where: { id: assignmentId },
    });
  }

  // Sub-inventory modifiers
  async addContract(projectId: string, data: any) {
    return this.prisma.projectContract.create({
      data: {
        projectId,
        title: data.title,
        contractStatus: data.contractStatus || 'active',
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        billingModel: data.billingModel,
        fileUrl: data.fileUrl,
      },
    });
  }

  async removeContract(contractId: string) {
    return this.prisma.projectContract.delete({
      where: { id: contractId },
    });
  }

  async addAccount(projectId: string, data: any) {
    return this.prisma.projectAccount.create({
      data: {
        projectId,
        provider: data.provider,
        username: data.username,
        env: data.env || 'development',
      },
    });
  }

  async removeAccount(accountId: string) {
    return this.prisma.projectAccount.delete({
      where: { id: accountId },
    });
  }

  async addToolSubscription(projectId: string, data: any) {
    return this.prisma.projectToolSubscription.create({
      data: {
        projectId,
        vendor: data.vendor,
        cost: data.cost,
        billingCycle: data.billingCycle || 'monthly',
        renewalDate: new Date(data.renewalDate),
      },
    });
  }

  async removeToolSubscription(toolId: string) {
    return this.prisma.projectToolSubscription.delete({
      where: { id: toolId },
    });
  }

  async addProgressUpdate(projectId: string, data: any) {
    return this.prisma.projectProgressUpdate.create({
      data: {
        projectId,
        updaterId: data.updaterId,
        updateText: data.updateText,
        progress: Number(data.progress || 0),
      },
    });
  }

  async addEnvironment(projectId: string, data: any) {
    return this.prisma.projectEnvironment.create({
      data: {
        projectId,
        name: data.name,
        url: data.url,
      },
    });
  }

  async removeEnvironment(envId: string) {
    return this.prisma.projectEnvironment.delete({
      where: { id: envId },
    });
  }
}
