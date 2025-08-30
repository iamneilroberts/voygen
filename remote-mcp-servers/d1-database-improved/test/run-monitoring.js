const { execSync } = require('child_process');

console.log('📊 LLM Tools Performance Monitoring Dashboard');
console.log('='.repeat(50));
console.log(`Generated: ${new Date().toISOString()}\n`);

try {
  // Run the monitoring query
  const result = execSync(
    'wrangler d1 execute travel_assistant --file=test/monitor-performance.sql --remote --json',
    { encoding: 'utf8' }
  );
  
  const data = JSON.parse(result);
  
  if (data[0]?.results) {
    // Group results by metric type
    const metrics = {};
    
    data[0].results.forEach(row => {
      const type = row.metric_type;
      if (!metrics[type]) metrics[type] = [];
      metrics[type].push(row);
    });
    
    // Display each metric group
    Object.entries(metrics).forEach(([type, rows]) => {
      console.log(`\n📈 ${type}`);
      console.log('-'.repeat(40));
      
      rows.forEach(row => {
        if (type === 'Tool Usage Stats') {
          console.log(`${row.context_type}: ${row.total_records} records, ${row.total_accesses} accesses`);
        } else if (type === 'Popular Searches') {
          console.log(`${row.context_type}`);
        } else if (type === 'FAQ Usage') {
          console.log(`"${row.context_type}": ${row.total_accesses} uses`);
        } else if (type === 'Search Index') {
          console.log(`${row.context_type}: ${row.total_records} indexed, relevance avg: ${parseFloat(row.avg_accesses).toFixed(2)}`);
        } else if (type === 'Recent Activity') {
          console.log(`Active contexts: ${row.total_records}, Total accesses: ${row.total_accesses}`);
        }
      });
    });
  }
} catch (error) {
  console.error('Error running monitoring query:', error.message);
}