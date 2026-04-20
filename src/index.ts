import {buildApp} from './app.js';
import {config} from './config.js';
import type {Server} from 'node:http';
import type {AddressInfo} from 'node:net';

const listenOnPort = (app: Awaited<ReturnType<typeof buildApp>>, port: number): Promise<Server> =>
    new Promise((resolve, reject) => {
        const server = app.listen(port);

        const onError = (error: NodeJS.ErrnoException) => {
            server.off('listening', onListening);
            reject(error);
        };

        const onListening = () => {
            server.off('error', onError);
            resolve(server);
        };

        server.once('error', onError);
        server.once('listening', onListening);
    });

const start = async () => {
    const app = await buildApp();
    const preferredPort = config.port;
    const maxPortAttempts = 10;
    let targetPort = preferredPort;
    let server: Server | null = null;

    for (let attempt = 0; attempt < maxPortAttempts; attempt += 1) {
        try {
            server = await listenOnPort(app, targetPort);
            break;
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err.code !== 'EADDRINUSE') {
                throw error;
            }

            targetPort += 1;
            // eslint-disable-next-line no-console
            console.warn(`Port ${targetPort - 1} is busy, trying ${targetPort}`);
        }
    }

    if (!server) {
        throw new Error(`Failed to find free port in range ${preferredPort}-${preferredPort + maxPortAttempts - 1}`);
    }

    const actualPort = (server.address() as AddressInfo | null)?.port ?? preferredPort;
    // eslint-disable-next-line no-console
    console.log(`API listening on port ${actualPort}`);
};

start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server', err);
    process.exit(1);
});
