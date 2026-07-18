import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

/**
 * Runs express-validator chains and forwards validation errors.
 */
export const validate = (validations) => async (req, _res, next) => {
  await Promise.all(validations.map((validation) => validation.run(req)));

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return next(
      new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, 'Validation failed', formattedErrors)
    );
  }

  return next();
};

export default validate;
