/**
 * Index.html management for trip card updates
 */

import { TripData, ValidationError } from './types.js';

export class IndexManager {
  /**
   * Generate a trip card HTML for insertion into index.html (matches existing somotravel.us structure)
   */
  static generateTripCard(tripData: TripData, filename: string): string {
    const formattedStartDate = this.formatDate(tripData.startDate);
    const formattedEndDate = this.formatDate(tripData.endDate);
    const dateRange = `${formattedStartDate} - ${formattedEndDate}`;
    
    return `            <a href="${filename}.html" class="trip-card">
                <div class="trip-title">${this.escapeHtml(tripData.clientName)} - ${this.escapeHtml(tripData.destination)}</div>
                <div class="trip-date">${dateRange}</div>
                <div class="trip-status">${tripData.status}</div>
            </a>`;
  }

  /**
   * Parse existing index.html and add a new trip card (matches somotravel.us structure)
   */
  static addTripToIndex(indexContent: string, tripData: TripData, filename: string): string {
    const newTripCard = this.generateTripCard(tripData, filename);
    
    // Look for the trips-grid section (main container for trip cards)
    const tripsGridPattern = /(<main[^>]*class="trips-grid"[^>]*>)([\s\S]*?)(<\/main>)/i;
    const match = indexContent.match(tripsGridPattern);
    
    if (!match) {
      throw new ValidationError('Could not find trips-grid section in index.html');
    }
    
    const [fullMatch, openingTag, existingCards, closingTag] = match;
    
    // Check if trip already exists (prevent duplicates)
    if (existingCards.includes(`href="${filename}.html"`)) {
      throw new ValidationError(`Trip card for ${filename} already exists in index.html`);
    }
    
    // Find the first non-featured trip card to insert before it (featured cards have "featured-card" class)
    const insertionPoint = existingCards.search(/<a[^>]*class="trip-card"(?![^>]*featured-card)/);
    
    if (insertionPoint === -1) {
      // If no regular trip cards found, add at the end before the "add-trip" card
      const addTripPattern = /<a[^>]*class="trip-card add-trip"/;
      const addTripMatch = existingCards.search(addTripPattern);
      
      if (addTripMatch !== -1) {
        const updatedCards = existingCards.slice(0, addTripMatch) + '\n' + newTripCard + '\n\n            ' + existingCards.slice(addTripMatch);
        return indexContent.replace(fullMatch, openingTag + updatedCards + closingTag);
      } else {
        // Fallback: add at the end
        const updatedCards = existingCards.trimEnd() + '\n\n' + newTripCard;
        return indexContent.replace(fullMatch, openingTag + updatedCards + closingTag);
      }
    } else {
      // Insert before the first regular trip card (after featured cards)
      const updatedCards = existingCards.slice(0, insertionPoint) + '\n' + newTripCard + '\n\n            ' + existingCards.slice(insertionPoint);
      return indexContent.replace(fullMatch, openingTag + updatedCards + closingTag);
    }
  }

  /**
   * Update an existing trip card in index.html
   */
  static updateTripInIndex(indexContent: string, tripData: TripData, filename: string): string {
    const newTripCard = this.generateTripCard(tripData, filename);
    
    // Find the existing trip card
    const cardPattern = new RegExp(
      `(<div class="trip-card">\\s*<div class="trip-info">\\s*<div class="trip-title">[^<]*</div>\\s*<div class="trip-dates">[^<]*</div>\\s*<div class="trip-status[^"]*">[^<]*</div>\\s*</div>\\s*<a href="${filename}\\.html" class="trip-link">View Details</a>\\s*</div>)`,
      'i'
    );
    
    const match = indexContent.match(cardPattern);
    
    if (!match) {
      // If card doesn't exist, add it
      return this.addTripToIndex(indexContent, tripData, filename);
    }
    
    // Replace existing card
    return indexContent.replace(match[1], newTripCard);
  }

