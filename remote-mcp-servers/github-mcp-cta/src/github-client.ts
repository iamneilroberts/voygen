/**
 * GitHub API Client for Voygen Publishing
 */

import { Env, GitHubFile, GitHubCommitResponse, GitHubError, ValidationError } from './types.js';

export class GitHubClient {
  private baseUrl = 'https://api.github.com';
  
  constructor(private env: Env) {
    if (!env.GITHUB_TOKEN) {
      throw new ValidationError('GITHUB_TOKEN is required');
    }
    if (!env.GITHUB_OWNER) {
      throw new ValidationError('GITHUB_OWNER is required');
    }
    if (!env.GITHUB_REPO) {
      throw new ValidationError('GITHUB_REPO is required');
    }
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Voygen-GitHub-MCP/1.0.0',
      ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({ message: response.statusText }));
      throw new GitHubError(
        `GitHub API error: ${errorData.message}`,
        path,
        response.status,
        errorData
      );
    }

    return response.json();
  }

  async getFile(path: string, branch = 'main'): Promise<GitHubFile & { content: string }> {
    const encodedPath = encodeURIComponent(path);
    const data = await this.request(
      `/repos/${this.env.GITHUB_OWNER}/${this.env.GITHUB_REPO}/contents/${encodedPath}?ref=${branch}`
    );

    if (data.type !== 'file') {
      throw new GitHubError(`Path is not a file: ${path}`, 'getFile');
    }

    // Use atob and TextDecoder for proper base64 to UTF-8 conversion in Cloudflare Workers
    const binaryString = atob(data.content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    const content = decoder.decode(bytes);
    return { ...data, content };
  }

  async createFile(
    path: string, 
    content: string, 
    message: string, 
    branch = 'main'
  ): Promise<GitHubCommitResponse> {
    const encodedPath = encodeURIComponent(path);
    // Use TextEncoder and btoa for proper UTF-8 to base64 conversion in Cloudflare Workers
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    const base64Content = btoa(String.fromCharCode(...bytes));

    const response = await this.request(
      `/repos/${this.env.GITHUB_OWNER}/${this.env.GITHUB_REPO}/contents/${encodedPath}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          content: base64Content,
          branch
        })
      }
    );

    return response.commit;
  }

  async updateFile(
    path: string, 
    content: string, 
    message: string, 
    sha: string, 
    branch = 'main'
  ): Promise<GitHubCommitResponse> {
    const encodedPath = encodeURIComponent(path);
    // Use TextEncoder and btoa for proper UTF-8 to base64 conversion in Cloudflare Workers
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    const base64Content = btoa(String.fromCharCode(...bytes));

    const response = await this.request(
      `/repos/${this.env.GITHUB_OWNER}/${this.env.GITHUB_REPO}/contents/${encodedPath}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          content: base64Content,
          sha,
          branch
        })
      }
    );

    return response.commit;
  }

  async listFiles(path = '', branch = 'main'): Promise<GitHubFile[]> {
    const encodedPath = path ? encodeURIComponent(path) : '';
    return this.request(
      `/repos/${this.env.GITHUB_OWNER}/${this.env.GITHUB_REPO}/contents/${encodedPath}?ref=${branch}`
    );
  }

  async healthCheck(): Promise<{ repository_accessible: boolean; rate_limit?: any }> {
    try {
      // Check repository access
      await this.request(`/repos/${this.env.GITHUB_OWNER}/${this.env.GITHUB_REPO}`);
      
      // Get rate limit info
      const rateLimit = await this.request('/rate_limit');
      
      return {
        repository_accessible: true,
        rate_limit: rateLimit
      };
    } catch (error) {
      return {
        repository_accessible: false
      };
    }
  }

  getFileUrl(filename: string): string {
    return `https://${this.env.GITHUB_OWNER}.github.io/${this.env.GITHUB_REPO}/${filename}`;
  }

  getDashboardUrl(): string {
    return `https://${this.env.GITHUB_OWNER}.github.io/${this.env.GITHUB_REPO}/`;
  }
}