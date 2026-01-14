const AGENT_URL = 'http://localhost:7391';

async function ensureTestWorkspace() {
  const listResponse = await fetch(`${AGENT_URL}/rpc/workspaces/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!listResponse.ok) {
    throw new Error(`Failed to list workspaces: ${listResponse.status}`);
  }

  const listResult = await listResponse.json();
  const workspaces = listResult.json || [];

  const testWorkspaceExists = workspaces.some(
    (ws: { name: string }) => ws.name === 'test'
  );

  if (!testWorkspaceExists) {
    console.log('Creating "test" workspace for e2e tests...');

    const createResponse = await fetch(`${AGENT_URL}/rpc/workspaces/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { name: 'test' } }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create test workspace: ${createResponse.status} - ${errorText}`);
    }

    console.log('Created "test" workspace');

    const startResponse = await fetch(`${AGENT_URL}/rpc/workspaces/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: { name: 'test' } }),
    });

    if (!startResponse.ok) {
      const errorText = await startResponse.text();
      throw new Error(`Failed to start test workspace: ${startResponse.status} - ${errorText}`);
    }

    console.log('Started "test" workspace');

    await new Promise((resolve) => setTimeout(resolve, 5000));
  } else {
    const ws = workspaces.find((ws: { name: string }) => ws.name === 'test');
    if (ws && ws.status !== 'running') {
      console.log('Starting "test" workspace...');

      const startResponse = await fetch(`${AGENT_URL}/rpc/workspaces/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { name: 'test' } }),
      });

      if (!startResponse.ok) {
        const errorText = await startResponse.text();
        throw new Error(`Failed to start test workspace: ${startResponse.status} - ${errorText}`);
      }

      console.log('Started "test" workspace');

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

export default async function globalSetup() {
  try {
    await ensureTestWorkspace();
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  }
}
