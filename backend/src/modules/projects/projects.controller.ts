import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { GithubService } from './github.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AdminGuard } from '../auth/guards/jwt-auth.guard';

@Controller('projects')
@UseGuards(AdminGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly githubService: GithubService,
  ) {}

  @Post()
  async create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  async findAll(@Query('clientId') clientId?: string) {
    return this.projectsService.findAll(clientId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateProjectDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  @Get(':id/github')
  async getGithubStatus(@Param('id') id: string) {
    const project = await this.projectsService.findOne(id);
    if (!project.githubRepoUrl) {
      return { configured: false, message: 'No GitHub repository URL configured for this project.' };
    }
    return this.githubService.getRepoStatus(project.githubRepoUrl);
  }
}
