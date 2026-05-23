import amqplib from "amqplib";

export async function createConnection() {
  const url = process.env.RABBITMQ_URL ?? "amqp://localhost";
  return amqplib.connect(url);
}

export async function createChannel() {
  const connection = await createConnection();
  return connection.createChannel();
}

/**
 * Opens a connection, asserts the queue, publishes one message, then closes.
 * Intended for fire-and-forget publishers (e.g. API routes).
 * Callers should wrap in try/catch — this throws on any RabbitMQ error.
 */
export async function publishMessage(queueName: string, data: unknown): Promise<void> {
  const connection = await createConnection();
  const channel = await connection.createChannel();
  try {
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(
      queueName,
      Buffer.from(JSON.stringify(data)),
      { persistent: true },
    );
  } finally {
    try { await channel.close(); } catch { /* ignore */ }
    try { await connection.close(); } catch { /* ignore */ }
  }
}
