import { store } from '../../store';
import { logger } from '../../shared/logger';
import type { Severity } from '../../shared/types';

export interface CreateIncidentParams {
  serviceId: string;
  title: string;
  description: string;
  severity: Severity;
  metadata?: Record<string, unknown>;
}

export async function createIncident(params: CreateIncidentParams) {
  const incident = store.createIncident(params);
  logger.info({ incidentId: incident.id, serviceId: params.serviceId }, 'Incident created');
  return incident;
}

export async function resolveIncident(id: string) {
  store.resolveIncident(id);
  logger.info({ incidentId: id }, 'Incident resolved');
}

export async function getOpenIncidents(serviceId: string) {
  return store.getOpenIncidents(serviceId);
}
