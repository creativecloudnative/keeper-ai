import { z } from 'zod';

const HealthCheckSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: z.string(),
  endpoints: z
    .array(z.object({ path: z.string(), expected_status: z.number().default(200) }))
    .default([{ path: '/', expected_status: 200 }]),
});

const DependencyCheckSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: z.string(),
  pr_strategy: z.enum(['grouped', 'per_package']).default('grouped'),
  ignore: z.array(z.string()).default([]),
});

const SecurityCheckSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: z.string(),
  severity_threshold: z.enum(['low', 'moderate', 'high', 'critical']).default('moderate'),
});

const PRConfigSchema = z.object({
  base_branch: z.string().default('main'),
  labels: z.array(z.string()).default(['keeper-ai']),
  draft: z.boolean().default(false),
});

export const ServiceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  repo: z.string(),
  runtime: z.enum(['nodejs', 'python', 'go', 'other']).default('nodejs'),
  deployment: z.object({
    platform: z.enum(['vercel', 'fly', 'railway', 'other']),
    url: z.string().url().optional(),
  }),
  checks: z
    .object({
      health: HealthCheckSchema.optional(),
      dependencies: DependencyCheckSchema.optional(),
      security: SecurityCheckSchema.optional(),
    })
    .default({}),
  pr: PRConfigSchema.default({}),
});

export const KeeperConfigSchema = z.object({
  services: z.array(ServiceConfigSchema),
});

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export type KeeperConfig = z.infer<typeof KeeperConfigSchema>;
