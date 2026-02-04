import { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonLabel, IonCard, IonCardHeader, IonCardTitle, 
  IonCardContent, IonIcon, IonSegment, IonSegmentButton
} from '@ionic/react';
import { arrowBack, checkmark, close, trash, shieldCheckmark, person } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { api, useAuth } from '../App';

interface User {
  id: string;
  username: string;
  role: string;
  status: string;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalScripts: number;
  pendingUsers: number;
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalScripts: 0, pendingUsers: 0 });
  const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  const history = useHistory();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role !== 'admin') {
      history.push('/dashboard');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    const [usersRes, statsRes] = await Promise.all([
      api<{ users: User[] }>('/admin/users'),
      api<{ stats: Stats }>('/admin/stats')
    ]);
    if (usersRes.users) setUsers(usersRes.users);
    if (statsRes.stats) setStats(statsRes.stats);
  };

  const approveUser = async (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'approved' } : u));
    await api('/admin/users/' + userId, { method: 'PUT', body: { status: 'approved' } as any });
    loadData();
  };

  const rejectUser = async (userId: string) => {
    if (!confirm('Reject and delete this user?')) return;
    setUsers(prev => prev.filter(u => u.id !== userId));
    await api('/admin/users/' + userId, { method: 'DELETE' });
    loadData();
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Delete this user and all their scripts?')) return;
    setUsers(prev => prev.filter(u => u.id !== userId));
    await api('/admin/users/' + userId, { method: 'DELETE' });
    loadData();
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    await api('/admin/users/' + userId, { method: 'PUT', body: { role: newRole } as any });
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const approvedUsers = users.filter(u => u.status === 'approved' || !u.status);

  const formatDate = (d: string) => {
    if (!d) return 'Unknown';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => history.push('/dashboard')}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Admin Panel</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {/* Stats Cards */}
        <div className="admin-stats-grid">
          <IonCard className="admin-stat-card">
            <IonCardHeader><IonCardTitle>{stats.totalUsers}</IonCardTitle></IonCardHeader>
            <IonCardContent>Total Users</IonCardContent>
          </IonCard>
          <IonCard className="admin-stat-card">
            <IonCardHeader><IonCardTitle>{stats.totalScripts}</IonCardTitle></IonCardHeader>
            <IonCardContent>Total Scripts</IonCardContent>
          </IonCard>
          <IonCard className="admin-stat-card pending">
            <IonCardHeader><IonCardTitle>{pendingUsers.length}</IonCardTitle></IonCardHeader>
            <IonCardContent>Pending Approval</IonCardContent>
          </IonCard>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <IonSegment value={tab} onIonChange={e => setTab(e.detail.value as any)}>
            <IonSegmentButton value="pending">
              <IonLabel>Pending {pendingUsers.length > 0 && `(${pendingUsers.length})`}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="approved">
              <IonLabel>Approved ({approvedUsers.length})</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        {/* Pending Users */}
        {tab === 'pending' && (
          <div className="admin-users-list">
            {pendingUsers.length === 0 ? (
              <div className="empty-state">
                <IonIcon icon={checkmark} style={{ fontSize: 48, color: '#22c55e' }} />
                <p>No pending approvals</p>
              </div>
            ) : (
              pendingUsers.map(u => (
                <div key={u.id} className="admin-user-card pending">
                  <div className="user-info">
                    <div className="user-avatar pending">
                      <IonIcon icon={person} />
                    </div>
                    <div className="user-details">
                      <h3>{u.username}</h3>
                      <span>Registered {formatDate(u.createdAt)}</span>
                    </div>
                  </div>
                  <div className="user-actions">
                    <button className="approve-btn" onClick={() => approveUser(u.id)}>
                      <IonIcon icon={checkmark} />
                      Approve
                    </button>
                    <button className="reject-btn" onClick={() => rejectUser(u.id)}>
                      <IonIcon icon={close} />
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Approved Users */}
        {tab === 'approved' && (
          <div className="admin-users-list">
            {approvedUsers.map(u => (
              <div key={u.id} className="admin-user-card">
                <div className="user-info">
                  <div className={`user-avatar ${u.role === 'admin' ? 'admin' : ''}`}>
                    <IonIcon icon={u.role === 'admin' ? shieldCheckmark : person} />
                  </div>
                  <div className="user-details">
                    <h3>{u.username}</h3>
                    <span className={`role-badge ${u.role}`}>{u.role}</span>
                    <span className="join-date">Joined {formatDate(u.createdAt)}</span>
                  </div>
                </div>
                <div className="user-actions">
                  <button 
                    className={`role-btn ${u.role === 'admin' ? 'demote' : 'promote'}`}
                    onClick={() => toggleRole(u.id, u.role)}
                  >
                    {u.role === 'admin' ? 'Demote' : 'Promote'}
                  </button>
                  {u.id !== user?.id && (
                    <button className="delete-user-btn" onClick={() => deleteUser(u.id)}>
                      <IonIcon icon={trash} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