  /**
   * Extract trip data from existing index.html for validation
   */
  static extractExistingTrips(indexContent: string): Array<{ filename: string; clientName: string; destination: string }> {
    const trips: Array<{ filename: string; clientName: string; destination: string }> = [];
    
    // Match all trip cards (excluding add-trip card)
    const cardPattern = /<a href="([^"]+)\.html" class="trip-card"(?![^>]*add-trip)[^>]*>[\s\S]*?<div class="trip-title">([^<]+)<\/div>[\s\S]*?<\/a>/g;
    
    let match;
    while ((match = cardPattern.exec(indexContent)) !== null) {
      const filename = match[1];
      const titleParts = match[2].split(' - ');
      
      if (titleParts.length >= 2 && !filename.includes('#')) { // Skip anchors like #contact
        trips.push({
          filename: filename,
          clientName: titleParts[0].trim(),
          destination: titleParts.slice(1).join(' - ').trim()
        });
      }
    }
    
    return trips;
  }

  /**
   * Validate index.html structure (updated for somotravel.us structure)
   */
  static validateIndexStructure(indexContent: string): void {
    // Check for required sections
    if (!indexContent.includes('class="trips-grid"')) {
      throw new ValidationError('Index.html missing trips-grid section');
    }
    
    if (!indexContent.includes('<!DOCTYPE html>')) {
      throw new ValidationError('Index.html missing DOCTYPE declaration');
    }
    
    if (!indexContent.includes('<html')) {
      throw new ValidationError('Index.html missing html tag');
    }
  }

  /**
   * Format date for display
   */
  private static formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return dateString; // Fallback to original string
    }
  }

  /**
   * Escape HTML characters
   */
  private static escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Generate a complete modern index.html template
   */
  static generateIndexTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Somo Travel - Professional Travel Planning</title>
    <meta name="description" content="Professional travel planning and consultation services with custom itineraries and expert destination guidance.">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            text-align: center;
            margin-bottom: 3rem;
            color: white;
        }
        
        header h1 {
            font-size: 3rem;
            font-weight: 300;
            margin-bottom: 0.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }
        
        .intro {
            background: rgba(255, 255, 255, 0.95);
            padding: 2rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .intro h2 {
            color: #4a5568;
            margin-bottom: 1rem;
        }
        
        main.trips-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1.5rem;
        }
        
        .trip-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            text-decoration: none;
            color: inherit;
            border: 1px solid #e2e8f0;
        }
        
        .trip-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        }
        
        .trip-card.featured-card {
            border: 2px solid #667eea;
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
        }
        
        .trip-card.add-trip {
            border: 2px dashed #cbd5e0;
            background: #f7fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 150px;
            color: #718096;
        }
        
        .trip-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #2d3748;
            margin-bottom: 0.75rem;
        }
        
        .trip-date {
            color: #667eea;
            font-weight: 500;
            margin-bottom: 0.5rem;
        }
        
        .trip-status {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 500;
            background: #e2e8f0;
            color: #4a5568;
        }
        
        .trip-status.status-confirmed {
            background: #c6f6d5;
            color: #22543d;
        }
        
        .trip-status.status-planning {
            background: #fed7d7;
            color: #742a2a;
        }
        
        footer {
            text-align: center;
            margin-top: 3rem;
            padding: 2rem;
            color: rgba(255,255,255,0.8);
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            header h1 { font-size: 2rem; }
            main.trips-grid { grid-template-columns: 1fr; }
            .container { padding: 10px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Somo Travel</h1>
            <p>Professional Travel Planning & Consultation</p>
        </header>
        
        <div class="intro">
            <h2>Travel Itineraries & Destination Guides</h2>
            <p>Explore our custom travel plans, featuring expert-curated destinations and personalized experiences for discerning travelers.</p>
        </div>
        
        <main class="trips-grid">
            <!-- Trip cards will be inserted here -->
            
            <a href="#contact" class="trip-card add-trip">
                <div>
                    <strong>Plan Your Journey</strong><br>
                    <small>Contact us for custom travel planning</small>
                </div>
            </a>
        </main>
        
        <footer>
            <p>&copy; 2025 Somo Travel. Professional travel planning services.</p>
        </footer>
    </div>
</body>
</html>`;
  }
}