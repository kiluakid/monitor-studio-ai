import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, PurchaseRequest, PurchaseOrder } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const STORAGE_KEY = 'protheus_monitor_data_v2';
const BACKUP_KEY = 'protheus_monitor_backup_v2';

const defaultState: AppState = {
  purchaseRequests: [],
  purchaseOrders: [],
  lastBackupDate: null,
};

export function useStore() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : defaultState;
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
      return defaultState;
    }
  });
  const [isSaved, setIsSaved] = useState(true);

  // Auto-save local
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Failed to save state locally', e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  // Load from Firebase
  useEffect(() => {
    let unsubscribeRequests = () => {};
    let unsubscribeOrders = () => {};

    try {
      unsubscribeRequests = onSnapshot(collection(db, 'purchaseRequests'), (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRequest));
        if (requests.length > 0 || snapshot.metadata.fromCache === false) {
           setState(prev => ({ ...prev, purchaseRequests: requests }));
        }
      }, (error) => {
        console.error('Error listening to requests:', error);
      });

      unsubscribeOrders = onSnapshot(collection(db, 'purchaseOrders'), (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
        if (orders.length > 0 || snapshot.metadata.fromCache === false) {
           setState(prev => ({ ...prev, purchaseOrders: orders }));
        }
      }, (error) => {
        console.error('Error listening to orders:', error);
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
  
  const sanitizeId = (id: string) => {
    return String(id).replace(/[\/#\.\[\]]/g, '_').substring(0, 128);
  };

  const sanitizeForFirebase = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForFirebase);
    } else if (obj !== null && typeof obj === 'object') {
      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          const cleanKey = String(key).replace(/[\.\/#\[\]~*]/g, '_');
          newObj[cleanKey] = sanitizeForFirebase(value);
        }
      }
      return newObj;
    }
    return obj;
  };

  const executeInBatches = async (items: any[], docCollection: string) => {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(item => {
        batch.set(doc(db, docCollection, sanitizeId(item.id)), sanitizeForFirebase(item));
      });
      await batch.commit();
    }
  };

  const clearData = useCallback(async () => {
    if (confirm('Tem certeza que deseja apagar todos os dados de todos os dispositivos?')) {
      setState(defaultState);
      try {
        const CHUNK_SIZE = 400;
        let batch = writeBatch(db);
        let count = 0;
        
        for (const req of state.purchaseRequests) {
          batch.delete(doc(db, 'purchaseRequests', sanitizeId(req.id)));
          count++;
          if (count === CHUNK_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        for (const ord of state.purchaseOrders) {
          batch.delete(doc(db, 'purchaseOrders', sanitizeId(ord.id)));
          count++;
          if (count === CHUNK_SIZE) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      } catch (e) {
        console.error('Error clearing data', e);
      }
    }
  }, [state]);

  const setPurchaseRequests = async (requests: PurchaseRequest[]) => {
    setIsSaved(false);
    setState(prev => ({ ...prev, purchaseRequests: requests }));
    try {
      await executeInBatches(requests, 'purchaseRequests');
      setIsSaved(true);
    } catch (e) {
      console.error('Error setting requests', e);
      throw e;
    }
  };

  const setPurchaseOrders = async (orders: PurchaseOrder[]) => {
    setIsSaved(false);
    setState(prev => ({ ...prev, purchaseOrders: orders }));
    try {
      await executeInBatches(orders, 'purchaseOrders');
      setIsSaved(true);
    } catch (e) {
      console.error('Error setting orders', e);
      throw e;
    }
  };

  const addPurchaseRequests = async (requests: PurchaseRequest[]) => {
    setIsSaved(false);
    setState(prev => {
      const existingMap = new Map(prev.purchaseRequests.map(r => [r.id, r]));
      requests.forEach(r => existingMap.set(r.id, r));
      return { ...prev, purchaseRequests: Array.from(existingMap.values()) };
    });
    try {
      await executeInBatches(requests, 'purchaseRequests');
      setIsSaved(true);
    } catch (e) {
      console.error('Error adding requests', e);
      throw e;
    }
  };

  const addPurchaseOrders = async (orders: PurchaseOrder[]) => {
    setIsSaved(false);
    setState(prev => {
      const existingMap = new Map(prev.purchaseOrders.map(o => [o.id, o]));
      orders.forEach(o => existingMap.set(o.id, o));
      return { ...prev, purchaseOrders: Array.from(existingMap.values()) };
    });
    try {
      await executeInBatches(orders, 'purchaseOrders');
      setIsSaved(true);
    } catch (e) {
      console.error('Error adding orders', e);
      throw e;
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
