const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1'

class ApiError extends Error {
  constructor(message, statusCode, errors = [], retryAfter = null, code = null) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.errors = errors
    this.retryAfter = retryAfter
    this.code = code
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

const inFlightRequests = new Map();

const apiRequest = async (endpoint, options = {}) => {
  const method = options.method || 'GET';
  const isDedupe = (method === 'GET') && (
    endpoint === '/study/activity' ||
    endpoint.startsWith('/mind-maps/workspace/') ||
    endpoint.includes('/summary') ||
    endpoint.startsWith('/ai/quiz/') ||
    endpoint.startsWith('/ai/flashcards/') ||
    endpoint.startsWith('/ai/explain/') ||
    endpoint.startsWith('/knowledge/resource/')
  );

  if (isDedupe) {
    if (inFlightRequests.has(endpoint)) {
      console.log(`[API DEDUPE] Reusing in-flight request for: ${endpoint}`);
      return inFlightRequests.get(endpoint);
    }
  }

  const promise = (async () => {
    try {
      return await apiRequestInternal(endpoint, options);
    } finally {
      if (isDedupe) {
        inFlightRequests.delete(endpoint);
      }
    }
  })();

  if (isDedupe) {
    inFlightRequests.set(endpoint, promise);
  }

  return promise;
};

const apiRequestInternal = async (endpoint, options = {}) => {
  console.log(`[API REQUEST] Outgoing to: ${endpoint}`);
  const { timeout = 60000, ...fetchOptions } = options

  // Check offline status
  if (!navigator.onLine) {
    console.warn('[API REQUEST] Device is offline');
    throw new ApiError('You are offline. Please check your internet connection.', 0)
  }

  try {
    const controller = new AbortController()

    // Chain component signal if provided
    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener('abort', () => {
          controller.abort();
        });
      }
    }

    const timeoutId = setTimeout(() => {
      console.warn(`[API REQUEST] Request to ${endpoint} timed out after ${timeout}ms`);
      controller.abort();
    }, timeout)

    console.log(`[API REQUEST] Fetching ${API_BASE_URL}${endpoint}...`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      headers: {
        ...(fetchOptions.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...fetchOptions.headers,
      },
      signal: controller.signal,
      ...fetchOptions,
    })

    console.log(`[API REQUEST] Response received for ${endpoint}. Status: ${response.status}`);
    clearTimeout(timeoutId)

