import * as nunjucks from 'nunjucks';
import { marked } from 'marked';
import { TripData, TemplateOptions } from './types';

export class TemplateEngine {
  private env: nunjucks.Environment;
  
  constructor() {
    // Force use of fallback template engine for Cloudflare Workers
    // Nunjucks requires eval() which is still restricted even with nodejs_compat
    console.log('Using optimized fallback template engine for Cloudflare Workers');
    this.env = null as any;
  }
  
  private registerFilters() {
    // Date formatting filter
    this.env.addFilter('date', (date: string | Date, format: string = 'short') => {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return 'Invalid Date';
      
      switch (format) {
        case 'short':
          return d.toLocaleDateString();
        case 'long':
          return d.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        case 'time':
          return d.toLocaleTimeString();
        default:
          return d.toLocaleDateString();
      }
    });
    
    // Currency formatting filter
    this.env.addFilter('currency', (amount: number, currency: string = 'USD') => {
      if (typeof amount !== 'number') return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    });
    
    // Markdown rendering filter
    this.env.addFilter('markdown', (text: string) => {
      if (!text) return '';
      return marked(text);
    });
    
    // Safe array slice filter
    this.env.addFilter('slice', (array: any[], start: number, end?: number) => {
      if (!Array.isArray(array)) return [];
      return array.slice(start, end);
    });
    
    // Default value filter
    this.env.addFilter('default', (value: any, defaultValue: any) => {
      return value !== null && value !== undefined && value !== '' ? value : defaultValue;
    });
  }
  
  private registerGlobals() {
    // Global helper functions
    this.env.addGlobal('formatPrice', (hotel: any) => {
      if (hotel?.lead_price?.amount) {
        return `$${hotel.lead_price.amount}`;
      }
      return 'Price not available';
    });
    
    this.env.addGlobal('getRating', (rating: number) => {
      if (!rating) return '';
      return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
    });
  }
  
