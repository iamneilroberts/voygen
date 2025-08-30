// V1 vs V2 Comparison Tool
export async function compareVersions(query: string) {
  console.log(`Comparing query: ${query}`);

  // Run on v1
  const v1Start = Date.now();
  // Execute v1 query
  const v1Time = Date.now() - v1Start;

  // Run on v2
  const v2Start = Date.now();
  // Execute v2 query
  const v2Time = Date.now() - v2Start;

  return {
    query,
    v1Time,
    v2Time,
    improvement: ((v1Time - v2Time) / v1Time * 100).toFixed(2) + '%'
  };
}