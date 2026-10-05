import React, { useState } from 'react';
import { Plus, Loader2, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { createRoomGoal, completeRoomGoal, getPendingTasks, patchRoomGoal, deleteRoomGoal } from '../../services/api';
import { showToast } from '../Toast';

export default function StudyRoomGoalPanel({ roomId, goals = [], onRefresh }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalProgress, setGoalProgress] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [plannerTasks, setPlannerTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const fetchPlannerTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await getPendingTasks();
      if (res && res.tasks) {
        setPlannerTasks(res.tasks);
      } else if (Array.isArray(res)) {
        setPlannerTasks(res);
      } else {
        setPlannerTasks([]);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load tasks from Study Planner', 'error');
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingGoalId(null);
    setGoalTitle('');
    setGoalDesc('');
    setGoalProgress(0);
    setSelectedTaskId('');
    setIsModalOpen(true);
    fetchPlannerTasks();
  };

  const handleOpenEditModal = (goal) => {
    setEditingGoalId(goal._id);
    setGoalTitle(goal.title);
    setGoalDesc(goal.description || '');
    setGoalProgress(goal.progress || 0);
    const taskId = goal.studyTask ? (goal.studyTask._id || goal.studyTask) : '';
    setSelectedTaskId(taskId);
    setIsModalOpen(true);
    fetchPlannerTasks();
  };

  const handleSubmitGoal = async (e) => {
    e.preventDefault();
    if (!goalTitle.trim()) {
      showToast('Goal title is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: goalTitle.trim(),
        description: goalDesc.trim(),
        progress: Number(goalProgress),
        studyTaskId: selectedTaskId || null
      };

      if (editingGoalId) {
        const res = await patchRoomGoal(roomId, editingGoalId, payload);
        if (res) {
          showToast('Personal goal updated!', 'success');
          setIsModalOpen(false);
          onRefresh();
        } else {
          showToast('Failed to update goal', 'error');
        }
      } else {
        const res = await createRoomGoal(roomId, payload);
        if (res) {
          showToast('Personal goal created!', 'success');
          setIsModalOpen(false);
          onRefresh();
        } else {
          showToast('Failed to create goal', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error saving goal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this personal goal? This will not delete the linked Study Planner task.')) {
      return;
    }
    try {
      await deleteRoomGoal(roomId, goalId);
      showToast('Personal goal deleted', 'success');
      onRefresh();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error deleting goal', 'error');
    }
  };

  const handleCompleteGoal = async (goalId) => {
    try {
      const res = await completeRoomGoal(roomId, goalId);
      if (res) {
        showToast('Goal marked complete! Keep it up!', 'success');
        onRefresh();
      } else {
        showToast('Failed to complete goal', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error completing goal', 'error');
    }
  };

  // Calculate completion percentage
  const completedCount = goals.filter((g) => g.status === 'COMPLETED').length;
  const totalCount = goals.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const getTaskOptions = () => {
    const options = [...plannerTasks];
    if (editingGoalId) {
      const currentGoal = goals.find(g => g._id === editingGoalId);
      if (currentGoal && currentGoal.studyTask) {
        const currentTaskId = currentGoal.studyTask._id || currentGoal.studyTask;
        const exists = options.some(t => t._id === currentTaskId);
        if (!exists) {
          options.unshift(currentGoal.studyTask);
        }
      }
    }
    return options;
  };

  return (
    <div className="workspace-goals-card">
      <div className="goals-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>MY GOALS FOR THIS SESSION</h3>
        <span className="goals-progress-badge">{progressPercent}% Done</span>
      </div>

      {/* Progress Bar */}
      <div className="goals-progress-track">
        <div className="goals-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* Add Personal Goal Button */}
      <button
        type="button"
        onClick={handleOpenCreateModal}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifycontent: 'center',
          gap: '8px',
          width: '100%',
          padding: '10px',
          borderRadius: '6px',
          border: '1px dashed rgba(255, 255, 255, 0.2)',
          background: 'rgba(255, 255, 255, 0.02)',
          color: 'rgba(255, 255, 255, 0.7)',
          cursor: 'pointer',
          fontWeight: 500,
          fontSize: '0.85rem',
          transition: 'all 0.2s',
          marginBottom: '16px'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; }}
      >
        <Plus size={16} /> Add Personal Goal
      </button>

      {/* Goals Checklist Card List */}
      <div className="goals-checklist-list admin-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
        {goals.length === 0 ? (
          <div className="goals-empty-state" style={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', padding: '24px 0', fontSize: '0.85rem' }}>
            Define focus targets to track your progress.
          </div>
        ) : (
          goals.map((g) => {
            const isDone = g.status === 'COMPLETED';
            const isFromPlanner = !!g.studyTask;
            const plannerTaskName = g.studyTask ? g.studyTask.title : null;
            const isTaskCompleted = g.studyTask ? g.studyTask.status === 'COMPLETED' : false;

            const filledBlocks = Math.round(g.progress / 10);
            const emptyBlocks = 10 - filledBlocks;
            const blockString = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

            return (
              <div
                key={g._id}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isDone ? 'rgba(255, 255, 255, 0.4)' : '#fff', textDecoration: isDone ? 'line-through' : 'none' }}>
                    {g.title}
                  </div>
                  {g.description && (
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
                      {g.description}
                    </div>
                  )}
                </div>

                {/* Progress Blocks representation */}
                <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  <div>Progress</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#60a5fa', marginTop: '2px', letterSpacing: '1px' }}>
                    [{blockString}] {g.progress}%
                  </div>
                </div>

                {/* Planner and Status Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px', fontSize: '0.75rem' }}>
                  {isFromPlanner ? (
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                      Planner:{' '}
                      {isTaskCompleted ? (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Completed</span>
                      ) : plannerTaskName ? (
                        <span>Linked to "{plannerTaskName}"</span>
                      ) : (
                        <span style={{ color: '#ef4444' }}>Task unavailable</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(255, 255, 255, 0.35)' }}>
                      Planner: No link
                    </div>
                  )}

                  <div style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    Status:{' '}
                    {isDone ? (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Completed</span>
                    ) : (
                      <span style={{ color: '#fbbf24' }}>Active</span>
                    )}
                  </div>
                </div>

                {/* Action buttons (only for active goals) */}
                {!isDone && (
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(g)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.8)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCompleteGoal(g._id)}
                      style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        color: '#60a5fa',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 600
                      }}
                    >
                      <CheckCircle size={12} /> Mark Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(g._id)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: 'none',
                        color: '#f87171',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* CREATE/EDIT MODAL OVERLAY */}
      {isModalOpen && (
        <div className="workspace-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="workspace-modal-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '420px', padding: '24px', position: 'relative' }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#fff', fontWeight: 700 }}>
              {editingGoalId ? 'Edit Personal Goal' : 'Create Personal Goal'}
            </h3>

            <form onSubmit={handleSubmitGoal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>Goal Title</label>
                <input
                  type="text"
                  placeholder="E.g., Complete Linked List revision"
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  disabled={submitting}
                  required
                  style={{
                    background: '#0b1220',
                    border: '1px solid #1f2937',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>Description (Optional)</label>
                <textarea
                  placeholder="E.g., Review insertion, deletion and traversal."
                  value={goalDesc}
                  onChange={(e) => setGoalDesc(e.target.value)}
                  disabled={submitting}
                  style={{
                    background: '#0b1220',
                    border: '1px solid #1f2937',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    minHeight: '60px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>Progress ({goalProgress}%)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={goalProgress}
                    onChange={(e) => setGoalProgress(Number(e.target.value))}
                    disabled={submitting}
                    style={{ flexGrow: 1, accentColor: '#3b82f6' }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={goalProgress}
                    onChange={(e) => {
                      let val = Number(e.target.value);
                      if (val < 0) val = 0;
                      if (val > 100) val = 100;
                      setGoalProgress(val);
                    }}
                    disabled={submitting}
                    style={{
                      width: '60px',
                      background: '#0b1220',
                      border: '1px solid #1f2937',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      textAlign: 'center'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>Link to Study Planner Task</label>
                {loadingTasks ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem' }}>
                    <Loader2 size={14} className="animate-spin" /> Loading tasks...
                  </div>
                ) : (
                  <select
                    value={selectedTaskId}
                    onChange={(e) => {
                      const taskId = e.target.value;
                      setSelectedTaskId(taskId);
                      if (taskId && (!goalTitle || goalTitle.trim() === '')) {
                        const selectedTask = getTaskOptions().find(t => t._id === taskId);
                        if (selectedTask) {
                          setGoalTitle(selectedTask.title);
                          setGoalDesc(selectedTask.description || '');
                        }
                      }
                    }}
                    disabled={submitting}
                    style={{
                      background: '#0b1220',
                      border: '1px solid #1f2937',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                  >
                    <option value="">None</option>
                    {getTaskOptions().map((task) => (
                      <option key={task._id} value={task._id}>
                        {task.title} {task.status === 'COMPLETED' ? '(✓ Completed)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.8)',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: '#3b82f6',
                    border: 'none',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {editingGoalId ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
