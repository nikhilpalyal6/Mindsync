import { HTTP_STATUS } from '../constants/httpStatus.js';

class ApiResponse {
  constructor(statusCode, data = null, message = 'Success') {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    if (data !== null && data !== undefined) {
      this.data = data;
    }
  }

  static success(data, message = 'Success') {
    return new ApiResponse(HTTP_STATUS.OK, data, message);
  }

  static created(data, message = 'Created successfully') {
    return new ApiResponse(HTTP_STATUS.CREATED, data, message);
  }

  static noContent(message = 'No content') {
    return new ApiResponse(HTTP_STATUS.NO_CONTENT, null, message);
  }

  static paginated(data, pagination, message = 'Success') {
    return new ApiResponse(HTTP_STATUS.OK, { ...data, pagination }, message);
  }
}

export default ApiResponse;
