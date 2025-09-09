/**
 * Types for Voygen GitHub MCP Server
 * Handles publishing travel documents to somotravel.us with dashboard integration
 */

export interface Env {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  ENVIRONMENT?: string;
}

// GitHub API Response Types
export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface GitHubCommitResponse {
  sha: string;
  commit: {
    sha: string;
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
}

// Trip and Dashboard Types
export interface TripData {
  clientName: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface TripMetadata {
  title: string;
  dates: string;
  status?: string;
  category: DashboardCategory;
  tags: string[];
  description?: string;
  filename: string;
  lastModified: string;
}

export interface TripsJson {
  version: number;
  trips: TripMetadata[];
}

// Status Mapping Types
export type VoygenStatus = 
  | 'planning' 
  | 'confirmed' 
  | 'deposit_paid' 
  | 'paid_in_full' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export type DashboardCategory = 
  | 'proposal' 
  | 'confirmed' 
  | 'deposit_paid' 
  | 'paid_in_full' 
  | 'active' 
  | 'past' 
  | 'no_sale';

export const STATUS_MAP: Record<VoygenStatus, DashboardCategory> = {
  'planning': 'proposal',
  'confirmed': 'confirmed',
  'deposit_paid': 'deposit_paid',
  'paid_in_full': 'paid_in_full',
  'in_progress': 'active',
  'completed': 'past',
  'cancelled': 'no_sale'
};

// Publication Result Types
export interface PublicationResult {
  success: boolean;
  document_url: string;
  dashboard_url: string;
  document_commit: string;
  dashboard_commit?: string;
  filename: string;
  trip_added: boolean;
  errors?: string[];
  warnings?: string[];
}

// Error Classes
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public operation: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export class TripsJsonError extends Error {
  constructor(
    message: string,
    public operation: string,
    public originalTrips?: TripsJson
  ) {
    super(message);
    this.name = 'TripsJsonError';
  }
}