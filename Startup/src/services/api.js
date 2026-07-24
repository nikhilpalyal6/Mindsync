const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

class ApiError extends Error {
  constructor(message, statusCode, errors = [], retryAfter = null) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.errors = errors
    this.retryAfter = retryAfter
  }
}

const apiRequest = async (endpoint, options = {}) => {
  const { timeout = 10000, ...fetchOptions } = options

  // Check offline status
  if (!navigator.onLine) {
    throw new ApiError('You are offline. Please check your internet connection.', 0)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      signal: controller.signal,
      ...fetchOptions,
    })

    clearTimeout(timeoutId)

    let data;
    try {
      data = await response.json();
    } catch (_jsonError) {
      throw new ApiError('Failed to parse server response.', response.status);
    }

    if (!response.ok) {
      const retryAfter = response.headers.get('Retry-After')
      throw new ApiError(
        data.message || 'Request failed',
        response.status,
        data.errors || [],
        retryAfter ? parseInt(retryAfter, 10) : null
      )
    }

    return data.data
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 408)
    }
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError('Failed to fetch. Please check your connection and try again.', 0)
  }
}

// Authentication endpoints
export const login = async (identifier, password) => {
  return await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
}

export const register = async (name, username, email, password) => {
  return await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, username, email, password }),
  })
}

export const googleLogin = async (idToken) => {
  return await apiRequest('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })
}

export const forgotPassword = async (email) => {
  return await apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export const resetPassword = async (token, newPassword, confirmPassword) => {
  return await apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword, confirmPassword }),
  })
}

export const verifyEmail = async (token) => {
  return await apiRequest('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export const resendVerification = async () => {
  return await apiRequest('/auth/resend-verification', {
    method: 'POST',
  })
}

// Notification Preferences
export const getNotificationPreferences = async () => {
  return await apiRequest('/user/notifications/preferences')
}

export const updateNotificationPreferences = async (preferences) => {
  return await apiRequest('/user/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  })
}

// User Preferences
export const getUserPreferences = async () => {
  return await apiRequest('/user/preferences')
}

export const updateUserPreferences = async (preferences) => {
  return await apiRequest('/user/preferences', {
    method: 'PATCH',
    body: JSON.stringify(preferences),
  })
}

// Recent Activity
export const getRecentActivity = async (page = 1, limit = 20) => {
  return await apiRequest(`/user/activity?page=${page}&limit=${limit}`)
}

// Login History
export const getLoginHistory = async (page = 1, limit = 20) => {
  return await apiRequest(`/user/login-history?page=${page}&limit=${limit}`)
}

export const clearLoginHistory = async () => {
  return await apiRequest('/user/login-history', {
    method: 'DELETE',
  })
}

// Sessions/Devices
export const getActiveSessions = async () => {
  return await apiRequest('/user/sessions')
}

export const logoutDevice = async (sessionId) => {
  return await apiRequest(`/user/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}

export const logoutAllOtherDevices = async () => {
  return await apiRequest('/user/sessions', {
    method: 'DELETE',
  })
}

// General API methods
export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => apiRequest(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  patch: (endpoint, body, options) => apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => apiRequest(endpoint, { method: 'DELETE', ...options }),
}

// Delete Account
export const deleteAccount = async (confirmation) => {
  return await apiRequest('/user/delete-account', {
    method: 'DELETE',
    body: JSON.stringify(confirmation),
  })
}
