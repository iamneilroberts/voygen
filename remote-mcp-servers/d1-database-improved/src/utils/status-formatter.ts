/**
 * Status Dashboard Formatting Utilities
 * Adds visual status indicators to travel agent responses
 */

export interface TripStatus {
  tripName?: string;
  phase?: string;
  step?: number;
  totalSteps?: number;
  budgetUsed?: number;
  budgetTotal?: number;
  daysUntilDeparture?: number;
  completedTasks?: string[];
  inProgress?: string;
  nextActions?: string[];
  status?: string;
}

export function extractTripStatus(rawData: any, contextType: string): TripStatus {
  const status: TripStatus = {};
  
  try {
    if (contextType === 'trip_direct' || contextType === 'trip' || contextType === 'trip_simple') {
      // Parse raw_data if it's a JSON string
      let tripData = rawData;
      if (typeof rawData === 'string') {
        try {
          tripData = JSON.parse(rawData);
        } catch (e) {
          console.warn('Failed to parse raw_data JSON:', e);
          tripData = rawData;
        }
      }
      
      // Parse workflow state if available
      if (tripData.workflow_state) {
        const workflow = typeof tripData.workflow_state === 'string' 
          ? JSON.parse(tripData.workflow_state) 
          : tripData.workflow_state;
        
        status.phase = workflow.current_phase;
        status.step = workflow.current_step;
        status.totalSteps = 12; // Standard workflow steps
      }
      
      // Extract trip info
      status.tripName = tripData.trip_name || tripData.natural_key || rawData.natural_key;
      status.status = tripData.status;
      
      // Calculate days until departure
      if (tripData.start_date) {
        const startDate = new Date(tripData.start_date);
        const today = new Date();
        const diffTime = startDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        status.daysUntilDeparture = diffDays > 0 ? diffDays : 0;
      }
      
      // Extract budget info if available
      if (tripData.total_cost) {
        status.budgetUsed = tripData.total_cost;
        status.budgetTotal = tripData.budget_limit || tripData.total_cost * 1.2; // Estimate if not set
      }
    }
  } catch (error) {
    console.warn('Failed to extract trip status:', error);
  }
  
  return status;
}

export function formatStatusDashboard(originalResponse: string, status: TripStatus): string {
  // If we don't have enough info, return original response
  if (!status.tripName && !status.phase) {
    return originalResponse;
  }
  
  const dashboard = buildDashboard(status);
  
  return `${dashboard}\n\n${originalResponse}`;
}

function buildDashboard(status: TripStatus): string {
  const lines = [
    '📊 **Trip Status Dashboard**',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  ];
  
  // Trip name
  if (status.tripName) {
    lines.push(`🎯 **Trip:** ${status.tripName}`);
  }
  
  // Workflow phase
  if (status.phase && status.step && status.totalSteps) {
    const phaseDisplay = status.phase.charAt(0).toUpperCase() + status.phase.slice(1);
    lines.push(`📋 **Phase:** ${phaseDisplay} (Step ${status.step}/${status.totalSteps})`);
    
    // Progress bar
    const progress = Math.floor((status.step / status.totalSteps) * 20);
    const progressBar = '█'.repeat(progress) + '░'.repeat(20 - progress);
    lines.push(`📈 **Progress:** [${progressBar}] ${Math.floor((status.step / status.totalSteps) * 100)}%`);
  }
  
  // Budget tracking
  if (status.budgetUsed && status.budgetTotal) {
    const budgetPercent = Math.floor((status.budgetUsed / status.budgetTotal) * 100);
    const budgetStatus = budgetPercent > 90 ? '🔴' : budgetPercent > 70 ? '🟡' : '🟢';
    lines.push(`💰 **Budget:** ${budgetStatus} $${status.budgetUsed.toLocaleString()} / $${status.budgetTotal.toLocaleString()} (${budgetPercent}%)`);
  }
  
  // Timeline
  if (status.daysUntilDeparture !== undefined) {
    const urgency = status.daysUntilDeparture < 7 ? '🔥' : status.daysUntilDeparture < 30 ? '⏰' : '📅';
    const timeText = status.daysUntilDeparture === 0 ? 'Today!' : 
                     status.daysUntilDeparture === 1 ? 'Tomorrow!' : 
                     `${status.daysUntilDeparture} days`;
    lines.push(`${urgency} **Timeline:** ${timeText} until departure`);
  }
  
  // Status
  if (status.status) {
    const statusEmoji = getStatusEmoji(status.status);
    lines.push(`${statusEmoji} **Status:** ${status.status.charAt(0).toUpperCase() + status.status.slice(1)}`);
  }
  
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  return lines.join('\n');
}

function getStatusEmoji(status: string): string {
  switch (status.toLowerCase()) {
    case 'planning': return '📝';
    case 'confirmed': return '✅';
    case 'in_progress': return '🚀';
    case 'completed': return '🏆';
    case 'cancelled': return '❌';
    default: return '📋';
  }
}

export function formatWorkflowStatus(phase: string, step: number): string {
  const phaseEmojis: { [key: string]: string } = {
    'interview': '💬',
    'conceptualization': '💡', 
    'planning': '📋',
    'proposal': '📝',
    'revision': '🔄',
    'finalization': '✅',
    'preparation': '🎒'
  };
  
  const emoji = phaseEmojis[phase.toLowerCase()] || '📋';
  const phaseDisplay = phase.charAt(0).toUpperCase() + phase.slice(1);
  
  return `${emoji} **Current Phase:** ${phaseDisplay} (Step ${step})`;
}