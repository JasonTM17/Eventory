import net from 'node:net';

const services = [
  {
    name: 'PostgreSQL',
    host: process.env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
  },
  {
    name: 'Redis',
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
  },
  {
    name: 'Mailpit SMTP',
    host: process.env.MAILPIT_HOST ?? '127.0.0.1',
    port: Number(process.env.MAILPIT_SMTP_PORT ?? 1025),
  },
];

function probe({ host, port }, timeoutMs = 1_500) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (healthy) => {
      socket.destroy();
      resolve(healthy);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function checkOnce() {
  const results = await Promise.all(
    services.map(async (service) => ({ ...service, healthy: await probe(service) })),
  );

  for (const { name, host, port, healthy } of results) {
    console.log(`${healthy ? 'OK' : 'WAIT'} ${name} ${host}:${port}`);
  }

  return results.every(({ healthy }) => healthy);
}

const shouldWait = process.argv.includes('--wait');
const retries = Number(process.env.DEPENDENCY_RETRIES ?? 30);

for (let attempt = 1; attempt <= (shouldWait ? retries : 1); attempt += 1) {
  if (await checkOnce()) process.exit(0);
  if (shouldWait && attempt < retries) await new Promise((resolve) => setTimeout(resolve, 2_000));
}

console.error(
  'Dependencies are unavailable. Start them with: docker compose up -d postgres redis mailpit',
);
process.exit(1);
