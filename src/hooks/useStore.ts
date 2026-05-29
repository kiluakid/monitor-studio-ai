import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, PurchaseRequest, PurchaseOrder } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const BACKUP_KEY = 'protheus_monitor_backup_v2';

const defaultState: AppState = {
  purchaseRequests: [],
  purchaseOrders: [],
  lastBackupDate: null,
};

export function useStore() {
  const [state, setState] = useState<AppState>(defaultState);
  const [isSaved, setIsSaved] = useState(true);

  // Load from Firebase
  useEffect(() => {
    let unsubscribeRequests = () => {};
    let unsubscribeOrders = () => {};

    try {
      unsubscribeRequests = onSnapshot(collection(db, 'purchaseRequests'), (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRequest));
        setState(prev => ({ ...prev, purchaseRequests: requests }));
      });

      unsubscribeOrders = onSnapshot(collection(db, 'purchaseOrders'), (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
        setState(prev => ({ ...prev, purchaseOrders: orders }));
      });
    } catch (e) {
      console.error('Failed to attach listeners', e);
    }

    return () => {
      unsubscribeRequests();
      unsubscribeOrders();
    };
  }, []);

  const forceSave = useCallback(() => {
    // With real-time sync, force save visually does nothing, since it's saved automatically
    setIsSaved(true);
  }, []);

  const createBackup = useCallback(() => {
    try {
      const backupState = { ...state, lastBackupDate: new Date().toISOString() };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backupState));
      setState(prev => ({ ...prev, lastBackupDate: backupState.lastBackupDate }));
    } catch (e) {
      console.error('Failed to create backup', e);
    }
  }, [state]);

  const loadBackup = useCallback(() => {
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        const backupState = JSON.parse(backup);
        // Need to restore all these to firebase
        setPurchaseRequests(backupState.purchaseRequests || []);
        setPurchaseOrders(backupState.purchaseOrders || []);
      }
    } catch (e) {
      console.error('Failed to load backup', e);
    }
  }, []);
  
  const clearData = useCallback(async () => {
    if (confirm('Tem certeza que deseja apagar todos os dados de todos os dispositivos?')) {
      const batch = writeBatch(db);
      state.purchaseRequests.forEach(req => {
        batch.delete(doc(db, 'purchaseRequests', String(req.id)));
      });
      state.purchaseOrders.forEach(ord => {
        batch.delete(doc(db, 'purchaseOrders', String(ord.id)));
      });
      try {
        await batch.commit();
      } catch (e) {
        console.error('Error clearing data', e);
      }
    }
  }, [state]);

  const setPurchaseRequests = async (requests: PurchaseRequest[]) => {
    setIsSaved(false);
    const batch = writeBatch(db);
    
    // In a real scenario we might delete all existing docs first, 
    // but here we just overwrite/update provided.
    requests.forEach(req => {
      batch.set(doc(db, 'purchaseRequests', String(req.id)), req);
    });
    
    try {
      await batch.commit();
      setIsSaved(true);
    } catch (e) {
      console.error('Error setting requests', e);
    }
  };

  const setPurchaseOrders = async (orders: PurchaseOrder[]) => {
    setIsSaved(false);
    const batch = writeBatch(db);
    orders.forEach(ord => {
      batch.set(doc(db, 'purchaseOrders', String(ord.id)), ord);
    });
    
    try {
      await batch.commit();
      setIsSaved(true);
    } catch (e) {
      console.error('Error setting orders', e);
    }
  };

  const addPurchaseRequests = async (requests: PurchaseRequest[]) => {
    setIsSaved(false);
    const batch = writeBatch(db);
    requests.forEach(req => {
       batch.set(doc(db, 'purchaseRequests', String(req.id)), req);
    });
    try {
      await batch.commit();
      setIsSaved(true);
    } catch (e) {
      console.error('Error adding requests', e);
    }
  };

  const addPurchaseOrders = async (orders: PurchaseOrder[]) => {
    setIsSaved(false);
    const batch = writeBatch(db);
    orders.forEach(ord => {
       batch.set(doc(db, 'purchaseOrders', String(ord.id)), ord);
    });
    try {
      await batch.commit();
      setIsSaved(true);
    } catch (e) {
      console.error('Error adding orders', e);
    }
  };

  return {
    state,
    isSaved,
    forceSave,
    createBackup,
    loadBackup,
    clearData,
    setPurchaseRequests,
    setPurchaseOrders,
    addPurchaseRequests,
    addPurchaseOrders
  };
}
