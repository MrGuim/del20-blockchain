import httpStatus from 'http-status';

import { RequestHandler } from 'express';

import Joi from 'joi';

import { ApiError } from './error';

/**
 * Create an object composed of the picked object properties
 * @param {Object} object
 * @param {string[]} keys
 * @returns {Object}
 */
const pick = (object: any, keys: string[]) => {
    return keys.reduce((obj: any, key) => {
        if (object && Object.prototype.hasOwnProperty.call(object, key)) {
            obj[key] = object[key];
        }
        return obj;
    }, {});
};

interface Schema {
    body?: Joi.Schema;
    query?: Joi.Schema;
    params?: Joi.Schema;
}

const validate =
    (schema: Schema): RequestHandler =>
    (req, res, next) => {
        const validSchema = pick(schema, ['params', 'query', 'body']);
        const object = pick(req, Object.keys(validSchema));
        const { value, error } = Joi.compile(validSchema)
            .prefs({ errors: { label: 'key' } })
            .validate(object);

        if (error) {
            const errorMessage = error.details.map((details) => details.message).join(', ');
            return next(new ApiError(httpStatus.BAD_REQUEST, errorMessage));
        }
        Object.assign(req, value);
        return next();
    };

export default validate;
