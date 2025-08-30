/**
 * GitHub API Client with PAT authentication
 */

import { Env, GitHubFile, GitHubFileContent, ValidationError, PublishingError, RetryableError, NonRetryableError } from './types.js';

export class GitHubClient {
  private baseUrl = 'https://api.github.com';
  private token: string;
  public owner: string;
  public repo: string;

  constructor(env: Env) {
    if (!env.GITHUB_TOKEN) {
      throw new ValidationError('GITHUB_TOKEN is required');
    }
    if (!env.GITHUB_OWNER) {
      throw new ValidationError('GITHUB_OWNER is required');
    }
    if (!env.GITHUB_REPO) {
      throw new ValidationError('GITHUB_REPO is required');
    }

    this.token = env.GITHUB_TOKEN;
    this.owner = env.GITHUB_OWNER;
    this.repo = env.GITHUB_REPO;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'github-mcp-cta/1.0.0',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers as Record<string, string>),
    };

    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle rate limiting
    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      const resetTime = parseInt(response.headers.get('x-ratelimit-reset') || '0') * 1000;
      throw new RetryableError(
        `GitHub API rate limit exceeded. Reset at ${new Date(resetTime).toISOString()}`,
        resetTime - Date.now()
      );
    }

    // Handle authentication errors (non-retryable)
    if (response.status === 401) {
      throw new NonRetryableError('GitHub authentication failed. Check GITHUB_TOKEN permissions.');
    }

    // Handle not found errors (non-retryable for most cases)
    if (response.status === 404) {
      throw new NonRetryableError(`GitHub resource not found: ${endpoint}`);
    }

    // Handle other client errors (non-retryable)
    if (response.status >= 400 && response.status < 500) {
      const errorData = await response.json().catch(() => ({})) as any;
      throw new NonRetryableError(`GitHub API error: ${response.status} ${response.statusText}. ${errorData.message || ''}`);
    }

    // Handle server errors (retryable)
    if (response.status >= 500) {
      throw new RetryableError(`GitHub API server error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  async getFile(path: string, branch: string = 'main'): Promise<GitHubFileContent> {
    try {
      const response = await this.makeRequest(
        `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`
      );

      const data = await response.json() as any;
      
      if (data.type !== 'file') {
        throw new ValidationError(`Path ${path} is not a file`);
      }

      // Decode base64 content
      const content = data.encoding === 'base64' 
        ? atob(data.content.replace(/\n/g, ''))
        : data.content;

      return {
        ...data,
        content,
      } as GitHubFileContent;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NonRetryableError || error instanceof RetryableError) {
        throw error;
      }
      throw new PublishingError(`Failed to get file ${path}: ${(error as Error).message}`, 'get_file', { path, branch });
    }
  }

  async createFile(path: string, content: string, message: string, branch: string = 'main'): Promise<any> {
    try {
      // Encode content to base64
      const encodedContent = btoa(content);

      const response = await this.makeRequest(
        `/repos/${this.owner}/${this.repo}/contents/${path}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content: encodedContent,
            branch,
          }),
        }
      );

      return await response.json();
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NonRetryableError || error instanceof RetryableError) {
        throw error;
      }
      throw new PublishingError(`Failed to create file ${path}: ${(error as Error).message}`, 'create_file', { path, branch });
    }
  }

  async updateFile(path: string, content: string, message: string, sha: string, branch: string = 'main'): Promise<any> {
    try {
      // Encode content to base64
      const encodedContent = btoa(content);

      const response = await this.makeRequest(
        `/repos/${this.owner}/${this.repo}/contents/${path}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message,
            content: encodedContent,
            sha,
            branch,
          }),
        }
      );

      return await response.json();
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NonRetryableError || error instanceof RetryableError) {
        throw error;
      }
      throw new PublishingError(`Failed to update file ${path}: ${(error as Error).message}`, 'update_file', { path, branch, sha });
    }
  }

  async listFiles(path: string = '', branch: string = 'main'): Promise<GitHubFile[]> {
    try {
      const response = await this.makeRequest(
        `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`
      );

      const data = await response.json() as any;
      
      if (Array.isArray(data)) {
        return data as GitHubFile[];
      } else if (data.type === 'file') {
        return [data as GitHubFile];
      } else {
        throw new ValidationError(`Path ${path} is not a valid file or directory`);
      }
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NonRetryableError || error instanceof RetryableError) {
        throw error;
      }
      throw new PublishingError(`Failed to list files in ${path}: ${(error as Error).message}`, 'list_files', { path, branch });
    }
  }

  async healthCheck(): Promise<{ status: string; repository: string; accessible: boolean }> {
    try {
      const response = await this.makeRequest(`/repos/${this.owner}/${this.repo}`);
      const data = await response.json() as any;
      
      return {
        status: 'healthy',
        repository: data.full_name,
        accessible: true,
      };
    } catch (error) {
      return {
        status: 'error',
        repository: `${this.owner}/${this.repo}`,
        accessible: false,
      };
    }
  }
}