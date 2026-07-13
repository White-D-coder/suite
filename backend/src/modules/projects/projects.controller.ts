import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
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
  async findAll(@Query() query: any, @Req() req: any) {
    return this.projectsService.findAll(req.user, query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.findOne(id, req.user);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto, @Req() req: any) {
    return this.projectsService.update(id, updateProjectDto, req.user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.projectsService.remove(id, req.user);
  }

  // Assignments
  @Post(':id/assign')
  async assignEmployee(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.projectsService.assignEmployee(id, body, req.user);
  }

  @Delete('assignments/:assignmentId')
  async removeAssignment(@Param('assignmentId') assignmentId: string, @Req() req: any) {
    return this.projectsService.removeAssignment(assignmentId, req.user);
  }

  // Inventory sub-endpoints
  @Post(':id/contracts')
  async addContract(@Param('id') id: string, @Body() body: any) {
    return this.projectsService.addContract(id, body);
  }

  @Delete('contracts/:contractId')
  async removeContract(@Param('contractId') contractId: string) {
    return this.projectsService.removeContract(contractId);
  }

  @Post(':id/accounts')
  async addAccount(@Param('id') id: string, @Body() body: any) {
    return this.projectsService.addAccount(id, body);
  }

  @Delete('accounts/:accountId')
  async removeAccount(@Param('accountId') accountId: string) {
    return this.projectsService.removeAccount(accountId);
  }

  @Post(':id/tools')
  async addToolSubscription(@Param('id') id: string, @Body() body: any) {
    return this.projectsService.addToolSubscription(id, body);
  }

  @Delete('tools/:toolId')
  async removeToolSubscription(@Param('toolId') toolId: string) {
    return this.projectsService.removeToolSubscription(toolId);
  }

  @Post(':id/updates')
  async addProgressUpdate(@Param('id') id: string, @Body() body: any) {
    return this.projectsService.addProgressUpdate(id, body);
  }

  @Post(':id/environments')
  async addEnvironment(@Param('id') id: string, @Body() body: any) {
    return this.projectsService.addEnvironment(id, body);
  }

  @Delete('environments/:envId')
  async removeEnvironment(@Param('envId') envId: string) {
    return this.projectsService.removeEnvironment(envId);
  }

  @Get(':id/github')
  async getGithubStatus(@Param('id') id: string, @Req() req: any) {
    const project = await this.projectsService.findOne(id, req.user);
    if (!project.githubRepoUrl) {
      return { configured: false, message: 'No GitHub repository URL configured for this project.' };
    }
    return this.githubService.getRepoStatus(project.githubRepoUrl);
  }
}
