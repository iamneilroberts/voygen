/**
 * HTML template for basic proposal generation
 */

import { Trip } from '../types';

/**
 * Generate basic HTML proposal for MVP
 */
export function generateBasicProposalHTML(trip: Trip): string {
  const destinations = trip.destinations || 'Various destinations';
  const startDate = new Date(trip.start_date).toLocaleDateString();
  const endDate = new Date(trip.end_date).toLocaleDateString();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${trip.trip_name} - Travel Proposal</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            color: #333; 
        }
        .header { 
            text-align: center; 
            border-bottom: 2px solid #007bff; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .trip-info { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
        }
        .status { 
            display: inline-block; 
            padding: 4px 12px; 
            border-radius: 16px; 
            font-size: 0.85em; 
            font-weight: 600; 
            text-transform: uppercase; 
        }
        .status.planning { background: #fff3cd; color: #856404; }
        .status.confirmed { background: #d1ecf1; color: #0c5460; }
        .status.in_progress { background: #d4edda; color: #155724; }
        .status.completed { background: #d1ecf1; color: #0c5460; }
        h1 { color: #007bff; margin: 0; }
        h2 { color: #495057; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; }
        .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #dee2e6; 
            color: #6c757d; 
            font-size: 0.9em; 
        }
        @media (max-width: 600px) {
            body { padding: 10px; }
            .trip-info { padding: 15px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${trip.trip_name}</h1>
        <p>Travel Proposal</p>
        <span class="status ${trip.status}">${trip.status}</span>
    </div>
    
    <div class="trip-info">
        <h2>Trip Overview</h2>
        <p><strong>Destinations:</strong> ${destinations}</p>
        <p><strong>Dates:</strong> ${startDate} to ${endDate}</p>
        <p><strong>Status:</strong> ${trip.status}</p>
        ${trip.total_cost ? `<p><strong>Estimated Cost:</strong> $${trip.total_cost}</p>` : ''}
        ${trip.group_name ? `<p><strong>Group:</strong> ${trip.group_name}</p>` : ''}
    </div>
    
    <div class="content">
        <h2>Trip Details</h2>
        <p>This is a ${trip.status} travel proposal for ${trip.trip_name}.</p>
        <p>We will be traveling to ${destinations} from ${startDate} to ${endDate}.</p>
        
        ${trip.schedule ? `
        <h2>Itinerary</h2>
        <p>Detailed itinerary planning is in progress. Please contact us for the latest updates.</p>
        ` : ''}
        
        <h2>Next Steps</h2>
        <p>Please review this proposal and let us know if you have any questions or modifications.</p>
    </div>
    
    <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        <p>Powered by Voygen Travel Assistant</p>
    </div>
</body>
</html>`.trim();
}