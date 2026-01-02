import { spawn } from 'child_process';
import path from 'path';

async function buildImage() {
  return new Promise((resolve, reject) => {
    console.log('\n🏗️  Building workspace Docker image once for all tests...\n');

    const buildContext = path.join(process.cwd(), 'workspace');
    const proc = spawn('docker', ['build', '-t', 'workspace:latest', buildContext], {
      stdio: 'inherit',
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Workspace Docker image built successfully\n');
        resolve();
      } else {
        reject(new Error(`Docker build failed with exit code ${code}`));
      }
    });
  });
}

export async function setup() {
  await buildImage();
}

export async function teardown() {
  console.log('\n🧹 Test suite completed\n');
}