    let data;
    try {
      data = await response.json();
    } catch (_jsonError) {
      console.error(`[API REQUEST] Failed to parse JSON for ${endpoint}`);
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
      let message = data.message || 'Request failed';
      if (response.status === 429 && (endpoint.includes('/ai/') || endpoint.includes('/mind-maps/') || endpoint.includes('/summary') || endpoint.includes('/youtube/fetch'))) {
        message = 'AI service temporarily unavailable. Your resource is still available.';
      }
      throw new ApiError(
        message,
        response.status,
        data.errors || [],
        retryAfter ? parseInt(retryAfter, 10) : null,
        data.code || null
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

export const getStudySessionById = async (id) => {
  return await api.get(`/study/${encodeURIComponent(id)}`);
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

export const getSummary = async (sessionId, resourceType, summaryType = 'quick', resourceId = '') => {
  const query = `resourceType=${resourceType}&summaryType=${summaryType}${resourceId ? `&resourceId=${encodeURIComponent(resourceId)}` : ''}`;
  return await api.get(`/study/${sessionId}/summary?${query}`);
};

export const fetchYouTubeData = async (sessionId, videoUrl) => {
  return await api.post(`/study/${sessionId}/youtube/fetch`, { videoUrl });
};

export const deleteResource = async (sessionId, resourceId) => {
  return await api.delete(`/study/${sessionId}/resources/${encodeURIComponent(resourceId)}`);
};

export const getResources = async (sessionId) => {
  return await api.get(`/study/${sessionId}/resources`);
};

export const addResource = async (sessionId, data) => {
  return await api.post(`/study/${sessionId}/resources`, data);
};

export const uploadPdfResource = async (sessionId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return await apiRequest(`/study/${sessionId}/resources/upload-pdf`, {
    method: 'POST',
    body: formData
  });
};

export const renameResource = async (sessionId, resourceId, title) => {
  return await api.patch(`/study/${sessionId}/resources/${encodeURIComponent(resourceId)}`, { title });
};

export const replaceResource = async (sessionId, resourceId, data) => {
  return await api.put(`/study/${sessionId}/resources/${encodeURIComponent(resourceId)}/replace`, data);
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

export const generateExplanation = async (data = {}) => {
  return await api.post('/ai/explain', data);
};

export const getExplanations = async (resourceId, studySessionId) => {
  return await api.get(`/ai/explain/${encodeURIComponent(resourceId)}?studySessionId=${studySessionId}`);
};

export const updateExplanationFeedback = async (id, data = {}) => {
  return await api.patch(`/ai/explain/${encodeURIComponent(id)}`, data);
};

export const getPDFChatHistory = async (workspaceId, resourceId) => {
  return await api.get(`/pdf/chat?workspaceId=${encodeURIComponent(workspaceId)}&resourceId=${encodeURIComponent(resourceId)}`);
};

export const sendPDFChatMessage = async (workspaceId, resourceId, message) => {
  return await api.post('/pdf/chat', { workspaceId, resourceId, message });
};

export const createHighlight = async (data = {}) => {
  return await api.post('/highlights', data);
};

export const getHighlights = async (resourceId) => {
  return await api.get(`/highlights/${encodeURIComponent(resourceId)}`);
};

export const deleteHighlight = async (highlightId) => {
  return await api.delete(`/highlights/${encodeURIComponent(highlightId)}`);
};

export const getSmartHighlights = async (resourceId) => {
  return await api.get(`/ai/smart-highlights/${encodeURIComponent(resourceId)}`);
};

export const analyzeSmartHighlightsForPage = async (resourceId, pageNumber, studySessionId) => {
  return await api.post('/ai/smart-highlights/page', { resourceId, pageNumber, studySessionId });
};

export const regenerateSmartHighlightsForPage = async (resourceId, pageNumber, studySessionId) => {
  return await api.post('/ai/smart-highlights/page/regenerate', { resourceId, pageNumber, studySessionId });
};

export const acceptSmartHighlights = async (resourceId, suggestions) => {
  return await api.post('/ai/smart-highlights/accept', { resourceId, suggestions });
};

export const acceptAllSmartHighlights = async (resourceId, suggestions) => {
  return await api.post('/ai/smart-highlights/accept-all', { resourceId, suggestions });
};

export const rejectSmartHighlights = async (resourceId, suggestionIds) => {
  return await api.post('/ai/smart-highlights/reject', { resourceId, suggestionIds });
};

export const rejectSmartHighlightSingle = async (resourceId, suggestionId) => {
  return await api.post(`/ai/smart-highlights/${encodeURIComponent(suggestionId)}/reject`, { resourceId });
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

// --- STUDY PLANNER API ---
export const createStudyPlan = async (planData) => {
  return await api.post('/study-plans', planData);
};

export const getStudyPlans = async (filters = {}) => {
  const query = new URLSearchParams(filters).toString();
  const endpoint = query ? `/study-plans?${query}` : '/study-plans';
  return await api.get(endpoint);
};

export const getStudyPlan = async (id) => {
  return await api.get(`/study-plans/${id}`);
};

export const updateStudyPlan = async (id, planData) => {
  return await api.patch(`/study-plans/${id}`, planData);
};

export const deleteStudyPlan = async (id) => {
  return await api.delete(`/study-plans/${id}`);
};

export const createStudyTask = async (planId, taskData) => {
  return await api.post(`/study-plans/${planId}/tasks`, taskData);
};

export const getStudyPlanTasks = async (planId) => {
  return await api.get(`/study-plans/${planId}/tasks`);
};

export const updateStudyTask = async (taskId, taskData) => {
  return await api.patch(`/study-tasks/${taskId}`, taskData);
};

export const deleteStudyTask = async (taskId) => {
  return await api.delete(`/study-tasks/${taskId}`);
};

export const completeStudyTask = async (taskId) => {
  return await api.patch(`/study-tasks/${taskId}/complete`);
};

export const getTodayTasks = async () => {
  return await api.get('/study-tasks/today');
};

export const getUpcomingTasks = async () => {
  return await api.get('/study-tasks/upcoming');
};

export const getPendingTasks = async () => {
  return await api.get('/study-tasks/pending');
};

export const generateAIStudyPlan = async (planParams) => {
  return await api.post('/study-plans/ai/generate', planParams);
};

export const acceptAIStudyPlan = async (payload) => {
  return await api.post('/study-plans/ai/accept', payload);
};

export const getPlanProgress = async (planId, clientDate) => {
  const query = clientDate ? `?clientDate=${clientDate}` : '';
  return await api.get(`/study-plans/${planId}/progress${query}`);
};

export const getAdaptationPreview = async (planId, clientDate) => {
  return await api.post(`/study-plans/${planId}/adapt/preview`, { clientDate });
};

export const applyAdaptation = async (planId, payload) => {
  return await api.post(`/study-plans/${planId}/adapt/apply`, payload);
};

export const getMindMapByWorkspace = async (workspaceId) => {
  return await api.get(`/mind-maps/workspace/${workspaceId}`);
};

export const generateMindMap = async (workspaceId) => {
  return await api.post(`/mind-maps/workspace/${workspaceId}/generate`);
};

// --- WORKSHOP INTELLIGENCE API ---
export const getWorkshopIntelligence = async (workshopId) => {
  return await api.get(`/workshops/${workshopId}/intelligence`);
};

export const initializeWorkshopIntelligence = async (workshopId) => {
  return await api.post(`/workshops/${workshopId}/intelligence/initialize`);
};

export const extractWorkshopKnowledge = async (workshopId) => {
  return await api.post(`/workshops/${workshopId}/intelligence/extract`, {}, { timeout: 300000 });
};

export const extractWorkshopRelationships = async (workshopId) => {
  return await api.post(`/workshops/${workshopId}/intelligence/relationships/extract`, {}, { timeout: 300000 });
};

export const getWorkshopGraph = async (workshopId) => {
  return await api.get(`/workshops/${workshopId}/intelligence/graph`);
};

export const getWorkshopInsights = async (workshopId) => {
  return await api.get(`/workshops/${workshopId}/intelligence/insights`);
};

// --- KNOWLEDGE ENGINE API ---
export const getResourceKnowledgeStatus = async (resourceId, workspaceId, options = {}) => {
  const query = workspaceId ? `?workspaceId=${workspaceId}` : '';
  return await api.get(`/knowledge/resource/${resourceId}/status${query}`, options);
};

export const reindexResourceKnowledge = async (resourceId, workspaceId) => {
  return await api.post(`/knowledge/resource/${resourceId}/reindex`, { workspaceId });
};

export const fetchPdfFile = async (sessionId, resourceId) => {
  return await api.get(`/study/${sessionId}/resources/${encodeURIComponent(resourceId)}/file`);
};

// --- STUDY ROOMS API ---
export const getStudyRooms = async (filters = {}) => {
  const cleanParams = {};
  Object.keys(filters).forEach(key => {
    if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
      cleanParams[key] = filters[key];
    }
  });
  const query = new URLSearchParams(cleanParams).toString();
  const endpoint = query ? `/study-rooms?${query}` : '/study-rooms';
  return await api.get(endpoint);
};

export const getStudyRoom = async (roomId) => {
  return await api.get(`/study-rooms/${roomId}`);
};

export const createStudyRoom = async (roomData) => {
  return await api.post('/study-rooms', roomData);
};

export const joinStudyRoom = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/join`, {});
};

export const leaveStudyRoom = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/leave`, {});
};

export const patchStudyRoom = async (roomId, roomData) => {
  return await api.patch(`/study-rooms/${roomId}`, roomData);
};

export const deleteStudyRoom = async (roomId) => {
  return await api.delete(`/study-rooms/${roomId}`);
};

export const startStudyRoom = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/start`, {});
};

export const endStudyRoom = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/end`, {});
};

export const cancelStudyRoom = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/cancel`, {});
};

export const lockStudyRoom = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/lock`, {});
};

