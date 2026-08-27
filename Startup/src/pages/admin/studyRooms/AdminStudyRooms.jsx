import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { getStudyRooms, startStudyRoom, endStudyRoom, cancelStudyRoom, lockStudyRoom, unlockStudyRoom, deleteStudyRoom } from '../../../services/api';
import { showToast } from '../../../components/Toast';

// Component Imports
import StudyRoomTable from '../../../components/admin/studyRooms/StudyRoomTable';
import StudyRoomFilters from '../../../components/admin/studyRooms/StudyRoomFilters';
import StudyRoomForm from '../../../components/admin/studyRooms/StudyRoomForm';
import StudyRoomDetails from '../../../components/admin/studyRooms/StudyRoomDetails';
import DeleteRoomDialog from '../../../components/admin/studyRooms/DeleteRoomDialog';

import './AdminStudyRooms.css';

export default function AdminStudyRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  // Modals & Panels State
  const [selectedRoomForDetails, setSelectedRoomForDetails] = useState(null);
  const [selectedRoomForEdit, setSelectedRoomForEdit] = useState(null);
  const [selectedRoomForDelete, setSelectedRoomForDelete] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchRooms = () => {
    setLoading(true);
    setError(null);
    getStudyRooms()
      .then((res) => {
        if (Array.isArray(res)) {
          setRooms(res);
        } else {
          setError('Failed to fetch rooms list');
        }
      })
      .catch((err) => {
        console.error('Failed to load study rooms', err);
        setError(err.message || 'Error loading study rooms from API');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // API Operation Handlers
  const handleStart = async (roomId) => {
    try {
      const res = await startStudyRoom(roomId);
      if (res) {
        showToast('Study room is now LIVE!', 'success');
        fetchRooms();
      } else {
        showToast('Failed to start study room', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error starting study room', 'error');
    }
  };

  const handleEnd = async (roomId) => {
    try {
      const res = await endStudyRoom(roomId);
      if (res) {
        showToast('Study room has been ended.', 'success');
        fetchRooms();
      } else {
        showToast('Failed to end study room', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error ending study room', 'error');
    }
  };

  const handleCancel = async (roomId) => {
    try {
      const res = await cancelStudyRoom(roomId);
      if (res) {
        showToast('Study room scheduling cancelled.', 'success');
        fetchRooms();
      } else {
        showToast('Failed to cancel room scheduling', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error cancelling study room', 'error');
    }
  };

  const handleLock = async (roomId) => {
    try {
      const res = await lockStudyRoom(roomId);
      if (res) {
        showToast('Room locked successfully.', 'success');
        fetchRooms();
      } else {
        showToast('Failed to lock room', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error locking room', 'error');
    }
  };

  const handleUnlock = async (roomId) => {
    try {
      const res = await unlockStudyRoom(roomId);
      if (res) {
        showToast('Room unlocked successfully.', 'success');
        fetchRooms();
      } else {
        showToast('Failed to unlock room', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error unlocking room', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRoomForDelete) return;
    try {
      const res = await deleteStudyRoom(selectedRoomForDelete._id);
      if (res) {
        showToast('Study room deleted successfully.', 'success');
        setSelectedRoomForDelete(null);
        fetchRooms();
      } else {
        showToast('Failed to delete room', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Error deleting study room', 'error');
    }
  };

  // Filter list logic
  const getFilteredRooms = () => {
    let filtered = [...rooms];

    if (statusFilter) {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    if (subjectFilter) {
      const sub = subjectFilter.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(sub) ||
          (r.description && r.description.toLowerCase().includes(sub)) ||
          (r.workshopId?.title && r.workshopId.title.toLowerCase().includes(sub))
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.workshopId?.title && r.workshopId.title.toLowerCase().includes(q))
      );
    }

    return filtered;
  };

  const filteredRooms = getFilteredRooms();

  // Stats calculation
  const totalCount = rooms.length;
  const scheduledCount = rooms.filter((r) => r.status === 'SCHEDULED').length;
  const liveCount = rooms.filter((r) => r.status === 'LIVE').length;
  const completedCount = rooms.filter((r) => r.status === 'ENDED').length;

  return (
    <div className="admin-study-rooms-wrapper" data-testid="admin-study-rooms-container">
      {/* Top Header */}
      <div className="admin-page-header">
        <div className="admin-header-title">
          <h1>Study Rooms</h1>
          <p>Create, schedule and manage focused study sessions.</p>
        </div>
        <button
          type="button"
          className="btn-admin-primary"
          onClick={() => setIsCreateOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          <span>Create Study Room</span>
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon total">📚</div>
          <div className="admin-stat-info">
            <span className="admin-stat-val">{totalCount}</span>
            <span className="admin-stat-lbl">Total Rooms</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon scheduled">📅</div>
          <div className="admin-stat-info">
            <span className="admin-stat-val">{scheduledCount}</span>
            <span className="admin-stat-lbl">Scheduled</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon live">🎬</div>
          <div className="admin-stat-info">
            <span className="admin-stat-val">{liveCount}</span>
            <span className="admin-stat-lbl">Live Now</span>
          </div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon completed">✓</div>
          <div className="admin-stat-info">
            <span className="admin-stat-val">{completedCount}</span>
            <span className="admin-stat-lbl">Completed</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <StudyRoomFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        subjectFilter={subjectFilter}
        onSubjectChange={setSubjectFilter}
      />

      {/* Error state */}
      {error && (
        <div className="error-state">
          <h3>Failed to Load Rooms</h3>
          <p>{error}</p>
          <button type="button" className="btn-admin-primary" onClick={fetchRooms}>
            Retry Load
          </button>
        </div>
      )}

      {/* Rooms Table */}
      {!error && (
        <StudyRoomTable
          rooms={filteredRooms}
          onViewDetails={setSelectedRoomForDetails}
          onEdit={setSelectedRoomForEdit}
          onDelete={setSelectedRoomForDelete}
          onStart={handleStart}
          onEnd={handleEnd}
          onCancel={handleCancel}
          onLock={handleLock}
          onUnlock={handleUnlock}
        />
      )}

      {/* Drawers / Dialog panels */}
      <StudyRoomForm
        room={selectedRoomForEdit}
        isOpen={selectedRoomForEdit !== null || isCreateOpen}
        onClose={() => {
          setSelectedRoomForEdit(null);
          setIsCreateOpen(false);
        }}
        onSaved={fetchRooms}
      />

      <StudyRoomDetails
        room={selectedRoomForDetails}
        isOpen={selectedRoomForDetails !== null}
        onClose={() => setSelectedRoomForDetails(null)}
      />

      <DeleteRoomDialog
        room={selectedRoomForDelete}
        isOpen={selectedRoomForDelete !== null}
        onClose={() => setSelectedRoomForDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
export { AdminStudyRooms };
