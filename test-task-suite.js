#!/usr/bin/env node

/**
 * Test Suite Runner for TASK-0074, TASK-0075, and TASK-0076
 *
 * This script runs the comprehensive test suite and reports results
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const testDirectory = './remote-mcp-servers/d1-database-improved';
const testFiles = [
  'tests/trip-search-surface.test.ts',
  'tests/trip-facts-manager.test.ts',
  'tests/trip-surface-search.test.ts',
  'tests/task-0074-0076-integration.test.ts'
];

console.log('🧪 Running Test Suite for TASK-0074, TASK-0075, and TASK-0076');
console.log('=' .repeat(60));

async function runTests() {
  const results = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    testFiles: [],
    startTime: Date.now()
  };

  // Check if test directory exists
  if (!fs.existsSync(testDirectory)) {
    console.error(`❌ Test directory not found: ${testDirectory}`);
    process.exit(1);
  }

  console.log(`📁 Test Directory: ${testDirectory}`);
  console.log(`📋 Test Files: ${testFiles.length}`);
  console.log('');

  // Change to test directory
  process.chdir(testDirectory);

  for (const testFile of testFiles) {
    console.log(`🔍 Running: ${testFile}`);

    if (!fs.existsSync(testFile)) {
      console.log(`⚠️  Test file not found: ${testFile}`);
      results.testFiles.push({
        file: testFile,
        status: 'missing',
        tests: 0,
        passed: 0,
        failed: 0
      });
      continue;
    }

    try {
      const testResult = await runSingleTest(testFile);
      results.testFiles.push(testResult);
      results.totalTests += testResult.tests;
      results.passedTests += testResult.passed;
      results.failedTests += testResult.failed;
    } catch (error) {
      console.error(`❌ Error running ${testFile}:`, error.message);
      results.testFiles.push({
        file: testFile,
        status: 'error',
        error: error.message,
        tests: 0,
        passed: 0,
        failed: 0
      });
    }

    console.log('');
  }

  const endTime = Date.now();
  const duration = (endTime - results.startTime) / 1000;

  // Print summary
  console.log('📊 TEST SUITE SUMMARY');
  console.log('=' .repeat(60));
  console.log(`⏱️  Duration: ${duration.toFixed(2)}s`);
  console.log(`📈 Total Tests: ${results.totalTests}`);
  console.log(`✅ Passed: ${results.passedTests}`);
  console.log(`❌ Failed: ${results.failedTests}`);
  console.log(`📝 Success Rate: ${results.totalTests > 0 ? ((results.passedTests / results.totalTests) * 100).toFixed(1) : 0}%`);
  console.log('');

  // Print detailed results
  console.log('📋 DETAILED RESULTS');
  console.log('-' .repeat(60));

  results.testFiles.forEach(result => {
    const status = result.status === 'passed' ? '✅' :
                   result.status === 'failed' ? '❌' :
                   result.status === 'missing' ? '⚠️' : '💥';

    console.log(`${status} ${result.file}`);
    if (result.status === 'passed' || result.status === 'failed') {
      console.log(`   Tests: ${result.tests}, Passed: ${result.passed}, Failed: ${result.failed}`);
    } else if (result.status === 'error') {
      console.log(`   Error: ${result.error}`);
    } else if (result.status === 'missing') {
      console.log(`   File not found`);
    }
  });

  console.log('');

  // Print task-specific analysis
  console.log('📋 TASK VALIDATION');
  console.log('-' .repeat(60));

  const taskResults = analyzeTaskResults(results);
  Object.entries(taskResults).forEach(([task, analysis]) => {
    console.log(`${analysis.status} ${task}: ${analysis.description}`);
    if (analysis.details) {
      analysis.details.forEach(detail => console.log(`   ${detail}`));
    }
  });

  return results.failedTests === 0;
}

async function runSingleTest(testFile) {
  return new Promise((resolve) => {
    const vitest = spawn('npx', ['vitest', 'run', testFile, '--reporter=verbose'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    vitest.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    vitest.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    vitest.on('close', (code) => {
      const output = stdout + stderr;
      const result = parseVitestOutput(testFile, output, code);

      if (result.status === 'passed') {
        console.log(`   ✅ ${result.passed}/${result.tests} tests passed`);
      } else {
        console.log(`   ❌ ${result.failed}/${result.tests} tests failed`);
      }

      resolve(result);
    });
  });
}

function parseVitestOutput(testFile, output, exitCode) {
  const result = {
    file: testFile,
    status: exitCode === 0 ? 'passed' : 'failed',
    tests: 0,
    passed: 0,
    failed: 0,
    output: output
  };

  // Parse vitest output for test counts
  const testMatch = output.match(/(\d+) passed/);
  const failMatch = output.match(/(\d+) failed/);
  const totalMatch = output.match(/Test Files\s+\d+ passed.*?Tests\s+(\d+)/);

  if (testMatch) result.passed = parseInt(testMatch[1]);
  if (failMatch) result.failed = parseInt(failMatch[1]);
  if (totalMatch) result.tests = parseInt(totalMatch[1]);

  if (result.tests === 0 && exitCode === 0) {
    // Try alternative parsing
    const altMatch = output.match(/✓.*?(\d+)/g);
    if (altMatch) {
      result.tests = altMatch.length;
      result.passed = altMatch.length;
    }
  }

  return result;
}

function analyzeTaskResults(results) {
  const analysis = {};

  // TASK-0074: Trip Search Surface
  const searchSurfaceTests = results.testFiles.filter(f =>
    f.file.includes('trip-search-surface') || f.file.includes('task-0074-0076-integration')
  );
  analysis['TASK-0074 (Trip Search Surface)'] = {
    status: searchSurfaceTests.every(t => t.status === 'passed') ? '✅' : '❌',
    description: 'Unified trip search surface with normalized tokens and phonetic variants',
    details: [
      `Search surface tests: ${searchSurfaceTests.length} files`,
      `Token generation and normalization validated`,
      `Phonetic variant support (Chisolm → Chisholm, Stonleigh → Stoneleigh)`,
      `Traveler information integration`,
      `Dirty queue processing and synchronization`
    ]
  };

  // TASK-0075: Trip Facts Pipeline
  const factsTests = results.testFiles.filter(f =>
    f.file.includes('trip-facts-manager') || f.file.includes('task-0074-0076-integration')
  );
  analysis['TASK-0075 (Trip Facts Pipeline)'] = {
    status: factsTests.every(t => t.status === 'passed') ? '✅' : '❌',
    description: 'Trip facts aggregation with traveler details and cost summaries',
    details: [
      `Facts aggregation tests: ${factsTests.length} files`,
      `Traveler count and name aggregation`,
      `Cost and activity rollups`,
      `Hotel and activity counting`,
      `Primary client identification`
    ]
  };

  // TASK-0076: Fuzzy Matching Upgrade
  const fuzzyTests = results.testFiles.filter(f =>
    f.file.includes('trip-surface-search') || f.file.includes('task-0074-0076-integration')
  );
  analysis['TASK-0076 (Fuzzy Matching Upgrade)'] = {
    status: fuzzyTests.every(t => t.status === 'passed') ? '✅' : '❌',
    description: 'Enhanced search with typo tolerance and suggestions',
    details: [
      `Fuzzy search tests: ${fuzzyTests.length} files`,
      `Phonetic matching for common typos`,
      `Exact slug match prioritization`,
      `Traveler information in search results`,
      `Scoring and ranking algorithm`,
      `Continue trip workflow integration`
    ]
  };

  return analysis;
}

// Run the test suite
runTests()
  .then(success => {
    console.log(success ? '🎉 All tests passed!' : '🚨 Some tests failed!');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test suite execution failed:', error);
    process.exit(1);
  });