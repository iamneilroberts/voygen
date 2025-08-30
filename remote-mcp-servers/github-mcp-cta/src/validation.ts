/**
 * Input validation utilities
 */

import { TripData, ValidationError } from './types.js';

export class InputValidator {
  static validateHtmlContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new ValidationError('HTML content cannot be empty');
    }
    
    if (content.length > 5 * 1024 * 1024) { // 5MB limit
      throw new ValidationError('HTML content exceeds 5MB limit');
    }
    
    // Check for potentially malicious content
    const dangerousPatterns = [
      /<script[^>]*>.*?<\/script>/gsi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        console.warn('Potentially dangerous content detected in HTML');
        // Log but don't block - travel documents may contain legitimate scripts
      }
    }
  }
  
  static validateFilePath(path: string): void {
    if (!path || path.trim().length === 0) {
      throw new ValidationError('File path cannot be empty');
    }

    // Check for directory traversal attempts
    if (path.includes('..') || path.includes('//')) {
      throw new ValidationError('File path contains invalid characters (directory traversal)');
    }

    // Ensure path doesn't start with /
    if (path.startsWith('/')) {
      throw new ValidationError('File path should be relative to repository root (no leading slash)');
    }

    // Validate file extension for HTML files
    if (path.endsWith('.html') || path.endsWith('.htm')) {
      const filename = path.split('/').pop();
      if (!filename || !/^[a-zA-Z0-9\-_.]+\.html?$/.test(filename)) {
        throw new ValidationError('Invalid HTML filename. Use only alphanumeric characters, hyphens, underscores, and dots.');
      }
    }
  }

  static validateCommitMessage(message: string): void {
    if (!message || message.trim().length === 0) {
      throw new ValidationError('Commit message cannot be empty');
    }

    if (message.length > 500) {
      throw new ValidationError('Commit message too long (max 500 characters)');
    }
  }

  static validateBranch(branch: string): void {
    if (!branch || branch.trim().length === 0) {
      throw new ValidationError('Branch name cannot be empty');
    }

    // Basic branch name validation
    if (!/^[a-zA-Z0-9\-_./]+$/.test(branch)) {
      throw new ValidationError('Branch name contains invalid characters');
    }
  }

  static validateTripData(tripData: TripData): void {
    const required = ['clientName', 'destination', 'startDate', 'endDate', 'status'];
    
    for (const field of required) {
      if (!(tripData as any)[field]) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }
    
    // Validate dates
    const startDate = new Date(tripData.startDate);
    const endDate = new Date(tripData.endDate);
    
    if (isNaN(startDate.getTime())) {
      throw new ValidationError('Invalid start date format. Use YYYY-MM-DD');
    }
    
    if (isNaN(endDate.getTime())) {
      throw new ValidationError('Invalid end date format. Use YYYY-MM-DD');
    }
    
    if (endDate <= startDate) {
      throw new ValidationError('End date must be after start date');
    }
    
    // Validate status
    const validStatuses = ['Planning', 'Confirmed', 'In Progress', 'Complete'];
    if (!validStatuses.includes(tripData.status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  static sanitizeFilename(clientName: string, destination: string): string {
    // Create a safe filename from client name and destination
    const safeName = clientName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    const safeDestination = destination
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    
    return `${safeName}-${safeDestination}`;
  }
}