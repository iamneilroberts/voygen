/**
 * Trips.json Management for Dashboard Integration
 */

import { GitHubClient } from './github-client.js';
import { 
  TripsJson, 
  TripMetadata, 
  VoygenStatus, 
  DashboardCategory, 
  STATUS_MAP, 
  TripsJsonError, 
  ValidationError 
} from './types.js';

export class TripsManager {
  constructor(private client: GitHubClient) {}

  async getTripsJson(branch = 'main'): Promise<TripsJson> {
    try {
      const file = await this.client.getFile('trips.json', branch);
      const trips = JSON.parse(file.content) as TripsJson;
      
      this.validateTripsJson(trips);
      return trips;
    } catch (error: any) {
      if (error.statusCode === 404) {
        // trips.json doesn't exist, create empty structure
        return { version: 1, trips: [] };
      }
      throw new TripsJsonError(
        `Failed to load trips.json: ${error.message}`,
        'get_trips'
      );
    }
  }

  async updateTripsJson(
    trips: TripsJson, 
    message: string, 
    branch = 'main'
  ): Promise<{ commit: string; updated: boolean }> {
    try {
      this.validateTripsJson(trips);
      
      const content = JSON.stringify(trips, null, 2);
      
      try {
        // Try to get existing file to update it
        const existingFile = await this.client.getFile('trips.json', branch);
        const commit = await this.client.updateFile(
          'trips.json',
          content,
          message,
          existingFile.sha,
          branch
        );
        return { commit: commit.sha, updated: true };
      } catch (error: any) {
        if (error.statusCode === 404) {
          // File doesn't exist, create it
          const commit = await this.client.createFile(
            'trips.json',
            content,
            message,
            branch
          );
          return { commit: commit.sha, updated: false };
        }
        throw error;
      }
    } catch (error: any) {
      throw new TripsJsonError(
        `Failed to update trips.json: ${error.message}`,
        'update_trips',
        trips
      );
    }
  }

  async addOrUpdateTrip(
    tripMetadata: Omit<TripMetadata, 'lastModified'>,
    branch = 'main'
  ): Promise<{ success: boolean; trip_added: boolean; commit: string }> {
    try {
      const trips = await this.getTripsJson(branch);
      
      // Check if trip already exists (by filename)
      const existingIndex = trips.trips.findIndex(
        trip => trip.filename === tripMetadata.filename
      );

      const updatedTrip: TripMetadata = {
        ...tripMetadata,
        lastModified: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      };

      let trip_added = false;
      if (existingIndex >= 0) {
        // Update existing trip
        trips.trips[existingIndex] = updatedTrip;
      } else {
        // Add new trip
        trips.trips.push(updatedTrip);
        trip_added = true;
      }

      // Sort trips by category priority and date
      this.sortTrips(trips.trips);

      const result = await this.updateTripsJson(
        trips,
        trip_added 
          ? `Add new trip: ${tripMetadata.title}`
          : `Update trip: ${tripMetadata.title}`,
        branch
      );

      return {
        success: true,
        trip_added,
        commit: result.commit
      };
    } catch (error: any) {
      throw new TripsJsonError(
        `Failed to add/update trip: ${error.message}`,
        'add_update_trip'
      );
    }
  }

  mapVoygenStatusToDashboard(voygenStatus: VoygenStatus): DashboardCategory {
    return STATUS_MAP[voygenStatus] || 'proposal';
  }

  private validateTripsJson(trips: any): void {
    if (!trips || typeof trips !== 'object') {
      throw new ValidationError('Invalid trips.json format: not an object');
    }

    if (!trips.version || typeof trips.version !== 'number') {
      throw new ValidationError('Invalid trips.json format: missing or invalid version');
    }

    if (!Array.isArray(trips.trips)) {
      throw new ValidationError('Invalid trips.json format: trips is not an array');
    }

    // Validate each trip entry
    for (const [index, trip] of trips.trips.entries()) {
      this.validateTripEntry(trip, index);
    }
  }

  private validateTripEntry(trip: any, index: number): void {
    const prefix = `Trip ${index}:`;

    if (!trip.title || typeof trip.title !== 'string') {
      throw new ValidationError(`${prefix} missing or invalid title`);
    }

    if (!trip.dates || typeof trip.dates !== 'string') {
      throw new ValidationError(`${prefix} missing or invalid dates`);
    }

    if (!trip.filename || typeof trip.filename !== 'string') {
      throw new ValidationError(`${prefix} missing or invalid filename`);
    }

    if (!trip.category || typeof trip.category !== 'string') {
      throw new ValidationError(`${prefix} missing or invalid category`);
    }

    const validCategories: DashboardCategory[] = [
      'proposal', 'confirmed', 'deposit_paid', 'paid_in_full', 'active', 'past', 'no_sale'
    ];
    
    if (!validCategories.includes(trip.category as DashboardCategory)) {
      throw new ValidationError(`${prefix} invalid category: ${trip.category}`);
    }

    if (!Array.isArray(trip.tags)) {
      throw new ValidationError(`${prefix} tags must be an array`);
    }

    if (!trip.lastModified || typeof trip.lastModified !== 'string') {
      throw new ValidationError(`${prefix} missing or invalid lastModified`);
    }
  }

  private sortTrips(trips: TripMetadata[]): void {
    // Define category priority for sorting
    const categoryPriority: Record<DashboardCategory, number> = {
      'proposal': 1,
      'confirmed': 2,
      'deposit_paid': 3,
      'paid_in_full': 4,
      'active': 5,
      'past': 6,
      'no_sale': 7
    };

    trips.sort((a, b) => {
      // First sort by category priority
      const categoryDiff = categoryPriority[a.category] - categoryPriority[b.category];
      if (categoryDiff !== 0) {
        return categoryDiff;
      }

      // Then sort by lastModified date (newest first)
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    });
  }

  async backupTripsJson(branch = 'main'): Promise<{ backed_up: boolean; backup_path?: string }> {
    try {
      const trips = await this.getTripsJson(branch);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const backupPath = `trips-backup-${timestamp}.json`;
      
      await this.client.createFile(
        backupPath,
        JSON.stringify(trips, null, 2),
        `Backup trips.json before modification`,
        branch
      );

      return { backed_up: true, backup_path: backupPath };
    } catch (error) {
      return { backed_up: false };
    }
  }

  createTripMetadata(
    title: string,
    dates: string,
    filename: string,
    voygenStatus: VoygenStatus,
    tags: string[] = [],
    description?: string
  ): Omit<TripMetadata, 'lastModified'> {
    return {
      title,
      dates,
      filename,
      category: this.mapVoygenStatusToDashboard(voygenStatus),
      tags,
      description: description || '',
      status: voygenStatus
    };
  }
}