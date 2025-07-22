export class ProgressTracker {
  constructor() {
    this.jobs = new Map();
    this.maxJobHistory = 100; // Keep last 100 jobs
  }

  /**
   * Initialize a new render job
   */
  initializeJob(renderId, jobData) {
    const job = {
      renderId,
      status: 'processing',
      progress: 0,
      startTime: Date.now(),
      currentStep: 'Initializing',
      ...jobData
    };

    this.jobs.set(renderId, job);
    console.log(`📊 Job initialized: ${renderId}`);
    
    // Clean up old jobs if we have too many
    this.cleanupOldJobs();
    
    return job;
  }

  /**
   * Update job progress and status
   */
  updateJob(renderId, updates) {
    const job = this.jobs.get(renderId);
    
    if (!job) {
      console.warn(`⚠️ Job not found for update: ${renderId}`);
      return null;
    }

    // Update job data
    const updatedJob = {
      ...job,
      ...updates,
      lastUpdated: Date.now()
    };

    this.jobs.set(renderId, updatedJob);

    // Log progress updates
    if (updates.progress !== undefined) {
      console.log(`📈 Job ${renderId}: ${updates.progress}% - ${updates.currentStep || job.currentStep}`);
    }

    if (updates.status) {
      console.log(`🔄 Job ${renderId} status: ${updates.status}`);
    }

    return updatedJob;
  }

  /**
   * Get job information
   */
  getJob(renderId) {
    return this.jobs.get(renderId) || null;
  }

  /**
   * Get all jobs (for debugging)
   */
  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status) {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  /**
   * Mark job as completed
   */
  completeJob(renderId, outputData = {}) {
    const job = this.jobs.get(renderId);
    
    if (!job) {
      console.warn(`⚠️ Job not found for completion: ${renderId}`);
      return null;
    }

    const completedJob = {
      ...job,
      status: 'completed',
      progress: 100,
      currentStep: 'Completed',
      completedAt: Date.now(),
      duration: Date.now() - job.startTime,
      ...outputData
    };

    this.jobs.set(renderId, completedJob);
    console.log(`✅ Job completed: ${renderId} (${this.formatDuration(completedJob.duration)})`);
    
    return completedJob;
  }

  /**
   * Mark job as failed
   */
  failJob(renderId, error) {
    const job = this.jobs.get(renderId);
    
    if (!job) {
      console.warn(`⚠️ Job not found for failure: ${renderId}`);
      return null;
    }

    const failedJob = {
      ...job,
      status: 'failed',
      currentStep: 'Failed',
      error: error.message || error,
      failedAt: Date.now(),
      duration: Date.now() - job.startTime
    };

    this.jobs.set(renderId, failedJob);
    console.log(`❌ Job failed: ${renderId} - ${failedJob.error}`);
    
    return failedJob;
  }

  /**
   * Cancel a job
   */
  cancelJob(renderId, reason = 'User cancelled') {
    const job = this.jobs.get(renderId);
    
    if (!job) {
      console.warn(`⚠️ Job not found for cancellation: ${renderId}`);
      return null;
    }

    const cancelledJob = {
      ...job,
      status: 'cancelled',
      currentStep: 'Cancelled',
      cancelReason: reason,
      cancelledAt: Date.now(),
      duration: Date.now() - job.startTime
    };

    this.jobs.set(renderId, cancelledJob);
    console.log(`🚫 Job cancelled: ${renderId} - ${reason}`);
    
    return cancelledJob;
  }

  /**
   * Get job statistics
   */
  getJobStats() {
    const jobs = Array.from(this.jobs.values());
    
    const stats = {
      total: jobs.length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      cancelled: jobs.filter(j => j.status === 'cancelled').length
    };

    // Calculate average completion time
    const completedJobs = jobs.filter(j => j.status === 'completed' && j.duration);
    if (completedJobs.length > 0) {
      stats.averageCompletionTime = completedJobs.reduce((sum, job) => sum + job.duration, 0) / completedJobs.length;
      stats.averageCompletionTimeFormatted = this.formatDuration(stats.averageCompletionTime);
    }

    // Success rate
    const finishedJobs = jobs.filter(j => ['completed', 'failed', 'cancelled'].includes(j.status));
    if (finishedJobs.length > 0) {
      stats.successRate = (stats.completed / finishedJobs.length * 100).toFixed(1) + '%';
    }

    return stats;
  }

  /**
   * Get recent job activity
   */
  getRecentActivity(limit = 10) {
    const jobs = Array.from(this.jobs.values())
      .sort((a, b) => (b.lastUpdated || b.startTime) - (a.lastUpdated || a.startTime))
      .slice(0, limit);

    return jobs.map(job => ({
      renderId: job.renderId,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      startTime: job.startTime,
      lastUpdated: job.lastUpdated,
      duration: job.duration || (Date.now() - job.startTime)
    }));
  }

  /**
   * Clean up old completed jobs
   */
  cleanupOldJobs() {
    if (this.jobs.size <= this.maxJobHistory) {
      return;
    }

    const jobs = Array.from(this.jobs.entries())
      .sort(([, a], [, b]) => (b.lastUpdated || b.startTime) - (a.lastUpdated || a.startTime));

    // Keep only the most recent jobs
    const jobsToKeep = jobs.slice(0, this.maxJobHistory);
    const jobsToRemove = jobs.slice(this.maxJobHistory);

    // Clear old jobs
    this.jobs.clear();
    
    // Add back the jobs to keep
    jobsToKeep.forEach(([renderId, job]) => {
      this.jobs.set(renderId, job);
    });

    if (jobsToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${jobsToRemove.length} old jobs`);
    }
  }

  /**
   * Remove specific job
   */
  removeJob(renderId) {
    const removed = this.jobs.delete(renderId);
    if (removed) {
      console.log(`🗑️ Removed job: ${renderId}`);
    }
    return removed;
  }

  /**
   * Clear all jobs
   */
  clearAllJobs() {
    const count = this.jobs.size;
    this.jobs.clear();
    console.log(`🧹 Cleared ${count} jobs`);
  }

  /**
   * Format duration in human readable format
   */
  formatDuration(milliseconds) {
    if (!milliseconds) return '0s';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get job progress percentage as string
   */
  getProgressString(renderId) {
    const job = this.jobs.get(renderId);
    if (!job) return 'Unknown';
    
    return `${job.progress}% - ${job.currentStep}`;
  }

  /**
   * Check if job is still active
   */
  isJobActive(renderId) {
    const job = this.jobs.get(renderId);
    return job && job.status === 'processing';
  }

  /**
   * Get estimated time remaining
   */
  getEstimatedTimeRemaining(renderId) {
    const job = this.jobs.get(renderId);
    if (!job || job.status !== 'processing' || job.progress <= 0) {
      return null;
    }

    const elapsed = Date.now() - job.startTime;
    const progressRatio = job.progress / 100;
    const estimatedTotal = elapsed / progressRatio;
    const remaining = estimatedTotal - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * Export job data for debugging
   */
  exportJobData(renderId) {
    const job = this.jobs.get(renderId);
    if (!job) return null;

    return {
      ...job,
      formattedDuration: this.formatDuration(job.duration || (Date.now() - job.startTime)),
      estimatedTimeRemaining: this.getEstimatedTimeRemaining(renderId)
    };
  }

  /**
   * Get system health based on job performance
   */
  getSystemHealth() {
    const stats = this.getJobStats();
    const recentJobs = this.getRecentActivity(20);
    
    let health = 'good';
    const issues = [];

    // Check for high failure rate
    if (stats.successRate && parseFloat(stats.successRate) < 80) {
      health = 'warning';
      issues.push('High failure rate');
    }

    // Check for stuck jobs
    const stuckJobs = recentJobs.filter(job => 
      job.status === 'processing' && 
      (Date.now() - job.startTime) > 300000 // 5 minutes
    );

    if (stuckJobs.length > 0) {
      health = 'warning';
      issues.push(`${stuckJobs.length} jobs running over 5 minutes`);
    }

    // Check for too many concurrent jobs
    if (stats.processing > 5) {
      health = 'warning';
      issues.push('High number of concurrent jobs');
    }

    return {
      status: health,
      issues,
      stats,
      timestamp: Date.now()
    };
  }
}
