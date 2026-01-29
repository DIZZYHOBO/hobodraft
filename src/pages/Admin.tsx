import { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonList, IonItem, IonLabel, IonNote, IonCard,
  IonCardHeader, IonCardTitle, IonCardContent, IonIcon
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { api, useAuth } from '../App';

interface User {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  totalScripts: number;
}

export default function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalScripts: 0 });
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

  const deleteUser = async (userId: string) => {
    if (!confirm('Delete this user and all their scripts?')) return;
    await api('/admin/users/' + userId, { method: 'DELETE' });
    loadData();
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    await api('/admin/users/' + userId, { method: 'PUT', body: { role: newRole } as any });
    loadData();
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
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <IonCard style={{ flex: 1, margin: 0 }}>
            <IonCardHeader><IonCardTitle>{stats.totalUsers}</IonCardTitle></IonCardHeader>
            <IonCardContent>Total Users</IonCardContent>
          </IonCard>
          <IonCard style={{ flex: 1, margin: 0 }}>
            <IonCardHeader><IonCardTitle>{stats.totalScripts}</IonCardTitle></IonCardHeader>
            <IonCardContent>Total Scripts</IonCardContent>
          </IonCard>
        </div>

        <h2 style={{ marginBottom: 16 }}>Users</h2>
        <IonList>
          {users.map(u => (
            <IonItem key={u.id}>
              <IonLabel>
                <h2>{u.username}</h2>
                <p>Joined {new Date(u.created_at).toLocaleDateString()}</p>
              </IonLabel>
              <IonNote slot="end" color={u.role === 'admin' ? 'primary' : 'medium'}>{u.role}</IonNote>
              <IonButton slot="end" fill="clear" onClick={() => toggleRole(u.id, u.role)}>
                {u.role === 'admin' ? 'Demote' : 'Promote'}
              </IonButton>
              {u.id !== user?.id && (
                <IonButton slot="end" fill="clear" color="danger" onClick={() => deleteUser(u.id)}>Delete</IonButton>
              )}
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
}
