import React, { useState, useEffect } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonList, IonItem, IonLabel, IonNote, IonCard,
  IonCardHeader, IonCardTitle, IonCardContent
} from '@ionic/react';
import { api } from '../App';

interface Stats {
  users: number;
  scripts: number;
  admins: number;
}

interface User {
  id: string;
  username: string;
  role: string;
}

export default function Admin() {
  const [stats, setStats] = useState<Stats>({ users: 0, scripts: 0, admins: 0 });
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    api<{ stats: Stats }>('/admin/stats').then(res => {
      if (res.stats) setStats(res.stats);
    });
    api<{ users: User[] }>('/admin/users').then(res => {
      if (res.users) setUsers(res.users);
    });
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/dashboard" />
          </IonButtons>
          <IonTitle>Admin</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <IonCard style={{ flex: 1, margin: 0 }}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: 32 }}>{stats.users}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>Users</IonCardContent>
          </IonCard>
          <IonCard style={{ flex: 1, margin: 0 }}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: 32 }}>{stats.scripts}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>Scripts</IonCardContent>
          </IonCard>
          <IonCard style={{ flex: 1, margin: 0 }}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: 32 }}>{stats.admins}</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>Admins</IonCardContent>
          </IonCard>
        </div>

        <h2>Users</h2>
        <IonList>
          {users.map(user => (
            <IonItem key={user.id}>
              <IonLabel>{user.username}</IonLabel>
              <IonNote slot="end">{user.role}</IonNote>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
}
