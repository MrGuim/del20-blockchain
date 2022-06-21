import Joi from 'joi';

export const getEvent = {
    query: Joi.object().keys({
        publicKey: Joi.string().required().min(3)
    })
};

export const empty = {};

export const createEvent = {
    body: Joi.object().keys({
        name: Joi.string().required().min(3).max(255),
        maxAttendees: Joi.number().required()
    })
};
