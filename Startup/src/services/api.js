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

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = () => {
  refreshSubscribers.forEach((cb) => cb());
  refreshSubscribers = [];
};

const onRefreshFailed = (err) => {
  refreshSubscribers.forEach((cb) => cb(err));
  refreshSubscribers = [];
};

const apiRequest = async (endpoint, options = {}) => {
  const { timeout = 60000, ...fetchOptions } = options

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
      if (response.status === 401 && !endpoint.includes('/auth/refresh-token') && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/logout')) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            subscribeTokenRefresh((err) => {
              if (err) {
                reject(err);
              } else {
                resolve(apiRequest(endpoint, options));
              }
            });
          });
        }

        isRefreshing = true;

        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
            method: 'POST',
            credentials: 'include',
          });
          
          if (refreshResponse.ok) {
            isRefreshing = false;
            onRefreshed();
            return await apiRequest(endpoint, options);
          } else {
            isRefreshing = false;
            const err = new ApiError('Session expired. Please log in again.', 401);
            onRefreshFailed(err);
            throw err;
          }
        } catch (refreshError) {
          isRefreshing = false;
          onRefreshFailed(refreshError);
          throw refreshError;
        }
      }

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

// Admin User Management endpoints
export const getAdminUsers = async (params) => {
  const cleanParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  return await api.get(`/admin/users?${query}`);
};

export const getAdminUserDetails = async (id) => {
  return await api.get(`/admin/users/${id}`);
};

export const updateAdminUserStatus = async (id, isActive) => {
  return await api.patch(`/admin/users/${id}/status`, { isActive });
};

export const updateAdminUserVerify = async (id, isVerified) => {
  return await api.patch(`/admin/users/${id}/verify`, { isVerified });
};

export const updateAdminUserRole = async (id, role) => {
  return await api.patch(`/admin/users/${id}/role`, { role });
};

export const adminBulkAction = async (userIds, action) => {
  return await api.post('/admin/users/bulk-action', { userIds, action });
};

export const getAdminAnalytics = async (params) => {
  const cleanParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  return await api.get(`/admin/analytics/overview?${query}`);
};

export const getAdminReportData = async (params) => {
  const cleanParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  return await api.get(`/admin/reports/data?${query}`);
};

export const getAdminNotifications = async (params) => {
  const cleanParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  return await api.get(`/admin/notifications?${query}`);
};

export const getAdminNotificationStats = async () => {
  return await api.get('/admin/notifications/stats');
};

export const getAdminNotificationById = async (id) => {
  return await api.get(`/admin/notifications/${id}`);
};

export const markAdminNotificationRead = async (id) => {
  return await api.patch(`/admin/notifications/read/${id}`);
};

export const markAdminNotificationUnread = async (id) => {
  return await api.patch(`/admin/notifications/unread/${id}`);
};

export const markAllAdminNotificationsRead = async () => {
  return await api.patch('/admin/notifications/read-all');
};

export const deleteAdminNotification = async (id) => {
  return await api.delete(`/admin/notifications/${id}`);
};

export const broadcastAdminAnnouncement = async (data) => {
  return await api.post('/admin/notifications/broadcast', data);
};

export const getAdminSettingsConfig = async () => {
  return await api.get('/admin/settings/config');
};

export const getAdminActivityLogs = async (params) => {
  const cleanParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  return await api.get(`/admin/logs/activity?${query}`);
};

export const getAdminLoginLogs = async (params) => {
  const cleanParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  return await api.get(`/admin/logs/logins?${query}`);
};

export const getAdminActiveSessions = async (params) => {
  const cleanParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  return await api.get(`/admin/logs/sessions?${query}`);
};

export const getAdminLogsExportUrl = (params) => {
  const cleanParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  return `${API_BASE_URL}/admin/logs/export?${query}`;
};

export const getStudySessions = async (params = {}) => {
  const cleanParams = {};
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      cleanParams[key] = params[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  return await api.get(`/study?${query}`);
};

export const createStudySession = async (data) => {
  return await api.post('/study', data);
};

export const updateStudySession = async (id, data) => {
  return await api.patch(`/study/${id}`, data);
};

export const deleteStudySession = async (id) => {
  return await api.delete(`/study/${id}`);
};

export const getStudyActivities = async () => {
  return await api.get('/study/activity');
};

export const getAIConversations = async (studySessionId, resourceId) => {
  const query = resourceId
    ? `studySessionId=${studySessionId}&resourceId=${encodeURIComponent(resourceId)}`
    : `studySessionId=${studySessionId}`;
  return await api.get(`/ai/conversations?${query}`);
};

export const createAIConversation = async (data) => {
  return await api.post('/ai/conversations', data);
};

export const updateAIConversation = async (id, data) => {
  return await api.patch(`/ai/conversations/${id}`, data);
};

export const deleteAIConversation = async (id) => {
  return await api.delete(`/ai/conversations/${id}`);
};

export const getAIMessages = async (conversationId) => {
  return await api.get(`/ai/messages?conversationId=${conversationId}`);
};

export const sendAIMessage = async (data) => {
  return await api.post('/ai/messages', data);
};

export const generateSummary = async (sessionId, data = {}) => {
  return await api.post(`/study/${sessionId}/summary`, data);
};

export const getSummary = async (sessionId, resourceType, summaryType = 'quick') => {
  return await api.get(`/study/${sessionId}/summary?resourceType=${resourceType}&summaryType=${summaryType}`);
};

export const fetchYouTubeData = async (sessionId, videoUrl) => {
  return await api.post(`/study/${sessionId}/youtube/fetch`, { videoUrl });
};

export const generateFlashcards = async (data = {}) => {
  return await api.post('/ai/flashcards/generate', data);
};

export const getFlashcards = async (studySessionId, resourceId) => {
  return await api.get(`/ai/flashcards/${encodeURIComponent(resourceId)}?studySessionId=${studySessionId}`);
};

export const updateFlashcardState = async (resourceId, cardId, data = {}) => {
  return await api.patch(`/ai/flashcards/${encodeURIComponent(resourceId)}/cards/${encodeURIComponent(cardId)}`, data);
};

export const generateQuiz = async (data = {}) => {
  return await api.post('/ai/quiz/generate', data);
};

export const getQuiz = async (studySessionId, resourceId) => {
  return await api.get(`/ai/quiz/${encodeURIComponent(resourceId)}?studySessionId=${studySessionId}`);
};

export const updateQuestionState = async (resourceId, questionId, data = {}) => {
  return await api.patch(`/ai/quiz/${encodeURIComponent(resourceId)}/question/${encodeURIComponent(questionId)}`, data);
};

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