  async render(templateName: string, data: TripData, options?: TemplateOptions): Promise<string> {
    try {
      const template = this.getTemplate(templateName);
      const context = {
        ...data,
        options: options || {},
        generated_at: new Date().toISOString(),
        year: new Date().getFullYear()
      };
      
      if (this.env) {
        return this.env.renderString(template, context);
      } else {
        // Fallback: Simple template replacement for Cloudflare Workers
        return this.renderFallback(template, context);
      }
    } catch (error) {
      console.error('Template rendering error:', error);
      throw new Error(`Failed to render template ${templateName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private renderFallback(template: string, data: any): string {
    // Process templates hierarchically to handle nested blocks correctly
    let result = template;
    
    // Handle filters first (global functions)
    result = this.processFilters(result, data);
    
    // Process nested blocks from inside-out using recursive approach
    result = this.processNestedBlocks(result, data);
    
    // Final variable replacement
    result = result.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, expression) => {
      const value = this.getNestedValueWithFilters(expression.trim(), data);
      return value !== null && value !== undefined ? String(value) : '';
    });
    
    return result;
  }
  
  private processNestedBlocks(template: string, data: any): string {
    let result = template;
    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops
    
    // Keep processing until no more changes (handles nested blocks)
    while (changed && iterations < maxIterations) {
      const before = result;
      
      // Process innermost for loops first (no nested blocks inside)
      result = result.replace(/\{\%\s*for\s+(\w+)\s+in\s+([^%]+?)\s*\%\}((?:(?!\{\%\s*(?:for|if)\s+)[^{]|\{(?!%)|\{\%(?!\s*(?:for|if)\s+))*?)\{\%\s*endfor\s*\%\}/g, 
        (match, itemVar, arrayVar, content) => {
          const array = this.getNestedValueWithFilters(arrayVar.trim(), data);
          if (!Array.isArray(array)) return '';
          
          return array.map((item) => {
            let itemContent = content;
            // Process variables within loop context
            itemContent = this.processLoopVariables(itemContent, itemVar, item);
            return itemContent;
          }).join('');
        });
      
      // Process innermost if blocks first (no nested blocks inside)
      result = result.replace(/\{\%\s*if\s+([^%]+?)\s*\%\}((?:(?!\{\%\s*(?:for|if)\s+)[^{]|\{(?!%)|\{\%(?!\s*(?:for|if)\s+))*?)(?:\{\%\s*else\s*\%\}((?:(?!\{\%\s*(?:for|if)\s+)[^{]|\{(?!%)|\{\%(?!\s*(?:for|if)\s+))*?))?\{\%\s*endif\s*\%\}/g, 
        (match, condition, ifContent, elseContent = '') => {
          const conditionValue = this.evaluateCondition(condition.trim(), data);
          return conditionValue ? ifContent : elseContent;
        });
      
      changed = (result !== before);
      iterations++;
    }
    
    return result;
  }
  
  private processLoopVariables(content: string, itemVar: string, item: any): string {
    let result = content;
    
    // Replace item variables with nested properties (e.g., hotel.name, hotel.lead_price.amount)
    result = result.replace(new RegExp(`\\{\\{\\s*${itemVar}(?:\\.(\\w+(?:\\.\\w+)*))\\s*\\}\\}`, 'g'), (m, prop) => {
      if (prop) {
        return this.getNestedValue(item, prop) || '';
      }
      return String(item);
    });
    
    // Replace simple item variable
    result = result.replace(new RegExp(`\\{\\{\\s*${itemVar}\\s*\\}\\}`, 'g'), String(item));
    
    return result;
  }
  
  private processFilters(template: string, data: any): string {
    // Handle global function calls like formatPrice() and getRating()
    template = template.replace(/\{\{\s*formatPrice\(([^)]+)\)\s*\}\}/g, (match, hotelVar) => {
      const hotel = this.getNestedValue(data, hotelVar.trim());
      if (hotel?.lead_price?.amount) {
        return `$${hotel.lead_price.amount}`;
      }
      return 'Price not available';
    });
    
    template = template.replace(/\{\{\s*getRating\(([^)]+)\)\s*\}\}/g, (match, ratingVar) => {
      const rating = this.getNestedValue(data, ratingVar.trim());
      if (!rating) return '';
      return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
    });
    
    return template;
  }
  
  private evaluateCondition(condition: string, data: any): boolean {
    // Handle various condition types
    if (condition.includes(' and ')) {
      const parts = condition.split(' and ');
      return parts.every(part => this.evaluateCondition(part.trim(), data));
    }
    
    if (condition.includes(' or ')) {
      const parts = condition.split(' or ');
      return parts.some(part => this.evaluateCondition(part.trim(), data));
    }
    
    // Handle comparison operators
    const comparisons = ['>=', '<=', '>', '<', '==', '!='];
    for (const op of comparisons) {
      if (condition.includes(` ${op} `)) {
        const [left, right] = condition.split(` ${op} `).map(s => s.trim());
        const leftValue = this.getNestedValueWithFilters(left, data);
        const rightValue = isNaN(Number(right)) ? this.getNestedValueWithFilters(right, data) : Number(right);
        
        switch (op) {
          case '>': return Number(leftValue) > Number(rightValue);
          case '<': return Number(leftValue) < Number(rightValue);
          case '>=': return Number(leftValue) >= Number(rightValue);
          case '<=': return Number(leftValue) <= Number(rightValue);
          case '==': return leftValue == rightValue;
          case '!=': return leftValue != rightValue;
        }
      }
    }
    
    // Simple existence check
    const value = this.getNestedValueWithFilters(condition, data);
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return Boolean(value);
  }
  
  private getNestedValueWithFilters(expression: string, data: any): any {
    // Handle expressions with filters (e.g., "hotels | slice(0, 10)")
    if (expression.includes(' | ')) {
      const parts = expression.split(' | ');
      let value = this.getNestedValue(data, parts[0].trim());
      
      for (let i = 1; i < parts.length; i++) {
        const filterExpr = parts[i].trim();
        value = this.applyFilter(value, filterExpr);
      }
      
      return value;
    }
    
    return this.getNestedValue(data, expression);
  }
  
  private applyFilter(value: any, filterExpr: string): any {
    if (filterExpr.startsWith('slice(')) {
      // Extract slice parameters
      const match = filterExpr.match(/slice\((\d+)(?:,\s*(\d+))?\)/);
      if (match && Array.isArray(value)) {
        const start = parseInt(match[1]);
        const end = match[2] ? parseInt(match[2]) : undefined;
        return value.slice(start, end);
      }
    }
    
    if (filterExpr.startsWith('date(')) {
      // Extract date format
      const match = filterExpr.match(/date\('([^']+)'\)/);
      const format = match ? match[1] : 'short';
      
      const d = typeof value === 'string' ? new Date(value) : value;
      if (!(d instanceof Date) || isNaN(d.getTime())) return 'Invalid Date';
      
      switch (format) {
        case 'short':
          return d.toLocaleDateString();
        case 'long':
          return d.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        case 'time':
          return d.toLocaleTimeString();
        default:
          return d.toLocaleDateString();
      }
    }
    
    if (filterExpr.startsWith('currency')) {
      if (typeof value !== 'number') return '$0.00';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(value);
    }
    
    if (filterExpr.startsWith('default(')) {
      const match = filterExpr.match(/default\(([^)]+)\)/);
      if (match && (value === null || value === undefined || value === '')) {
        const defaultValue = match[1].replace(/['"]/g, '');
        return defaultValue;
      }
    }
    
    return value;
  }
  
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) return null;
      current = current[key];
    }
    
    return current;
  }
  
  private getTemplate(templateName: string): string {
    // For now, we'll embed templates directly in the code
    // Later these could be loaded from D1 database or external storage
    switch (templateName) {
      case 'standard':
        return this.getStandardTemplate();
      case 'luxury':
        return this.getLuxuryTemplate();
      case 'family':
        return this.getFamilyTemplate();
      default:
        return this.getStandardTemplate();
    }
  }
  
  private getStandardTemplate(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Travel Proposal: {{ title or trip_id }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 30px 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .proposal-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #2a5aa0 0%, #1e3d6f 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            font-weight: 300;
            margin-bottom: 10px;
            letter-spacing: -1px;
        }
        
        .header h2 {
            font-size: 1.8rem;
            font-weight: 400;
            margin-bottom: 15px;
            opacity: 0.95;
        }
        
        .trip-dates {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-top: 10px;
        }
        
        .content { padding: 40px 30px; }
        .section { margin-bottom: 40px; }
        
        .section h3 {
            font-size: 1.5rem;
            color: #2a5aa0;
            margin-bottom: 20px;
            border-bottom: 2px solid #e1e8ed;
            padding-bottom: 10px;
        }
        
        .hotel {
            background: #fafbfc;
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            margin-bottom: 20px;
            padding: 25px;
            transition: all 0.3s ease;
        }
        
        .hotel:hover {
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .hotel h4 {
            font-size: 1.3rem;
            color: #1e3d6f;
            margin-bottom: 15px;
            font-weight: 600;
        }
        
        .hotel-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .hotel-meta p {
            margin: 5px 0;
            color: #666;
        }
        
        .hotel-meta strong {
            color: #333;
        }
        
        .price {
            font-weight: 700;
            color: #2a5aa0;
            font-size: 1.2rem;
        }
        
        .rating {
            color: #ffa500;
            font-size: 1.1rem;
        }
        
        .refundable-badge {
            display: inline-block;
            background: #e8f5e8;
            color: #2d5a2d;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9rem;
            margin-top: 10px;
        }
        
        .commission-indicator {
            color: #28a745;
            font-weight: bold;
            margin-left: 10px;
        }
        
        .amenities {
            margin-top: 15px;
        }
        
        .amenity {
            display: inline-block;
            background: #e3f2fd;
            color: #1565c0;
            padding: 3px 8px;
            margin: 2px 4px 2px 0;
            border-radius: 12px;
            font-size: 0.85rem;
        }
        
        .summary {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        
        .summary h3 {
            color: #2a5aa0;
            margin-bottom: 15px;
            border: none;
            padding: 0;
        }
        
        .cost-breakdown {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 15px;
        }
        
        .cost-item {
            text-align: center;
        }
        
        .cost-amount {
            font-size: 1.4rem;
            font-weight: 600;
            color: #2a5aa0;
        }
        
        .footer {
            margin-top: 50px;
            padding-top: 30px;
            border-top: 1px solid #e1e8ed;
            text-align: center;
            color: #666;
            font-size: 0.9rem;
        }
        
        @media print {
            body { background: none; padding: 0; }
            .proposal-container { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="proposal-container">
        <header class="header">
            <h1>Travel Proposal</h1>
            <h2>{{ title or "Custom Itinerary" }}</h2>
            {% if destinations %}
            <div>{{ destinations }}</div>
            {% endif %}
            {% if start_date and end_date %}
            <div class="trip-dates">
                {{ start_date | date('long') }} - {{ end_date | date('long') }}
            </div>
            {% endif %}
        </header>
        
        <main class="content">
            {% if hotels and hotels.length > 0 %}
            <section class="section">
                <h3>Recommended Hotels</h3>
                
                {% for hotel in hotels | slice(0, 10) %}
                <div class="hotel">
                    <h4>{{ hotel.name | default("Hotel Name Not Available") }}</h4>
                    
                    <div class="hotel-meta">
                        <div>
                            <p><strong>Location:</strong> {{ hotel.city | default(hotel.location) | default("Location not specified") }}</p>
                            {% if hotel.star_rating %}
                            <p><strong>Rating:</strong> <span class="rating">{{ getRating(hotel.star_rating) }}</span> ({{ hotel.star_rating }} stars)</p>
                            {% endif %}
                        </div>
                        <div>
                            <p><strong>Price:</strong> <span class="price">{{ formatPrice(hotel) }}</span> per night</p>
                            <p><strong>Source:</strong> {{ hotel.site | default('Unknown') }}</p>
                        </div>
                    </div>
                    
                    {% if hotel.amenities and hotel.amenities.length > 0 %}
                    <div class="amenities">
                        <strong>Amenities:</strong>
                        {% for amenity in hotel.amenities | slice(0, 8) %}
                        <span class="amenity">{{ amenity }}</span>
                        {% endfor %}
                    </div>
                    {% endif %}
                    
                    {% if hotel.refundable %}
                    <div class="refundable-badge">
                        ✓ Free cancellation{% if hotel.cancellation_deadline %} until {{ hotel.cancellation_deadline | date }}{% endif %}
                    </div>
                    {% endif %}
                    
                    {% if hotel.commission_amount %}
                    <span class="commission-indicator">✓ Commission Available</span>
                    {% endif %}
                </div>
                {% endfor %}
            </section>
            {% else %}
            <section class="section">
                <h3>Hotel Recommendations</h3>
                <p>No hotel options available. Please run a hotel search first.</p>
            </section>
            {% endif %}
            
            {% if total_cost or total_commission %}
            <section class="section">
                <div class="summary">
                    <h3>Trip Summary</h3>
                    <div class="cost-breakdown">
                        {% if total_cost %}
                        <div class="cost-item">
                            <div class="cost-amount">{{ total_cost | currency }}</div>
                            <div>Estimated Total Cost</div>
                        </div>
                        {% endif %}
                        {% if total_commission %}
                        <div class="cost-item">
                            <div class="cost-amount">{{ total_commission | currency }}</div>
                            <div>Your Commission</div>
                        </div>
                        {% endif %}
                    </div>
                </div>
            </section>
            {% endif %}
        </main>
        
        <footer class="footer">
            <p><strong>VoygentCE Travel Proposal</strong><br>
            Trip ID: {{ trip_id }}<br>
            {% if client %}
            Prepared for: {{ client.name }}{% if client.email %} ({{ client.email }}){% endif %}<br>
            {% endif %}
            Generated: {{ generated_at | date('long') }}</p>
        </footer>
    </div>
</body>
</html>`;
  }
  
  private getLuxuryTemplate(): string {
    // Simplified luxury template - can be expanded later
    return this.getStandardTemplate().replace(
      'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);',
      'background: linear-gradient(135deg, #000428 0%, #004e92 100%);'
    ).replace(
      'background: linear-gradient(135deg, #2a5aa0 0%, #1e3d6f 100%);',
      'background: linear-gradient(135deg, #8b5a3c 0%, #4a3429 100%);'
    );
  }
  
  private getFamilyTemplate(): string {
    // Simplified family template - can be expanded later
    return this.getStandardTemplate().replace(
      'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);',
      'background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);'
    );
  }
}