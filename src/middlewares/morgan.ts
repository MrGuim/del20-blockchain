import morgan from 'morgan';

import logger from './logger';

morgan.token('message', (req, res: any) => res.locals.errorMessage || '');

const getIpFormat = () => (process.env.NODE_ENV === 'production' ? ':remote-addr - ' : '');
const successResponseFormat = `:date - ${getIpFormat()}:method :url :status - :response-time ms`;
const errorResponseFormat = `:date - ${getIpFormat()}:method :url :status - :response-time ms - message: :message`;

const successHandler = morgan(successResponseFormat, {
    skip: (req, res) => res.statusCode >= 400,
    stream: { write: (message) => logger.info(message.trim()) }
});

const errorHandler = morgan(errorResponseFormat, {
    skip: (req, res) => res.statusCode < 400,
    stream: { write: (message) => logger.error(message.trim()) }
});

export default { errorHandler, successHandler };