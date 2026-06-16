import cron from 'node-cron';
import { logger } from '../../shared/logger';
import { loadConfig } from '../../config/loader';
import { store } from '../../store';
import { eventBus } from '../../shared/eventBus';
import { runDependencyAgent } from '../dependency';
import { runSecurityAgent } from '../security';
import { runHealthAgent } from '../health';
import { runRemediation } from '../remediation';
import { runPRAgent } from '../pr';
import type { Signal } from '../../signals/types';
import type { ServiceConfig } from '../../config/schema';
import type { AgentResult, AgentEventCallback, RunEventType, AgentType } from '../../shared/types';

function parseRecommendedAction(summary: string): 'create_pr' | 'no_action' | 'monitor' | null {
  const match = summary.match(/RECOMMENDED_ACTION:\s*(create_pr|no_action|monitor)/);
  return (match?.[1] as 'create_pr' | 'no_action' | 'monitor') ?? null;
}

export class Orchestrator {
  private tasks: cron.ScheduledTask[] = [];

  start() {
    const config = loadConfig();
    logger.info({ services: config.services.map((s) => s.id) }, 'Orchestrator starting');
    for (const service of config.services) this.scheduleForService(service);
    logger.info('Orchestrator started — schedules registered');
  }

  stop() {
    this.tasks.forEach((t) => t.stop());
    this.tasks = [];
    logger.info('Orchestrator stopped');
  }

  async handleSignal(signal: Signal) {
    const config = loadConfig();
    const service = config.services.find((s) => s.id === signal.serviceId);

    if (!service) {
      logger.warn({ serviceId: signal.serviceId }, 'Signal for unknown service — ignored');
      return;
    }

    logger.info({ type: signal.type, serviceId: service.id }, 'Routing signal');

    switch (signal.type) {
      case 'deployment.failed':
        await this.runHealthCheck(service, `signal:${signal.id}`);
        break;
      case 'dependency.vulnerability':
        await this.runSecurityCheck(service, `signal:${signal.id}`);
        break;
      case 'manual.trigger':
        await Promise.all([
          this.runHealthCheck(service, `signal:${signal.id}`),
          this.runDependencyCheck(service, `signal:${signal.id}`),
          this.runSecurityCheck(service, `signal:${signal.id}`),
        ]);
        break;
      default:
        logger.info({ type: signal.type }, 'No handler for signal type');
    }
  }

  private scheduleForService(service: ServiceConfig) {
    const { checks, id } = service;

    if (checks.health?.enabled && checks.health.schedule) {
      this.tasks.push(
        cron.schedule(checks.health.schedule, () => {
          this.runHealthCheck(service, 'cron').catch((err) =>
            logger.error({ err, serviceId: id }, 'Health cron failed')
          );
        })
      );
      logger.info({ serviceId: id, schedule: checks.health.schedule }, 'Health check scheduled');
    }

    if (checks.dependencies?.enabled && checks.dependencies.schedule) {
      this.tasks.push(
        cron.schedule(checks.dependencies.schedule, () => {
          this.runDependencyCheck(service, 'cron').catch((err) =>
            logger.error({ err, serviceId: id }, 'Dependency cron failed')
          );
        })
      );
      logger.info({ serviceId: id, schedule: checks.dependencies.schedule }, 'Dependency check scheduled');
    }

    if (checks.security?.enabled && checks.security.schedule) {
      this.tasks.push(
        cron.schedule(checks.security.schedule, () => {
          this.runSecurityCheck(service, 'cron').catch((err) =>
            logger.error({ err, serviceId: id }, 'Security cron failed')
          );
        })
      );
      logger.info({ serviceId: id, schedule: checks.security.schedule }, 'Security check scheduled');
    }
  }

  private async runWithTracking(
    service: ServiceConfig,
    agentType: AgentType,
    triggeredBy: string,
    fn: (onEvent: AgentEventCallback) => Promise<AgentResult>
  ) {
    const run = store.startRun({ serviceId: service.id, agentType, triggeredBy });
    let seq = 0;

    const onEvent: AgentEventCallback = (type: RunEventType, data: Record<string, unknown>) => {
      const event = store.appendRunEvent({ runId: run.id, type, data, seq: seq++ });
      eventBus.emit('run_event', event);
    };

    try {
      const result = await fn(onEvent);
      store.completeRun(run.id, result);
      onEvent('complete', { summary: result.summary, success: result.success });
      logger.info({ serviceId: service.id, agentType, success: result.success }, 'Run completed');
      return result;
    } catch (err) {
      const result: AgentResult = {
        success: false,
        summary: 'Unhandled error during agent run',
        error: err instanceof Error ? err.message : String(err),
      };
      store.completeRun(run.id, result);
      onEvent('error', { message: result.error ?? 'Unknown error' });
      logger.error({ err, serviceId: service.id, agentType }, 'Run failed');
      return result;
    }
  }

