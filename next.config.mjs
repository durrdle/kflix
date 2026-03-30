import { execSync } from 'node:child_process';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_HASH: execSync('git rev-parse --short HEAD')
      .toString()
      .trim(),
    NEXT_PUBLIC_GITHUB_REPO: 'https://github.com/durrdle/kflix',
  },
};

export default nextConfig;