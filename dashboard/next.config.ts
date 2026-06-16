import type { NextConfig } from 'next';
import { execSync } from 'child_process';

function getGitSha(): string {
  // VERCEL_GIT_COMMIT_SHA: set automatically when project is connected to GitHub
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
  // NEXT_PUBLIC_GIT_SHA: manually set in Vercel env vars for CLI deploys — don't override it
  if (process.env.NEXT_PUBLIC_GIT_SHA) {
    return process.env.NEXT_PUBLIC_GIT_SHA;
  }
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

const config: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: getGitSha(),
  },
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: 'http://localhost:3001/:path*',
      },
    ];
  },
};

export default config;
