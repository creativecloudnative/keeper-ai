import Anthropic from '@anthropic-ai/sdk';

export const healthTools: Anthropic.Tool[] = [
  {
    name: 'check_http_endpoint',
    description:
      'Send an HTTP GET to a URL and report status code, response time, and whether it matches the expected status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Full URL to check' },
        expected_status: { type: 'number', description: 'Expected HTTP status code', default: 200 },
        timeout_ms: { type: 'number', description: 'Request timeout in ms', default: 10000 },
      },
      required: ['url'],
    },
  },
];

export async function handleHealthTool(name: string, input: unknown): Promise<unknown> {
  switch (name) {
    case 'check_http_endpoint': {
      const { url, expected_status = 200, timeout_ms = 10_000 } = input as {
        url: string;
        expected_status?: number;
        timeout_ms?: number;
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeout_ms);
      const start = Date.now();

      try {
        const response = await fetch(url, { signal: controller.signal });
        return {
          url,
          status: response.status,
          expected_status,
          healthy: response.status === expected_status,
          response_time_ms: Date.now() - start,
        };
      } catch (err) {
        return {
          url,
          status: null,
          healthy: false,
          response_time_ms: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        clearTimeout(timeout);
      }
    }

    default:
      throw new Error(`Unknown health tool: ${name}`);
  }
}
