import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Plus, Trash2, Edit3, CheckCircle, Circle, BookOpen, 
  ArrowLeft, AlertCircle, Calendar, Clock, Check, 
  Square, FileText, Video, ListTodo, BarChart2, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  createStudyPlan, getStudyPlans, getStudyPlan, 
  updateStudyPlan, deleteStudyPlan, createStudyTask, 
  getStudyPlanTasks, updateStudyTask, deleteStudyTask, 
  completeStudyTask, getTodayTasks, getUpcomingTasks,
  getStudySessions, generateAIStudyPlan, acceptAIStudyPlan,
  getPlanProgress, getAdaptationPreview, applyAdaptation
} from '../../services/api';

const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const TASK_TYPES = ['READ', 'WATCH', 'REVIEW', 'FLASHCARDS', 'QUIZ', 'EXPLAIN', 'PRACTICE', 'CUSTOM'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];
const PLAN_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'];

export default function StudyPlanner() {
  const { user } = useAuth();
  
  // Tab states: 'plans', 'today', 'upcoming'
  const [activeTab, setActiveTab] = useState('plans');
  
  // Data lists
  const [plans, setPlans] = useState([]);
  const [todayTasks, setTodayTasks] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [availableResources, setAvailableResources] = useState([]);
  
  // Detail Plan View
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedPlanTasks, setSelectedPlanTasks] = useState([]);
  const [progressInfo, setProgressInfo] = useState({ totalTasks: 0, completedTasks: 0, progress: 0 });
  
  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal forms states
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planFormMode, setPlanFormMode] = useState('create'); // 'create' or 'edit'
  const [planForm, setPlanForm] = useState({
    title: '',
    description: '',
    subject: '',
    startDate: '',
    endDate: '',
    dailyStudyMinutes: 60,
    preferredStudyDays: [...WEEKDAYS],
    priority: 'MEDIUM',
    status: 'ACTIVE',
    resourceIds: []
  });

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskFormMode, setTaskFormMode] = useState('create'); // 'create' or 'edit'
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    taskType: 'CUSTOM',
    scheduledDate: '',
    estimatedMinutes: 30,
    priority: 'MEDIUM',
    resourceId: ''
  });

  const [isAiMode, setIsAiMode] = useState(false);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [aiPreviewData, setAiPreviewData] = useState(null);
  const [generatingAiPlan, setGeneratingAiPlan] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [adaptiveProgress, setAdaptiveProgress] = useState(null);
  const [showAdaptPreview, setShowAdaptPreview] = useState(false);
  const [adaptPreviewData, setAdaptPreviewData] = useState(null);
  const [runningAdaptation, setRunningAdaptation] = useState(false);
  const [adaptError, setAdaptError] = useState(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'plan'|'task', id: string, name: string }

  // Fetch Dashboard Stats/Lists
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'plans') {
        const res = await getStudyPlans();
        setPlans(res?.plans || []);
      } else if (activeTab === 'today') {
        const res = await getTodayTasks();
        setTodayTasks(res?.tasks || []);
      } else if (activeTab === 'upcoming') {
        const res = await getUpcomingTasks();
        setUpcomingTasks(res?.tasks || []);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to load study planner data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Load available resources for lookup
  const loadResources = useCallback(async () => {
    try {
      const sessions = await getStudySessions();
      const resourcesList = [];
      const seenIds = new Set();
      if (Array.isArray(sessions)) {
        for (const s of sessions) {
          if (Array.isArray(s.resources)) {
            for (const r of s.resources) {
              const rId = r._id || r.url;
              if (rId && !seenIds.has(rId)) {
                seenIds.add(rId);
                resourcesList.push({
                  id: rId,
                  title: r.title || rId,
                  type: r.type || 'pdf',
                  studySessionId: s._id
                });
              }
            }
          }
        }
      }
      setAvailableResources(resourcesList);
    } catch (err) {
      console.error('Failed to load resources:', err);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  // Fetch single plan details
  const loadPlanDetails = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const localTodayStr = new Date().toISOString().split('T')[0];
      
      const [planRes, tasksRes, progressRes] = await Promise.all([
        getStudyPlan(id),
        getStudyPlanTasks(id),
        getPlanProgress(id, localTodayStr).catch(progressErr => {
          console.error('Failed to load adaptive progress metrics:', progressErr);
          return null;
        })
      ]);

      setSelectedPlan(planRes?.plan || null);
      setProgressInfo(planRes?.progressInfo || { totalTasks: 0, completedTasks: 0, progress: 0 });
      setSelectedPlanTasks(tasksRes?.tasks || []);
      setSelectedPlanId(id);
      setAdaptiveProgress(progressRes || null);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to retrieve plan details.');
    } finally {
      setLoading(false);
    }
  }, []);

  // CRUD Actions - Study Plan
  const handleOpenCreatePlan = () => {
    setIsAiMode(false);
    setPlanFormMode('create');
    setPlanForm({
      title: '',
      description: '',
      subject: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dailyStudyMinutes: 60,
      preferredStudyDays: [...WEEKDAYS],
      priority: 'MEDIUM',
      status: 'ACTIVE',
      resourceIds: []
    });
    setShowPlanModal(true);
  };

  const handleOpenCreateAiPlan = () => {
    setIsAiMode(true);
    setPlanFormMode('create');
    setPlanForm({
      title: '',
      description: '',
      subject: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dailyStudyMinutes: 60,
      preferredStudyDays: [...WEEKDAYS],
      priority: 'MEDIUM',
      status: 'ACTIVE',
      resourceIds: []
    });
    setShowPlanModal(true);
  };

  const handleOpenEditPlan = (plan) => {
    setIsAiMode(false);
    setPlanFormMode('edit');
    setPlanForm({
      title: plan.title,
      description: plan.description || '',
      subject: plan.subject,
      startDate: new Date(plan.startDate).toISOString().split('T')[0],
      endDate: new Date(plan.endDate).toISOString().split('T')[0],
      dailyStudyMinutes: plan.dailyStudyMinutes,
      preferredStudyDays: plan.preferredStudyDays || [],
      priority: plan.priority || 'MEDIUM',
      status: plan.status || 'ACTIVE',
      resourceIds: plan.resourceIds || []
    });
    setShowPlanModal(true);
  };

  const submitPlan = async (e) => {
    e.preventDefault();
    if (!planForm.title.trim() || !planForm.subject.trim()) {
      alert('Title and Subject are required');
      return;
    }
    if (new Date(planForm.endDate) < new Date(planForm.startDate)) {
      alert('End date cannot be before start date');
      return;
    }

    if (isAiMode) {
      setGeneratingAiPlan(true);
      setAiError(null);
      setShowPlanModal(false);
      setShowAiPreview(true);
      try {
        const res = await generateAIStudyPlan(planForm);
        setAiPreviewData(res?.planPreview || null);
      } catch (err) {
        console.error(err);
        setAiError(err.message || 'Unable to generate the study plan right now. Please try again.');
      } finally {
        setGeneratingAiPlan(false);
      }
      return;
    }
    
    setActionLoading(true);
    try {
      if (planFormMode === 'create') {
        await createStudyPlan(planForm);
      } else {
        await updateStudyPlan(selectedPlanId, planForm);
      }
      setShowPlanModal(false);
      if (selectedPlanId) {
        await loadPlanDetails(selectedPlanId);
      }
      await loadDashboardData();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error saving study plan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptAiPlan = async () => {
    if (!aiPreviewData) return;
    setActionLoading(true);
    setAiError(null);
    try {
      const payload = {
        plan: {
          title: aiPreviewData.title,
          subject: aiPreviewData.subject,
          startDate: aiPreviewData.startDate,
          endDate: aiPreviewData.endDate,
          dailyStudyMinutes: aiPreviewData.dailyStudyMinutes,
          preferredStudyDays: aiPreviewData.preferredStudyDays,
          priority: aiPreviewData.priority,
          resourceIds: aiPreviewData.resourceIds
        },
        tasks: aiPreviewData.tasks
      };
      
      await acceptAIStudyPlan(payload);
      setShowAiPreview(false);
      setAiPreviewData(null);
      await loadDashboardData();
    } catch (err) {
      console.error(err);
      setAiError(err.message || 'Failed to accept and save AI study plan.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerateAiPlan = async () => {
    if (!aiPreviewData) return;
    setGeneratingAiPlan(true);
    setAiError(null);
    try {
      const res = await generateAIStudyPlan({
        title: aiPreviewData.title,
        subject: aiPreviewData.subject,
        startDate: aiPreviewData.startDate,
        endDate: aiPreviewData.endDate,
        dailyStudyMinutes: aiPreviewData.dailyStudyMinutes,
        preferredStudyDays: aiPreviewData.preferredStudyDays,
        priority: aiPreviewData.priority,
        resourceIds: aiPreviewData.resourceIds
      });
      setAiPreviewData(res?.planPreview || null);
    } catch (err) {
      console.error(err);
      setAiError(err.message || 'Failed to regenerate study plan preview.');
    } finally {
      setGeneratingAiPlan(false);
    }
  };

  const handleRunAdaptivePlanning = async () => {
    setRunningAdaptation(true);
    setAdaptError(null);
    setAdaptPreviewData(null);
    setShowAdaptPreview(true);
    try {
      const localTodayStr = new Date().toISOString().split('T')[0];
      const res = await getAdaptationPreview(selectedPlanId, localTodayStr);
      setAdaptPreviewData(res?.preview || null);
    } catch (err) {
      console.error(err);
      setAdaptError(err.message || 'Unable to generate adaptive study plan. Please try again.');
    } finally {
      setRunningAdaptation(false);
    }
  };

  const handleApplyAdaptation = async () => {
    if (!adaptPreviewData) return;
    setActionLoading(true);
    setAdaptError(null);
    try {
      const payload = {
        rescheduledTasks: adaptPreviewData.rescheduledTasks || [],
        newAdaptiveTasks: adaptPreviewData.newAdaptiveTasks || []
      };
      await applyAdaptation(selectedPlanId, payload);
      setShowAdaptPreview(false);
      setAdaptPreviewData(null);
      await loadPlanDetails(selectedPlanId);
    } catch (err) {
      console.error(err);
      setAdaptError(err.message || 'Failed to apply adaptive changes.');
    } finally {
      setActionLoading(false);
    }
  };

  // CRUD Actions - Tasks
  const handleOpenCreateTask = () => {
    setTaskFormMode('create');
    setTaskForm({
      title: '',
      description: '',
      taskType: 'CUSTOM',
      scheduledDate: new Date().toISOString().split('T')[0],
      estimatedMinutes: 30,
      priority: 'MEDIUM',
      resourceId: ''
    });
    setShowTaskModal(true);
  };

  const handleOpenEditTask = (task) => {
    setTaskFormMode('edit');
    setEditingTaskId(task._id);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      taskType: task.taskType || 'CUSTOM',
      scheduledDate: new Date(task.scheduledDate).toISOString().split('T')[0],
      estimatedMinutes: task.estimatedMinutes || 30,
      priority: task.priority || 'MEDIUM',
      resourceId: task.resourceId || ''
    });
    setShowTaskModal(true);
  };

  const submitTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim() || !taskForm.scheduledDate) {
      alert('Title and Scheduled Date are required');
      return;
    }

    setActionLoading(true);
    try {
      if (taskFormMode === 'create') {
        await createStudyTask(selectedPlanId, taskForm);
      } else {
        await updateStudyTask(editingTaskId, taskForm);
      }
      setShowTaskModal(false);
      await loadPlanDetails(selectedPlanId);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error saving study task.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Task Completion
  const handleToggleTaskComplete = async (task) => {
    try {
      const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      
      // Optimistic update
      if (selectedPlanId) {
        setSelectedPlanTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
      } else if (activeTab === 'today') {
        setTodayTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
      } else if (activeTab === 'upcoming') {
        setUpcomingTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: newStatus } : t));
      }

      if (newStatus === 'COMPLETED') {
        await completeStudyTask(task._id);
      } else {
        await updateStudyTask(task._id, { status: 'PENDING' });
      }

      // Reload to ensure status & progress calculations are synced
      if (selectedPlanId) {
        await loadPlanDetails(selectedPlanId);
      } else {
        await loadDashboardData();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update task completion status.');
      // Revert reload
      if (selectedPlanId) {
        await loadPlanDetails(selectedPlanId);
      } else {
        await loadDashboardData();
      }
    }
  };

  // Delete Confirm Triggers
  const triggerDeleteConfirm = (type, id, name) => {
    setDeleteTarget({ type, id, name });
    setShowDeleteConfirm(true);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      if (deleteTarget.type === 'plan') {
        await deleteStudyPlan(deleteTarget.id);
        setSelectedPlanId(null);
        setSelectedPlan(null);
        await loadDashboardData();
      } else if (deleteTarget.type === 'task') {
        await deleteStudyTask(deleteTarget.id);
        if (selectedPlanId) {
          await loadPlanDetails(selectedPlanId);
        } else {
          await loadDashboardData();
        }
      }
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error deleting target item.');
    } finally {
      setActionLoading(false);
    }
  };

  // Format Date cleanly
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  };

  // Checkbox Helper
  const getResourceIcon = (resId) => {
    const res = availableResources.find(r => r.id === resId);
    if (!res) return <FileText size={12} />;
    return res.type === 'youtube' ? <Video size={12} style={{ color: '#ef4444' }} /> : <FileText size={12} style={{ color: '#3b82f6' }} />;
  };

  const getResourceTitle = (resId) => {
    const res = availableResources.find(r => r.id === resId);
    return res ? res.title : resId;
  };

  // Render Plan Detail View
  if (selectedPlanId && selectedPlan) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0a0d14',
        color: '#ffffff',
        padding: '24px',
        fontFamily: 'Inter, sans-serif'
      }}>
        {/* Header toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          paddingBottom: '16px'
        }}>
          <button
            onClick={() => { setSelectedPlanId(null); setSelectedPlan(null); loadDashboardData(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              background: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.7)',
              padding: '8px 14px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600
            }}
          >
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRunAdaptivePlanning}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                border: 'none',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
              }}
            >
              ✨ Run Adaptive Planning
            </button>
            <button
              onClick={() => handleOpenEditPlan(selectedPlan)}
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.02)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              Edit Plan
            </button>
            <button
              onClick={() => triggerDeleteConfirm('plan', selectedPlan._id, selectedPlan.title)}
              style={{
                border: 'none',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              Delete Plan
            </button>
          </div>
        </div>

        {/* Info Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '24px',
          marginBottom: '24px'
        }}>
          {/* Main Info */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                backgroundColor: 'rgba(168, 85, 247, 0.12)',
                color: '#c084fc',
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                {selectedPlan.subject}
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                backgroundColor: selectedPlan.priority === 'HIGH' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                color: selectedPlan.priority === 'HIGH' ? '#f87171' : '#fbbf24',
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                {selectedPlan.priority} Priority
              </span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 12px 0' }}>{selectedPlan.title}</h1>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              {selectedPlan.description || 'No description provided.'}
            </p>

            {/* Date range details */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                <Calendar size={14} style={{ color: '#66b8ff' }} />
                <span>{formatDate(selectedPlan.startDate)} – {formatDate(selectedPlan.endDate)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                <Clock size={14} style={{ color: '#66b8ff' }} />
                <span>{selectedPlan.dailyStudyMinutes} mins / day</span>
              </div>
            </div>
          </div>

          {/* Progress / Resources Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Today's Adaptive Progress Card */}
            {adaptiveProgress && (
              <div style={{
                backgroundColor: 'rgba(168, 85, 247, 0.03)',
                border: '1px solid rgba(168, 85, 247, 0.15)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 700 }}>TODAY'S PROGRESS</span>
                  {adaptiveProgress.streak > 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#fb7185', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      🔥 {adaptiveProgress.streak} Day Streak
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>
                    {adaptiveProgress.today?.progress || 0}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                    {adaptiveProgress.today?.completedTasksCount || 0} / {adaptiveProgress.today?.totalTasksCount || 0} tasks completed
                  </div>
                </div>
                {/* Horizontal Progress Bar */}
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>
                  <div style={{ width: `${adaptiveProgress.today?.progress || 0}%`, height: '100%', backgroundColor: '#c084fc', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ fontSize: '0.725rem', color: 'rgba(255,255,255,0.5)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Completed Minutes:</span>
                  <span style={{ fontWeight: 600 }}>{adaptiveProgress.today?.completedMinutes || 0} / {adaptiveProgress.today?.totalMinutes || 0} mins</span>
                </div>
              </div>
            )}

            {/* Progress Card */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: '6px' }}>PLAN PROGRESS</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#66b8ff', marginBottom: '8px' }}>{progressInfo.progress}%</div>
              <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', marginBottom: '12px' }}>
                <div style={{ width: `${progressInfo.progress}%`, height: '100%', backgroundColor: '#66b8ff', borderRadius: '3px', transition: 'width 0.3s ease' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                {progressInfo.completedTasks} of {progressInfo.totalTasks} tasks completed
              </span>
            </div>

            {/* Resources list */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '16px',
              flex: 1
            }}>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '10px' }}>Associated Resources</span>
              {selectedPlan.resourceIds?.length === 0 ? (
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>No resources linked.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedPlan.resourceIds?.map((resId) => (
                    <div 
                      key={resId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.7rem',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.04)'
                      }}
                    >
                      {getResourceIcon(resId)}
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {getResourceTitle(resId)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Adaptive Notice if any weak resources */}
        {adaptiveProgress && adaptiveProgress.performance && adaptiveProgress.performance.some(p => p.accuracy < 50) && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.04)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '0.85rem', fontWeight: 700 }}>
              <AlertCircle size={16} />
              <span>Adaptive Notice: Learning Gaps Detected</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {adaptiveProgress.performance.filter(p => p.accuracy < 50).map(p => (
                <div key={p.resourceId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.775rem', color: 'rgba(255,255,255,0.7)' }}>
                  <span>⚠️ "{p.resourceTitle}" needs review (Quiz accuracy: {p.accuracy}%)</span>
                  <button
                    onClick={handleRunAdaptivePlanning}
                    style={{
                      border: 'none',
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#f87171',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                  >
                    Reschedule Review
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Task List Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          marginTop: '20px'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <ListTodo size={18} style={{ color: '#66b8ff' }} />
            <span>Tasks Checklist ({selectedPlanTasks.length})</span>
          </h2>

          <button
            onClick={handleOpenCreateTask}
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              border: 'none',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            <span>Add Task</span>
          </button>
        </div>

        {/* Task List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {selectedPlanTasks.length === 0 ? (
            <div style={{
              textAlign: 'center',
              backgroundColor: 'rgba(255,255,255,0.01)',
              border: '1px dashed rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '30px',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.8rem'
            }}>
              No study tasks added to this plan yet. Get started by clicking "Add Task" above!
            </div>
          ) : (
            selectedPlanTasks.map((task) => {
              const isCompleted = task.status === 'COMPLETED';
              return (
                <div
                  key={task._id}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                    opacity: isCompleted ? 0.6 : 1
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1 }}>
                    <button
                      onClick={() => handleToggleTaskComplete(task)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isCompleted ? '#10b981' : 'rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        padding: 0,
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      {isCompleted ? (
                        <CheckCircle size={16} fill="rgba(16, 185, 129, 0.1)" />
                      ) : (
                        <Circle size={16} />
                      )}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        textDecoration: isCompleted ? 'line-through' : 'none',
                        color: isCompleted ? 'rgba(255,255,255,0.4)' : '#fff'
                      }}>
                        {task.title}
                      </span>
                      {task.description && (
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                          {task.description}
                        </span>
                      )}
                      
                      {/* Meta Tags */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.6)',
                          padding: '1px 5px',
                          borderRadius: '3px'
                        }}>
                          {task.taskType}
                        </span>
                        {task.estimatedMinutes && (
                          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Clock size={10} />
                            <span>{task.estimatedMinutes}m</span>
                          </span>
                        )}
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Calendar size={10} />
                          <span>{formatDate(task.scheduledDate)}</span>
                        </span>
                        {task.resourceId && (
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '0.65rem',
                            backgroundColor: 'rgba(102, 184, 255, 0.08)',
                            color: '#66b8ff',
                            padding: '1px 5px',
                            borderRadius: '3px'
                          }}>
                            {getResourceIcon(task.resourceId)}
                            <span>Resource Linked</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleOpenEditTask(task)}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title="Edit Task"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => triggerDeleteConfirm('task', task._id, task.title)}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: 'rgba(239, 68, 68, 0.6)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title="Delete Task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Tasks and delete Modals are defined at the bottom */}
        {renderDeleteConfirmModal()}
        {renderTaskModal()}
        {renderPlanModal()}
        {renderAiPreviewModal()}
        {renderAdaptPreviewModal()}
      </div>
    );
  }

  // Helper to render plan list
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0d14',
      color: '#ffffff',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Top Banner Dashboard Header */}
      <div style={{
        background: 'linear-gradient(to bottom, #111827, #0a0d14)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '30px 24px 20px 24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>Study Planner</h1>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', margin: '4px 0 0 0' }}>
              Define plans, schedule specific study tasks, and follow a timeline to complete your study goals.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleOpenCreatePlan}
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.02)',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Plus size={15} />
              <span>Create Study Plan</span>
            </button>
            <button
              onClick={handleOpenCreateAiPlan}
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                border: 'none',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
              }}
            >
              <span>✨ Generate AI Study Plan</span>
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'plans', label: 'Study Plans' },
            { id: 'today', label: 'Today\'s Checklist' },
            { id: 'upcoming', label: 'Upcoming Tasks' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                backgroundColor: activeTab === tab.id ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                border: activeTab === tab.id ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
                color: activeTab === tab.id ? '#c084fc' : 'rgba(255, 255, 255, 0.5)',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 650,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content body */}
      <div style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '50px' }}>
            <div className="pdf-spinner" style={{ margin: '0 auto 10px auto' }} />
            <span>Loading planner information...</span>
          </div>
        ) : error ? (
          <div style={{
            textAlign: 'center',
            color: '#f87171',
            padding: '30px',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.15)',
            borderRadius: '8px'
          }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px auto' }} />
            <div>{error}</div>
            <button
              onClick={loadDashboardData}
              style={{
                marginTop: '10px',
                padding: '6px 12px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div>
            {/* STUDY PLANS VIEW */}
            {activeTab === 'plans' && (
              <div>
                {plans.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '80px 20px',
                    border: '1px dashed rgba(255,255,255,0.06)',
                    borderRadius: '12px'
                  }}>
                    <Calendar size={48} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 6px 0' }}>No Study Plans Yet</h3>
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 16px 0', maxWidth: '300px', marginLeft: 'auto', marginRight: 'auto' }}>
                      Build custom study plans, allocate your daily timing, and schedule topics to review.
                    </p>
                    <button
                      onClick={handleOpenCreatePlan}
                      style={{
                        backgroundColor: 'rgba(168, 85, 247, 0.1)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        color: '#c084fc',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      + Create Study Plan
                    </button>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px'
                  }}>
                    {plans.map((plan) => (
                      <div
                        key={plan._id}
                        onClick={() => loadPlanDetails(plan._id)}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          padding: '16px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.2s ease',
                          minHeight: '160px'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.borderColor = 'rgba(168,85,247,0.2)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              backgroundColor: 'rgba(168, 85, 247, 0.12)',
                              color: '#c084fc',
                              padding: '2px 6px',
                              borderRadius: '3px'
                            }}>
                              {plan.subject}
                            </span>
                            <span style={{
                              fontSize: '0.6rem',
                              fontWeight: 800,
                              backgroundColor: plan.priority === 'HIGH' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                              color: plan.priority === 'HIGH' ? '#f87171' : '#fbbf24',
                              padding: '2px 6px',
                              borderRadius: '3px'
                            }}>
                              {plan.priority}
                            </span>
                          </div>

                          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 6px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {plan.title}
                          </h3>
                          <span style={{ fontSize: '0.725rem', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '12px' }}>
                            {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
                          </span>
                        </div>

                        <div>
                          {/* Progress bar */}
                          <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginBottom: '8px' }}>
                            <div style={{ width: `${plan.progress || 0}%`, height: '100%', backgroundColor: '#66b8ff', borderRadius: '2px' }} />
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                              {plan.completedTasks || 0} / {plan.totalTasks || 0} tasks ({plan.progress || 0}%)
                            </span>
                            <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TODAY'S CHECKLIST */}
            {activeTab === 'today' && (
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <ListTodo size={16} style={{ color: '#c084fc' }} />
                  <span>Today's Actions checklist</span>
                </h2>

                {todayTasks.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    border: '1px dashed rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: '0.8rem'
                  }}>
                    No tasks scheduled for today. Move to the Plans tab to open a plan and schedule tasks!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {todayTasks.map(task => {
                      const isCompleted = task.status === 'COMPLETED';
                      return (
                        <div
                          key={task._id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.04)',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            opacity: isCompleted ? 0.6 : 1
                          }}
                        >
                          <button
                            onClick={() => handleToggleTaskComplete(task)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: isCompleted ? '#10b981' : 'rgba(255,255,255,0.3)',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            {isCompleted ? (
                              <CheckCircle size={16} fill="rgba(16, 185, 129, 0.1)" />
                            ) : (
                              <Circle size={16} />
                            )}
                          </button>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              textDecoration: isCompleted ? 'line-through' : 'none',
                              color: isCompleted ? 'rgba(255,255,255,0.4)' : '#fff'
                            }}>
                              {task.title}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                              <span>{task.taskType}</span>
                              <span>•</span>
                              <span>{task.estimatedMinutes}m</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* UPCOMING TASKS */}
            {activeTab === 'upcoming' && (
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Calendar size={16} style={{ color: '#c084fc' }} />
                  <span>Upcoming scheduled tasks</span>
                </h2>

                {upcomingTasks.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    border: '1px dashed rgba(255,255,255,0.06)',
                    borderRadius: '12px',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: '0.8rem'
                  }}>
                    No upcoming tasks scheduled.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {upcomingTasks.map(task => (
                      <div
                        key={task._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.04)',
                          borderRadius: '8px',
                          padding: '12px 14px'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{task.title}</span>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '6px' }}>
                            <span>{task.taskType}</span>
                            <span>•</span>
                            <span>{task.estimatedMinutes}m</span>
                          </span>
                        </div>

                        <div style={{
                          fontSize: '0.7rem',
                          backgroundColor: 'rgba(102, 184, 255, 0.08)',
                          color: '#66b8ff',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 600
                        }}>
                          {formatDate(task.scheduledDate)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {renderPlanModal()}
      {renderDeleteConfirmModal()}
      {renderAiPreviewModal()}
      {renderAdaptPreviewModal()}
    </div>
  );

  // PLAN CRUD MODAL RENDERER
  function renderPlanModal() {
    if (!showPlanModal) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: '#0f121a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '500px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            {planFormMode === 'create' ? 'Create Study Plan' : 'Edit Study Plan'}
          </h2>

          <form onSubmit={submitPlan} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>PLAN TITLE *</label>
              <input
                required
                type="text"
                value={planForm.title}
                onChange={e => setPlanForm({ ...planForm, title: e.target.value })}
                placeholder="e.g. Computer Networks Final exam"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.825rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>SUBJECT *</label>
              <input
                required
                type="text"
                value={planForm.subject}
                onChange={e => setPlanForm({ ...planForm, subject: e.target.value })}
                placeholder="e.g. Computer Science"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.825rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>DESCRIPTION</label>
              <textarea
                value={planForm.description}
                onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder="Details of the study timeline"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.825rem',
                  minHeight: '60px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>START DATE *</label>
                <input
                  required
                  type="date"
                  value={planForm.startDate}
                  onChange={e => setPlanForm({ ...planForm, startDate: e.target.value })}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '0.825rem'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>END DATE *</label>
                <input
                  required
                  type="date"
                  value={planForm.endDate}
                  onChange={e => setPlanForm({ ...planForm, endDate: e.target.value })}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '0.825rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>DAILY MINUTES *</label>
                <input
                  required
                  type="number"
                  min="1"
                  max="1440"
                  value={planForm.dailyStudyMinutes}
                  onChange={e => setPlanForm({ ...planForm, dailyStudyMinutes: parseInt(e.target.value, 10) || 60 })}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '0.825rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>PRIORITY</label>
                <select
                  value={planForm.priority}
                  onChange={e => setPlanForm({ ...planForm, priority: e.target.value })}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '0.825rem'
                  }}
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p} style={{ backgroundColor: '#0f121a' }}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Resources selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>LINK EXISTING RESOURCES</label>
              <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '6px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {availableResources.length === 0 ? (
                  <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>No upload resources found in workspace.</span>
                ) : (
                  availableResources.map(res => {
                    const isChecked = planForm.resourceIds.includes(res.id);
                    const handleToggle = (e) => {
                      if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                      const list = isChecked 
                        ? planForm.resourceIds.filter(id => id !== res.id)
                        : [...planForm.resourceIds, res.id];
                      setPlanForm({ ...planForm, resourceIds: list });
                    };

                    return (
                      <div
                        key={res.id}
                        onClick={handleToggle}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: isChecked ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: isChecked ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggle();
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          {getResourceIcon(res.id)}
                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {res.title}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                              {res.type === 'pdf' ? 'PDF Document' : 'YouTube Video'}
                            </span>
                          </div>
                        </div>

                        {isChecked && (
                          <span style={{
                            fontSize: '0.65rem',
                            color: '#c084fc',
                            fontWeight: 700,
                            backgroundColor: 'rgba(168, 85, 247, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap'
                          }}>
                            ✓ Selected
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: actionLoading ? 0.6 : 1
                }}
              >
                {actionLoading ? 'Saving...' : 'Save Plan'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // TASK CRUD MODAL RENDERER
  function renderTaskModal() {
    if (!showTaskModal) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: '#0f121a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '460px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
            {taskFormMode === 'create' ? 'Add Study Task' : 'Edit Study Task'}
          </h2>

          <form onSubmit={submitTask} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>TASK TITLE *</label>
              <input
                required
                type="text"
                value={taskForm.title}
                onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="e.g. Read Chapter 4 of networking book"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.825rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>DESCRIPTION</label>
              <textarea
                value={taskForm.description}
                onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Specific topics to target"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.825rem',
                  minHeight: '40px',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>TASK TYPE</label>
                <select
                  value={taskForm.taskType}
                  onChange={e => setTaskForm({ ...taskForm, taskType: e.target.value })}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '0.825rem'
                  }}
                >
                  {TASK_TYPES.map(t => (
                    <option key={t} value={t} style={{ backgroundColor: '#0f121a' }}>{t}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>SCHEDULED DATE *</label>
                <input
                  required
                  type="date"
                  value={taskForm.scheduledDate}
                  onChange={e => setTaskForm({ ...taskForm, scheduledDate: e.target.value })}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '0.825rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>ESTIMATED DURATION (MINS) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  max="1440"
                  value={taskForm.estimatedMinutes}
                  onChange={e => setTaskForm({ ...taskForm, estimatedMinutes: parseInt(e.target.value, 10) || 30 })}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '0.825rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>PRIORITY</label>
                <select
                  value={taskForm.priority}
                  onChange={e => setTaskForm({ ...taskForm, priority: e.target.value })}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '8px 12px',
                    fontSize: '0.825rem'
                  }}
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p} style={{ backgroundColor: '#0f121a' }}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Associate Resource selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>LINK SPECIFIC PLAN RESOURCE</label>
              <select
                value={taskForm.resourceId}
                onChange={e => setTaskForm({ ...taskForm, resourceId: e.target.value })}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '8px 12px',
                  fontSize: '0.825rem'
                }}
              >
                <option value="" style={{ backgroundColor: '#0f121a' }}>-- No resource linked --</option>
                {selectedPlan?.resourceIds?.map(resId => (
                  <option key={resId} value={resId} style={{ backgroundColor: '#0f121a' }}>
                    {getResourceTitle(resId)}
                  </option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                style={{
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  opacity: actionLoading ? 0.6 : 1
                }}
              >
                {actionLoading ? 'Saving...' : 'Save Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // DELETE CONFIRMATION MODAL
  function renderDeleteConfirmModal() {
    if (!showDeleteConfirm || !deleteTarget) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1010
      }}>
        <div style={{
          backgroundColor: '#0f121a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '400px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f87171' }}>
            Confirm Deletion
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: '1.4' }}>
            Are you sure you want to delete the {deleteTarget.type} <strong>"{deleteTarget.name}"</strong>?
            {deleteTarget.type === 'plan' && ' This will permanently remove the study plan and all tasks associated with it.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={actionLoading}
              style={{
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'none',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={executeDelete}
              disabled={actionLoading}
              style={{
                border: 'none',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: actionLoading ? 0.6 : 1
              }}
            >
              {actionLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AI PREVIEW MODAL
  function renderAiPreviewModal() {
    if (!showAiPreview) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: '#0f121a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '650px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✨ AI Study Plan Preview</span>
          </h2>

          {generatingAiPlan ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.5)' }}>
              <div className="pdf-spinner" style={{ margin: '0 auto 16px auto' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>Analyzing resources & generating plan...</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                This may take a moment depending on the resource sizes.
              </div>
            </div>
          ) : aiError ? (
            <div style={{
              textAlign: 'center',
              color: '#f87171',
              padding: '24px',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: '8px'
            }}>
              <AlertCircle size={24} style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.85rem' }}>{aiError}</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowAiPreview(false)}
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'none',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGeneratingAiPlan(true);
                    setAiError(null);
                    generateAIStudyPlan(planForm)
                      .then(res => setAiPreviewData(res?.planPreview || null))
                      .catch(err => setAiError(err.message || 'Error occurred.'))
                      .finally(() => setGeneratingAiPlan(false));
                  }}
                  style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#c084fc',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Retry Generation
                </button>
              </div>
            </div>
          ) : aiPreviewData ? (
            <div>
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'block', fontWeight: 600 }}>SUBJECT</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{aiPreviewData.subject}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'block', fontWeight: 600 }}>DURATION</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{aiPreviewData.estimatedHours} hrs total</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', display: 'block', fontWeight: 600 }}>DAILY TARGET</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{aiPreviewData.dailyStudyMinutes} mins</span>
                </div>
              </div>

              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 10px 0' }}>Generated Day-by-Day Schedule</h3>
              <div style={{
                maxHeight: '280px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '10px'
              }}>
                {aiPreviewData.tasks?.map((task, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    padding: '8px 12px',
                    borderRadius: '6px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.775rem', fontWeight: 650, color: '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </span>
                      <span style={{ fontSize: '0.675rem', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '6px' }}>
                        <span>{task.taskType}</span>
                        <span>•</span>
                        <span>{task.estimatedMinutes} mins</span>
                        {task.pageStart && <span>• Pages {task.pageStart}-{task.pageEnd}</span>}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '0.7rem',
                      backgroundColor: 'rgba(168, 85, 247, 0.08)',
                      color: '#c084fc',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}>
                      {formatDate(task.scheduledDate)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAiPreview(false); setAiPreviewData(null); }}
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleRegenerateAiPlan}
                  style={{
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                    background: 'rgba(168, 85, 247, 0.03)',
                    color: '#c084fc',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleAcceptAiPlan}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {actionLoading ? 'Saving...' : 'Accept Plan'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ADAPTIVE PREVIEW MODAL RENDERER
  function renderAdaptPreviewModal() {
    if (!showAdaptPreview) return null;
    return (
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: '#0f121a',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '24px',
          width: '100%',
          maxWidth: '650px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✨ MindSync Adaptive Update</span>
          </h2>

          {runningAdaptation ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.5)' }}>
              <div className="pdf-spinner" style={{ margin: '0 auto 16px auto' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>Analyzing plan progress & generating adaptive updates...</div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                Comparing tasks, deadlines, and weak areas.
              </div>
            </div>
          ) : adaptError ? (
            <div style={{
              textAlign: 'center',
              color: '#f87171',
              padding: '24px',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: '8px'
            }}>
              <AlertCircle size={24} style={{ margin: '0 auto 8px auto' }} />
              <div style={{ fontSize: '0.85rem' }}>{adaptError}</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowAdaptPreview(false)}
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'none',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRunAdaptivePlanning}
                  style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: '#c084fc',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  Retry Analysis
                </button>
              </div>
            </div>
          ) : adaptPreviewData ? (
            <div>
              {/* Warnings and notices banner if any */}
              {adaptPreviewData.warnings && adaptPreviewData.warnings.length > 0 && (
                <div style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', display: 'block', marginBottom: '4px' }}>
                    ⚠️ Capacity Warnings
                  </span>
                  {adaptPreviewData.warnings.map((w, idx) => (
                    <div key={idx} style={{ fontSize: '0.725rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                      • {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Summary Stats */}
              <div style={{
                backgroundColor: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '0.775rem',
                color: 'rgba(255,255,255,0.6)'
              }}>
                We detected <strong style={{ color: '#fff' }}>{adaptPreviewData.overdueCount || 0}</strong> missed/overdue tasks. Completed historical tasks are protected and remain unchanged.
              </div>

              {/* Rescheduled list */}
              {adaptPreviewData.rescheduledTasks && adaptPreviewData.rescheduledTasks.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c084fc', margin: '0 0 8px 0' }}>
                    Rescheduled Tasks ({adaptPreviewData.rescheduledTasks.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                    {adaptPreviewData.rescheduledTasks.map((t, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        padding: '8px 10px',
                        borderRadius: '6px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.title}</span>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                            Moved from: {formatDate(t.previousDate)}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 600, padding: '2px 8px', backgroundColor: 'rgba(168,85,247,0.08)', borderRadius: '4px' }}>
                          ➡️ {formatDate(t.newScheduledDate)} ({t.estimatedMinutes}m)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remediation tasks list */}
              {adaptPreviewData.newAdaptiveTasks && adaptPreviewData.newAdaptiveTasks.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fb7185', margin: '0 0 8px 0' }}>
                    Recommended Remediation Tasks ({adaptPreviewData.newAdaptiveTasks.length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                    {adaptPreviewData.newAdaptiveTasks.map((t, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        padding: '8px 10px',
                        borderRadius: '6px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.title}</span>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>{t.description || 'Extra review task'}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#fb7185', fontWeight: 600, padding: '2px 8px', backgroundColor: 'rgba(251,113,133,0.08)', borderRadius: '4px' }}>
                          📅 {formatDate(t.scheduledDate)} ({t.estimatedMinutes}m)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accept & Cancel buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAdaptPreview(false); setAdaptPreviewData(null); }}
                  style={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Keep Current Plan
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleApplyAdaptation}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {actionLoading ? 'Applying...' : 'Apply Changes'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
