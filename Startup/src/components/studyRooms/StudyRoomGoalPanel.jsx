import React, { useState } from 'react';
import { CheckSquare, Plus, Square, ArrowLeft, Loader2, Sparkles, BookOpen } from 'lucide-react';
import { createRoomGoal, completeRoomGoal, getPendingTasks } from '../../services/api';
import { showToast } from '../Toast';

export default function StudyRoomGoalPanel({ roomId, goals = [], onRefresh }) {
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [addingStep, setAddingStep] = useState('options'); // 'options', 'manual', 'planner_list', 'planner_edit'
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDesc, setNewGoalDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [plannerTasks, setPlannerTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState('');

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

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: newGoalTitle.trim(),
        description: newGoalDesc.trim()
      };
      if (addingStep === 'planner_edit' && selectedTaskId) {
        payload.studyTaskId = selectedTaskId;
      }

      const res = await createRoomGoal(roomId, payload);
      if (res) {
        showToast('Personal goal created!', 'success');
        resetForm();
        onRefresh();
      } else {
        showToast('Failed to create goal', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error creating goal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteGoal = async (goalId) => {
    try {
      const res = await completeRoomGoal(roomId, goalId);
      if (res) {
        showToast('Goal completed! Keep it up!', 'success');
        onRefresh();
      } else {
        showToast('Failed to complete goal', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error completing goal', 'error');
    }
  };

  const resetForm = () => {
    setIsAddingGoal(false);
    setAddingStep('options');
    setNewGoalTitle('');
    setNewGoalDesc('');
    setSelectedTaskId('');
  };

  const startPlannerFlow = async () => {
    setAddingStep('planner_list');
    await fetchPlannerTasks();
  };

  const handleSelectTask = (task) => {
    setSelectedTaskId(task._id);
  };

  const handleContinuePlanner = () => {
    const task = plannerTasks.find(t => t._id === selectedTaskId);
    if (!task) return;
    setNewGoalTitle(task.title);
    setNewGoalDesc(task.description || '');
    setAddingStep('planner_edit');
  };

  // Calculate completion percentage
  const completedCount = goals.filter((g) => g.status === 'COMPLETED').length;
  const totalCount = goals.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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

      {/* Adding Goal Layout Mode */}
      {isAddingGoal ? (
        <div className="add-goal-workflow" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
            <button type="button" onClick={() => {
              if (addingStep === 'manual') setAddingStep('options');
              else if (addingStep === 'planner_list') setAddingStep('options');
              else if (addingStep === 'planner_edit') setAddingStep('planner_list');
              else resetForm();
            }} style={{ background: 'none', border: 'none', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <ArrowLeft size={14} /> Back
            </button>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
              {addingStep === 'options' ? 'Choose Goal Type' : addingStep === 'manual' ? 'Create Manually' : addingStep === 'planner_list' ? 'Import from Planner' : 'Edit Goal Details'}
            </span>
            <button type="button" onClick={resetForm} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.85rem' }}>
              Cancel
            </button>
          </div>

          {addingStep === 'options' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setAddingStep('manual')}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <Plus size={18} style={{ color: '#3b82f6' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Create Manually</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Write down a custom study objective</div>
                </div>
              </button>

              <button
                type="button"
                onClick={startPlannerFlow}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <BookOpen size={18} style={{ color: '#a78bfa' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Import from Study Planner</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Link to one of your active academic tasks</div>
                </div>
              </button>
            </div>
          )}

          {addingStep === 'manual' && (
            <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }} htmlFor="manual-title">Goal Title</label>
                <input
                  id="manual-title"
                  type="text"
                  placeholder="E.g., Complete Linked List problems"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  disabled={submitting}
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', color: '#fff' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }} htmlFor="manual-desc">Description (Optional)</label>
                <textarea
                  id="manual-desc"
                  placeholder="E.g., Solve Leetcode 206 & 92"
                  value={newGoalDesc}
                  onChange={(e) => setNewGoalDesc(e.target.value)}
                  disabled={submitting}
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', color: '#fff', resize: 'vertical', minHeight: '60px' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !newGoalTitle.trim()}
                style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                {submitting ? 'Creating...' : 'Add Goal'}
              </button>
            </form>
          )}

          {addingStep === 'planner_list' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Your Study Planner Tasks:</div>
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }} className="admin-scrollbar">
                {loadingTasks ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '24px 0', color: 'rgba(255,255,255,0.5)' }}>
                    <Loader2 size={16} className="animate-spin" /> Loading tasks...
                  </div>
                ) : plannerTasks.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '24px 0', fontSize: '0.8rem' }}>
                    No pending tasks in Study Planner.
                  </div>
                ) : (
                  plannerTasks.map((task) => {
                    const isSelected = selectedTaskId === task._id;
                    return (
                      <button
                        key={task._id}
                        type="button"
                        onClick={() => handleSelectTask(task)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '6px', border: `1px solid ${isSelected ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`, background: isSelected ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.01)', color: '#fff', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                      >
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa' }} />}
                        </div>
                        <span style={{ fontSize: '0.85rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.title}</span>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={handleContinuePlanner}
                disabled={!selectedTaskId || loadingTasks}
                style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', opacity: (!selectedTaskId || loadingTasks) ? 0.5 : 1 }}
              >
                Continue
              </button>
            </div>
          )}

          {addingStep === 'planner_edit' && (
            <form onSubmit={handleCreateGoal} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }} htmlFor="planner-title">Personal Study Goal Title</label>
                <input
                  id="planner-title"
                  type="text"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  disabled={submitting}
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', color: '#fff' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }} htmlFor="planner-desc">Description</label>
                <textarea
                  id="planner-desc"
                  value={newGoalDesc}
                  onChange={(e) => setNewGoalDesc(e.target.value)}
                  disabled={submitting}
                  style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '6px', color: '#fff', resize: 'vertical', minHeight: '60px' }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !newGoalTitle.trim()}
                style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                {submitting ? 'Creating...' : 'Add Goal'}
              </button>
            </form>
          )}
        </div>
      ) : (
        <>
          {/* Button to open creation workflow */}
          <button
            type="button"
            onClick={() => setIsAddingGoal(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem', transition: 'all 0.2s', marginBottom: '12px' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          >
            <Plus size={16} /> Add Personal Goal
          </button>

          {/* Checklist list */}
          <div className="goals-checklist-list admin-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {goals.length === 0 ? (
              <div className="goals-empty-state" style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '24px 0', fontSize: '0.85rem' }}>
                Define focus targets to track your progress.
              </div>
            ) : (
              goals.map((g) => {
                const isDone = g.status === 'COMPLETED';
                const isFromPlanner = !!g.studyTask;
                return (
                  <div key={g._id} className={`goal-checkbox-row ${isDone ? 'completed' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <button
                        type="button"
                        className="btn-goal-toggle"
                        onClick={() => !isDone && handleCompleteGoal(g._id)}
                        disabled={isDone}
                        aria-label={isDone ? "Goal completed" : "Mark goal completed"}
                        style={{ background: 'none', border: 'none', padding: 0, margin: 0, color: isDone ? '#10b981' : 'rgba(255,255,255,0.4)', cursor: isDone ? 'default' : 'pointer', flexShrink: 0 }}
                      >
                        {isDone ? (
                          <CheckSquare size={16} className="icon-checked" />
                        ) : (
                          <Square size={16} className="icon-unchecked" />
                        )}
                      </button>
                      <span className="goal-title-text" style={{ marginLeft: '8px', fontWeight: 500, fontSize: '0.9rem', color: isDone ? 'rgba(255,255,255,0.4)' : '#fff', textDecoration: isDone ? 'line-through' : 'none', wordBreak: 'break-word', textAlign: 'left' }}>
                        {g.title}
                      </span>
                    </div>
                    {g.description && (
                      <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginLeft: '24px', marginTop: '4px', textAlign: 'left' }}>
                        {g.description}
                      </span>
                    )}
                    {isFromPlanner && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: 'calc(100% - 24px)', marginLeft: '24px', marginTop: '6px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Sparkles size={11} style={{ color: '#8b5cf6' }} /> Source: <strong style={{ color: '#a78bfa' }}>Study Planner</strong></span>
                        <span>Status: <strong style={{ color: isDone ? '#10b981' : '#fbbf24' }}>{isDone ? 'COMPLETED' : 'IN PROGRESS'}</strong></span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
