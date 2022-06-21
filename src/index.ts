// configure the .env before all
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import http from 'http';

import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import ArLocal from 'arlocal';

import httpStatus from 'http-status';

import { ApiError, errorConverter, errorHandler } from './middlewares/error';
import morgan from './middlewares/morgan';

import routes from './routes';

(async () => {
    const arLocal = new ArLocal();

    // start arweave server
    await arLocal.start();

    // create a new express application instance
    const app = express();

    app.use(morgan.successHandler);
    app.use(morgan.errorHandler);

    // set security HTTP headers
    app.use(helmet());

    // parse urlencoded request body
    app.use(express.urlencoded({ extended: true }));

    // parse json request body
    app.use(express.json());

    // gzip compression
    app.use(compression());

    // default route
    app.get('/', (_, res) => res.send('Welcome to DEL20 API'));

    // set all routes from routes folder
    app.use('/', routes);

    // send back a 404 error for any unknown api request
    app.use((req, res, next) => {
        next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
    });

    // convert error to ApiError, if needed
    app.use(errorConverter);

    // handle error
    app.use(errorHandler);

    // set event as static files
    app.use(express.static('events'));
    app.use(express.static('wallets'));

    // Listen http port
    const httpServer = http.createServer(app);

    httpServer.listen(process.env.PORT, () => {
        console.log(`Server started on port ${process.env.PORT}`);
    });

    httpServer.on('close', async () => {
        await arLocal.stop();
    });
})();
