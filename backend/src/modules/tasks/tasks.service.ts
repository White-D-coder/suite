import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTaskDto: CreateTaskDto) {
    const { projectId, deadline, ...rest } = createTaskDto;

    // Check project existence
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // Determine default status
    let status = createTaskDto.status || 'pending';
    if (createTaskDto.progress && createTaskDto.progress > 0) {
      status = createTaskDto.progress === 100 ? 'done' : 'in_progress';
    }

    return this.prisma.task.create({
      data: {
        id: randomUUID(),
        ...rest,
        status,
        project: { connect: { id: projectId } },
        deadline: deadline ? new Date(deadline) : undefined,
      },
    });
  }

  async findAll(projectId?: string) {
    return this.prisma.task.findMany({
      where: projectId ? { projectId } : {},
      include: { project: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const existing = await this.findOne(id);
    const { deadline, progress, ...rest } = updateTaskDto;

    const data: any = { ...rest };
    if (deadline !== undefined) {
      data.deadline = deadline ? new Date(deadline) : null;
    }

    if (progress !== undefined) {
      data.progress = progress;
      // Auto-update status based on progress if status is not explicitly set
      if (!updateTaskDto.status) {
        if (progress === 100) {
          data.status = 'done';
        } else if (progress > 0) {
          data.status = 'in_progress';
        } else {
          data.status = 'pending';
        }
      }
    }

    return this.prisma.task.update({
      where: { id },
      data,
    });
  }

  async updateProgress(id: string, progress: number) {
    const existing = await this.findOne(id);
    let status = existing.status;

    if (progress === 100) {
      status = 'done';
    } else if (progress > 0) {
      status = 'in_progress';
    } else {
      status = 'pending';
    }

    return this.prisma.task.update({
      where: { id },
      data: {
        progress,
        status,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.task.delete({
      where: { id },
    });
  }
}