export const unlockStudyRoom = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/unlock`, {});
};

export const getStudyRoomParticipants = async (roomId) => {
  return await api.get(`/study-rooms/${roomId}/participants`);
};

export const getStudyRoomTimeline = async (roomId) => {
  return await api.get(`/study-rooms/${roomId}/timeline`);
};

export const getCurrentFocusSession = async (roomId) => {
  return await api.get(`/study-rooms/${roomId}/focus/current`);
};

export const startFocusSession = async (roomId, data) => {
  return await api.post(`/study-rooms/${roomId}/focus/start`, data);
};

export const endFocusSession = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/focus/end`, {});
};

export const pauseFocusSession = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/focus/pause`, {});
};

export const resumeFocusSession = async (roomId) => {
  return await api.post(`/study-rooms/${roomId}/focus/resume`, {});
};

export const createRoomGoal = async (roomId, data) => {
  return await api.post(`/study-rooms/${roomId}/goals`, data);
};

export const getRoomGoals = async (roomId) => {
  return await api.get(`/study-rooms/${roomId}/goals`);
};

export const patchRoomGoal = async (roomId, goalId, data) => {
  return await api.patch(`/study-rooms/${roomId}/goals/${goalId}`, data);
};

export const completeRoomGoal = async (roomId, goalId) => {
  return await api.post(`/study-rooms/${roomId}/goals/${goalId}/complete`, {});
};

export const deleteRoomGoal = async (roomId, goalId) => {
  return await api.delete(`/study-rooms/${roomId}/goals/${goalId}`);
};

export const getStudyRoomChat = async (roomId) => {
  return await api.get(`/study-rooms/${roomId}/chat`);
};

export const deleteStudyRoomChatMessage = async (roomId, chatId) => {
  return await api.delete(`/study-rooms/${roomId}/chat/${chatId}`);
};




