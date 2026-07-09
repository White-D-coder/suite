import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private octokit: Octokit | null = null;

  constructor() {
    const token = process.env.GITHUB_ACCESS_TOKEN;
    if (token && token !== 'ghp_xxxx' && !token.startsWith('ghp_mock')) {
      this.octokit = new Octokit({ auth: token });
    } else {
      this.logger.warn('GITHUB_ACCESS_TOKEN is missing or set to placeholder. Octokit will operate in unauthenticated/mock fallback mode.');
    }
  }

  private parseGithubUrl(url: string): { owner: string; repo: string } | null {
    if (!url) return null;
    try {
      // Handles https://github.com/owner/repo or git@github.com:owner/repo.git
      const match = url.match(/github\.com[\/:]([^\/]+)\/([^\/\s#\?]+)/);
      if (!match) return null;
      const owner = match[1];
      let repo = match[2];
      if (repo.endsWith('.git')) {
        repo = repo.slice(0, -4);
      }
      return { owner, repo };
    } catch {
      return null;
    }
  }

  async getRepoStatus(repoUrl: string) {
    const parsed = this.parseGithubUrl(repoUrl);
    if (!parsed) {
      throw new BadRequestException('Invalid GitHub repository URL. Could not parse owner and repository name.');
    }

    const { owner, repo } = parsed;

    // Resilience: Fallback to mock data if Octokit is not configured or in development mode
    if (!this.octokit) {
      return {
        configured: false,
        owner,
        repo,
        latestCommit: {
          sha: 'mock77a11979b90875c7b3992b8d009279ea44aa',
          message: 'chore: seed project and setup local development configs [Mock]',
          author: 'Agency Admin',
          date: new Date().toISOString(),
        },
        deployments: [
          {
            id: 'mock-deploy-1',
            environment: 'production',
            status: 'success',
            updatedAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ],
      };
    }

    try {
      // Fetch latest commits
      const commitsResponse = await this.octokit.repos.listCommits({
        owner,
        repo,
        per_page: 5,
      });

      const latestCommitRaw = commitsResponse.data[0];
      const latestCommit = latestCommitRaw
        ? {
            sha: latestCommitRaw.sha,
            message: latestCommitRaw.commit.message,
            author: latestCommitRaw.commit.author?.name || latestCommitRaw.commit.committer?.name || 'unknown',
            date: latestCommitRaw.commit.author?.date || latestCommitRaw.commit.committer?.date || new Date().toISOString(),
          }
        : null;

      // Fetch deployments
      const deploymentsResponse = await this.octokit.repos.listDeployments({
        owner,
        repo,
        per_page: 5,
      });

      const deployments = await Promise.all(
        deploymentsResponse.data.map(async (dep) => {
          let status = 'unknown';
          try {
            const statuses = await this.octokit!.repos.listDeploymentStatuses({
              owner,
              repo,
              deployment_id: dep.id,
              per_page: 1,
            });
            if (statuses.data.length > 0) {
              status = statuses.data[0].state;
            }
          } catch {
            // Ignore status fetch failures
          }
          return {
            id: dep.id.toString(),
            environment: dep.environment,
            status,
            updatedAt: dep.updated_at,
          };
        }),
      );

      return {
        configured: true,
        owner,
        repo,
        latestCommit,
        deployments,
      };
    } catch (error) {
      this.logger.error(`GitHub API error for ${owner}/${repo}: ${(error as Error).message}`);
      throw new BadRequestException(`Failed to retrieve repository information from GitHub: ${(error as Error).message}`);
    }
  }
}
