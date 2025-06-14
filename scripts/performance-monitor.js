#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const logger = require('./utils/logger');

/**
 * Performance monitoring and reporting system
 */
class PerformanceMonitor {
  constructor() {
    this.metricsFile = path.join(process.cwd(), '.performance-metrics.json');
    this.metrics = this.loadMetrics();
  }

  loadMetrics() {
    try {
      if (fs.existsSync(this.metricsFile)) {
        return fs.readJsonSync(this.metricsFile);
      }
    } catch (error) {
      logger.warn('Failed to load performance metrics, starting fresh', error);
    }
    
    return {
      version: '1.0',
      builds: [],
      syncs: [],
      summary: {
        totalBuilds: 0,
        totalSyncs: 0,
        averageBuildTime: 0,
        averageSyncTime: 0,
        lastUpdated: null
      }
    };
  }

  saveMetrics() {
    try {
      fs.writeJsonSync(this.metricsFile, this.metrics, { spaces: 2 });
    } catch (error) {
      logger.warn('Failed to save performance metrics', error);
    }
  }

  /**
   * Record a build performance metric
   */
  recordBuild(buildData) {
    const buildMetric = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      duration: buildData.performance?.totalTime || 0,
      pagesGenerated: buildData.performance?.pagesGenerated || 0,
      filesSkipped: buildData.performance?.filesSkipped || 0,
      cacheHitRate: buildData.performance?.cacheHitRate || 0,
      totalPages: buildData.totalPages || 0,
      publishedPosts: buildData.publishedPosts || 0,
      scheduledPosts: buildData.scheduledPosts || 0,
      memoryUsage: this.getCurrentMemoryUsage()
    };

    this.metrics.builds.push(buildMetric);
    
    // Keep only last 50 builds
    if (this.metrics.builds.length > 50) {
      this.metrics.builds = this.metrics.builds.slice(-50);
    }

    this.updateSummary();
    this.saveMetrics();

