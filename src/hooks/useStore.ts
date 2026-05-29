import { useState, useEffect, useCallback } from 'react';
import { AppState, PurchaseRequest, PurchaseOrder } from '../types';

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

  // Auto-save debounced
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setIsSaved(true);
      } catch (e) {
        console.error('Failed to save state', e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  const forceSave = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setIsSaved(true);
    } catch (e) {
      console.error('Failed to force save', e);
    }
  }, [state]);

  const createBackup = useCallback(() => {
    try {
      const backupState = { ...state, lastBackupDate: new Date().toISOString() };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(backupState));
      setState(backupState);
    } catch (e) {
      console.error('Failed to create backup', e);
    }
  }, [state]);

  const loadBackup = useCallback(() => {
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        setState(JSON.parse(backup));
      }
    } catch (e) {
      console.error('Failed to load backup', e);
    }
  }, []);
  
  const clearData = useCallback(() => {
    if (confirm('Tem certeza que deseja apagar todos os dados atuais? O backup não será apagado.')) {
      setState(defaultState);
    }
  }, []);

  const setPurchaseRequests = (requests: PurchaseRequest[]) => {
    setState((prev) => ({ ...prev, purchaseRequests: requests }));
    setIsSaved(false);
  };

  const setPurchaseOrders = (orders: PurchaseOrder[]) => {
    setState((prev) => ({ ...prev, purchaseOrders: orders }));
    setIsSaved(false);
  };

  const addPurchaseRequests = (requests: PurchaseRequest[]) => {
    setState((prev) => {
      const existingMap = new Map(prev.purchaseRequests.map(r => [r.id, r]));
      requests.forEach(r => existingMap.set(r.id, r));
      return { ...prev, purchaseRequests: Array.from(existingMap.values()) };
    });
    setIsSaved(false);
  };

  const addPurchaseOrders = (orders: PurchaseOrder[]) => {
    setState((prev) => {
      const existingMap = new Map(prev.purchaseOrders.map(o => [o.id, o]));
      orders.forEach(o => existingMap.set(o.id, o));
      return { ...prev, purchaseOrders: Array.from(existingMap.values()) };
    });
    setIsSaved(false);
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