  async triggerCheck(
    serviceId: string,
    checkType: 'health' | 'dependency' | 'security' | 'all',
    triggeredBy = 'chat'
  ) {
    const config = loadConfig();
    const service = config.services.find((s) => s.id === serviceId);
    if (!service) throw new Error(`Service not found: ${serviceId}`);
    const jobs: Promise<AgentResult>[] = [];
    if (checkType === 'health' || checkType === 'all') jobs.push(this.runHealthCheck(service, triggeredBy));
    if (checkType === 'dependency' || checkType === 'all') jobs.push(this.runDependencyCheck(service, triggeredBy));
    if (checkType === 'security' || checkType === 'all') jobs.push(this.runSecurityCheck(service, triggeredBy));
    await Promise.all(jobs);
  }

  private runHealthCheck(service: ServiceConfig, triggeredBy: string) {
    return this.runWithTracking(service, 'health', triggeredBy, (onEvent) =>
      runHealthAgent(service, onEvent)
    );
  }

  private async runDependencyCheck(service: ServiceConfig, triggeredBy: string) {
    const result = await this.runWithTracking(service, 'dependency', triggeredBy, (onEvent) =>
      runDependencyAgent(service, onEvent)
    );

    if (result.success && parseRecommendedAction(result.summary) === 'create_pr') {
      await this.remediateAndPR(service, 'dependency', triggeredBy, result.summary);
    }

    return result;
  }

  private async runSecurityCheck(service: ServiceConfig, triggeredBy: string) {
    const result = await this.runWithTracking(service, 'security', triggeredBy, (onEvent) =>
      runSecurityAgent(service, onEvent)
    );

    if (result.success && parseRecommendedAction(result.summary) === 'create_pr') {
      await this.remediateAndPR(service, 'security', triggeredBy, result.summary);
    }

    return result;
  }

  private async remediateAndPR(
    service: ServiceConfig,
    type: 'dependency' | 'security',
    triggeredBy: string,
    agentSummary: string,
  ) {
    logger.info({ serviceId: service.id, type }, 'Starting remediation');

    let remediation: Awaited<ReturnType<typeof runRemediation>>;
    try {
      remediation = await runRemediation(service, type);
    } catch (err) {
      logger.error({ err, serviceId: service.id, type }, 'Remediation failed — skipping PR');
      return;
    }

    if (!remediation) return;

    const date = new Date().toISOString().slice(0, 10);
    const title = type === 'security'
      ? `security: npm audit fix (${date})`
      : `chore: update npm dependencies (${date})`;

    const body = [
      '## Summary',
      type === 'security'
        ? '`npm audit fix` applied by keeper-ai to address known vulnerabilities.'
        : '`npm update` applied by keeper-ai to update outdated dependencies within semver ranges.',
      '',
      '## Files Changed',
      remediation.changedFiles.map((f) => `- \`${f}\``).join('\n'),
      '',
      '## Agent Analysis',
      '```',
      agentSummary.slice(-2000),
      '```',
      '',
      '---',
      '_Created automatically by keeper-ai_',
    ].join('\n');

    const prResult = await this.runWithTracking(service, 'pr', triggeredBy, (onEvent) =>
      runPRAgent({
        service,
        title,
        body,
        headBranch: remediation!.branchName,
        type: type === 'security' ? 'security' : 'dependency',
        onEvent,
      })
    );

    if (prResult.success && type === 'security') {
      const prUrlMatch = prResult.summary.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/);
      const prUrl = prUrlMatch?.[0] ?? '';
      const openVulns = store.listVulnerabilities({ serviceId: service.id, status: 'open' });
      for (const v of openVulns) {
        store.markVulnerabilityPRCreated(service.id, v.vulnId, prUrl);
      }
      logger.info(
        { serviceId: service.id, prUrl, vulnCount: openVulns.length },
        'Vulnerabilities marked as pr_created',
      );
    }
  }
}