    logger.info('📊 Build performance recorded');
    return buildMetric;
  }

  /**
   * Record a sync performance metric
   */
  recordSync(syncData) {
    const syncMetric = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      duration: syncData.performance?.total_sync || 0,
      totalPosts: syncData.totalPosts || 0,
      published: syncData.published || 0,
      scheduled: syncData.scheduled || 0,
      drafts: syncData.drafts || 0,
      fetchTime: syncData.performance?.fetch_posts || 0,
      processTime: syncData.performance?.process_posts || 0,
      indexTime: syncData.performance?.generate_indexes || 0,
      memoryUsage: this.getCurrentMemoryUsage()
    };

    this.metrics.syncs.push(syncMetric);
    
    // Keep only last 50 syncs
    if (this.metrics.syncs.length > 50) {
      this.metrics.syncs = this.metrics.syncs.slice(-50);
    }

    this.updateSummary();
    this.saveMetrics();

    logger.info('📊 Sync performance recorded');
    return syncMetric;
  }

  /**
   * Update summary statistics
   */
  updateSummary() {
    const builds = this.metrics.builds;
    const syncs = this.metrics.syncs;

    this.metrics.summary = {
      totalBuilds: builds.length,
      totalSyncs: syncs.length,
      averageBuildTime: builds.length > 0 
        ? Math.round(builds.reduce((sum, b) => sum + b.duration, 0) / builds.length)
        : 0,
      averageSyncTime: syncs.length > 0
        ? Math.round(syncs.reduce((sum, s) => sum + s.duration, 0) / syncs.length)
        : 0,
      lastBuildTime: builds.length > 0 ? builds[builds.length - 1].duration : 0,
      lastSyncTime: syncs.length > 0 ? syncs[syncs.length - 1].duration : 0,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get current memory usage
   */
  getCurrentMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024) // MB
    };
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const summary = this.metrics.summary;
    const recentBuilds = this.metrics.builds.slice(-10);
    const recentSyncs = this.metrics.syncs.slice(-10);

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        ...summary,
        performanceGrade: this.calculatePerformanceGrade()
      },
      trends: {
        buildTrend: this.calculateTrend(recentBuilds.map(b => b.duration)),
        syncTrend: this.calculateTrend(recentSyncs.map(s => s.duration)),
        cacheEfficiency: this.calculateCacheEfficiency(recentBuilds)
      },
      recommendations: this.generateRecommendations(),
      recentMetrics: {
        builds: recentBuilds,
        syncs: recentSyncs
      }
    };

    return report;
  }

  /**
   * Calculate overall performance grade
   */
  calculatePerformanceGrade() {
    const { averageBuildTime, averageSyncTime } = this.metrics.summary;
    
    let score = 100;
    
    // Deduct points for slow builds (target: < 90s)
    if (averageBuildTime > 90000) {
      score -= Math.min(30, (averageBuildTime - 90000) / 1000);
    }
    
    // Deduct points for slow syncs (target: < 15s)
    if (averageSyncTime > 15000) {
      score -= Math.min(30, (averageSyncTime - 15000) / 1000);
    }
    
    // Grade based on score
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Calculate performance trend
   */
  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5);
    const older = values.slice(-10, -5);
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 10) return 'degrading';
    if (change < -10) return 'improving';
    return 'stable';
  }

  /**
   * Calculate cache efficiency
   */
  calculateCacheEfficiency(builds) {
    if (builds.length === 0) return 0;
    
    const totalCacheHitRate = builds.reduce((sum, b) => sum + (b.cacheHitRate || 0), 0);
    return Math.round(totalCacheHitRate / builds.length);
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const { averageBuildTime, averageSyncTime } = this.metrics.summary;
    const recentBuilds = this.metrics.builds.slice(-5);
    
    // Build time recommendations
    if (averageBuildTime > 90000) {
      recommendations.push({
        type: 'build_performance',
        priority: 'high',
        message: `Average build time (${Math.round(averageBuildTime/1000)}s) exceeds target (90s)`,
        suggestions: [
          'Enable incremental builds',
          'Optimize template compilation',
          'Reduce concurrent operations'
        ]
      });
    }
    
    // Sync time recommendations
    if (averageSyncTime > 15000) {
      recommendations.push({
        type: 'sync_performance',
        priority: 'high',
        message: `Average sync time (${Math.round(averageSyncTime/1000)}s) exceeds target (15s)`,
        suggestions: [
          'Increase concurrency level',
          'Implement better caching',
          'Optimize API calls'
        ]
      });
    }
    
    // Cache efficiency recommendations
    const avgCacheHitRate = this.calculateCacheEfficiency(recentBuilds);
    if (avgCacheHitRate < 50) {
      recommendations.push({
        type: 'cache_efficiency',
        priority: 'medium',
        message: `Cache hit rate (${avgCacheHitRate}%) is low`,
        suggestions: [
          'Review cache invalidation logic',
          'Increase cache size',
          'Optimize dependency tracking'
        ]
      });
    }
    
    // Memory usage recommendations
    const recentMemoryUsage = recentBuilds.map(b => b.memoryUsage?.heapUsed || 0);
    const avgMemoryUsage = recentMemoryUsage.reduce((sum, m) => sum + m, 0) / recentMemoryUsage.length;
    
    if (avgMemoryUsage > 200) {
      recommendations.push({
        type: 'memory_usage',
        priority: 'medium',
        message: `Average memory usage (${Math.round(avgMemoryUsage)}MB) is high`,
        suggestions: [
          'Implement memory cleanup',
          'Reduce batch sizes',
          'Optimize data structures'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Print performance report to console
   */
  printReport() {
    const report = this.generateReport();
    
    logger.section('📊 Performance Report');
    
    // Summary
    logger.info('📈 Summary:');
    logger.info(`   Performance Grade: ${report.summary.performanceGrade}`);
    logger.info(`   Total Builds: ${report.summary.totalBuilds}`);
    logger.info(`   Total Syncs: ${report.summary.totalSyncs}`);
    logger.info(`   Average Build Time: ${Math.round(report.summary.averageBuildTime/1000)}s`);
    logger.info(`   Average Sync Time: ${Math.round(report.summary.averageSyncTime/1000)}s`);
    logger.info(`   Last Build Time: ${Math.round(report.summary.lastBuildTime/1000)}s`);
    logger.info(`   Last Sync Time: ${Math.round(report.summary.lastSyncTime/1000)}s`);
    
    // Trends
    logger.info('📊 Trends:');
    logger.info(`   Build Performance: ${report.trends.buildTrend}`);
    logger.info(`   Sync Performance: ${report.trends.syncTrend}`);
    logger.info(`   Cache Efficiency: ${report.trends.cacheEfficiency}%`);
    
    // Recommendations
    if (report.recommendations.length > 0) {
      logger.info('💡 Recommendations:');
      report.recommendations.forEach(rec => {
        logger.info(`   [${rec.priority.toUpperCase()}] ${rec.message}`);
        rec.suggestions.forEach(suggestion => {
          logger.info(`     • ${suggestion}`);
        });
      });
    } else {
      logger.success('✅ No performance issues detected');
    }
    
    return report;
  }

  /**
   * Export metrics to JSON file
   */
  exportMetrics(outputPath) {
    const report = this.generateReport();
    const exportPath = outputPath || path.join(process.cwd(), 'performance-report.json');
    
    fs.writeJsonSync(exportPath, report, { spaces: 2 });
    logger.success(`Performance report exported to: ${exportPath}`);
    
    return exportPath;
  }

  /**
   * Clear old metrics
   */
  clearMetrics() {
    this.metrics = {
      version: '1.0',
      builds: [],
      syncs: [],
      summary: {
        totalBuilds: 0,
        totalSyncs: 0,
        averageBuildTime: 0,
        averageSyncTime: 0,
        lastUpdated: null
      }
    };
    
    this.saveMetrics();
    logger.success('Performance metrics cleared');
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const monitor = new PerformanceMonitor();
  
  switch (args[0]) {
    case 'report':
      monitor.printReport();
      break;
      
    case 'export':
      monitor.exportMetrics(args[1]);
      break;
      
    case 'clear':
      monitor.clearMetrics();
      break;
      
    case 'help':
    default:
      console.log(`
Performance Monitor Usage:

  npm run perf-monitor report    Show performance report
  npm run perf-monitor export    Export metrics to JSON
  npm run perf-monitor clear     Clear all metrics
  npm run perf-monitor help      Show this help

Examples:
  npm run perf-monitor report
  npm run perf-monitor export ./reports/perf-report.json
      `);
      break;
  }
}

// Export for use in other scripts
module.exports = PerformanceMonitor;

// Run CLI if called directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Performance monitor failed', error);
    process.exit(1);
  });
} 