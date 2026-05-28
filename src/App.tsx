import React, { useState } from 'react';
import { useStore } from './hooks/useStore';
import { Dashboard } from './components/Dashboard';
import { ImportData } from './components/ImportData';
import { DataTable } from './components/DataTable';
import { 
  BarChart3, 
  Upload, 
  FileText, 
  ShoppingCart, 
  Save, 
  HardDriveDownload,
  AlertTriangle,
  Menu,
  X
} from 'lucide-react';

type View = 'dashboard' | 'import' | 'sc' | 'pc';

export default function App() {
  const { state, isSaved, forceSave, createBackup, loadBackup, clearData, addPurchaseRequests, addPurchaseOrders } = useStore();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-indigo-900 text-white p-4 flex justify-between items-center z-20 shadow-md">
        <h1 className="font-bold text-lg tracking-tight">Protheus SC/PC</h1>
        <button onClick={toggleSidebar} className="p-1 focus:outline-none focus:ring-2 focus:ring-white rounded">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transition-transform duration-300 ease-in-out
        fixed md:static inset-y-0 left-0 w-64 bg-indigo-900 text-white flex flex-col z-10 shadow-xl md:shadow-none
      `}>
        <div className="p-6 hidden md:block">
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
            Protheus Monitor
          </h1>
          <p className="text-indigo-300 text-xs font-medium tracking-wide">MATA110 & MATA121</p>
        </div>

        <div className="flex-1 px-4 py-6 md:py-2 space-y-1 overflow-y-auto">
          <button
            onClick={() => { setCurrentView('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === 'dashboard' ? 'bg-indigo-800 shadow-inner text-white' : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'}`}
          >
            <BarChart3 className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </button>
          
          <button
            onClick={() => { setCurrentView('import'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === 'import' ? 'bg-indigo-800 shadow-inner text-white' : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'}`}
          >
            <Upload className="w-5 h-5" />
            <span className="font-medium">Importar Dados</span>
          </button>

          <div className="pt-4 pb-2 px-4">
             <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Consultas</p>
          </div>

          <button
            onClick={() => { setCurrentView('sc'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === 'sc' ? 'bg-indigo-800 shadow-inner text-white' : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'}`}
          >
            <FileText className="w-5 h-5" />
            <div className="flex-1 text-left">
              <span className="font-medium block">Solicitações</span>
              <span className="text-xs opacity-70">MATA110</span>
            </div>
            {state.purchaseRequests.length > 0 && (
              <span className="bg-indigo-700 text-xs py-0.5 px-2 rounded-full">{state.purchaseRequests.length}</span>
            )}
          </button>

          <button
            onClick={() => { setCurrentView('pc'); setSidebarOpen(false); }}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${currentView === 'pc' ? 'bg-indigo-800 shadow-inner text-white' : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'}`}
          >
            <ShoppingCart className="w-5 h-5" />
            <div className="flex-1 text-left">
              <span className="font-medium block">Pedidos</span>
              <span className="text-xs opacity-70">MATA121</span>
            </div>
            {state.purchaseOrders.length > 0 && (
              <span className="bg-indigo-700 text-xs py-0.5 px-2 rounded-full">{state.purchaseOrders.length}</span>
            )}
          </button>
        </div>

        <div className="p-4 bg-indigo-950/50 space-y-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-indigo-300 font-medium">Auto-save Local</span>
            <div className={`w-2 h-2 rounded-full ${isSaved ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} title={isSaved ? 'Sincronizado' : 'Salvando...'}></div>
          </div>
          
          <button 
             onClick={forceSave}
             className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-800 hover:bg-indigo-700 active:bg-indigo-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Agora</span>
          </button>

          <div className="pt-2 border-t border-indigo-800/50 grid grid-cols-2 gap-2">
             <button
                onClick={createBackup}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-900/50 hover:bg-indigo-800 border border-indigo-700 transition"
                title="Criar Ponto de Restauração"
             >
                <HardDriveDownload className="w-4 h-4 text-indigo-300 mb-1" />
                <span className="text-[10px] text-indigo-200">Fazer Backup</span>
             </button>
              <button
                onClick={clearData}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-indigo-900/50 hover:bg-rose-900/50 hover:border-rose-700/50 border border-indigo-700 transition group"
                title="Apagar dados atuais"
             >
                <AlertTriangle className="w-4 h-4 text-indigo-300 group-hover:text-rose-400 mb-1" />
                <span className="text-[10px] text-indigo-200 group-hover:text-rose-300">Limpar Dados</span>
             </button>
          </div>
          {state.lastBackupDate && (
             <p className="text-[10px] text-indigo-400 text-center px-1">
                Último backup: {new Date(state.lastBackupDate).toLocaleTimeString('pt-BR')}
             </p>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
         {/* Overlay for mobile sidebar */}
         {isSidebarOpen && (
           <div className="fixed inset-0 bg-black/50 z-0 md:hidden" onClick={() => setSidebarOpen(false)}></div>
         )}

        <header className="bg-white border-b border-slate-200 p-4 md:p-6 lg:px-8 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
              {currentView === 'dashboard' && 'Dashboard Gerencial'}
              {currentView === 'import' && 'Importação de Dados'}
              {currentView === 'sc' && 'Monitor de SC (MATA110)'}
              {currentView === 'pc' && 'Monitor de PC (MATA121)'}
            </h2>
          </div>
          
           <div className="hidden md:flex items-center space-x-3">
              <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-2 border
                 ${isSaved ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}
              `}>
                <div className={`w-2 h-2 rounded-full ${isSaved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                <span>{isSaved ? 'Sincronizado' : 'Mudanças Pendentes'}</span>
              </div>
           </div>
        </header>

        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {currentView === 'dashboard' && <Dashboard state={state} />}
          
          {currentView === 'import' && (
             <ImportData 
               onImportSC={(data) => {
                  addPurchaseRequests(data);
                  setCurrentView('sc');
               }} 
               onImportPC={(data) => {
                  addPurchaseOrders(data);
                  setCurrentView('pc');
               }} 
             />
          )}

          {currentView === 'sc' && (
             <div className="h-full">
                <DataTable type="sc" data={state.purchaseRequests} />
             </div>
          )}

          {currentView === 'pc' && (
             <div className="h-full">
                <DataTable type="pc" data={state.purchaseOrders} />
             </div>
          )}
        </div>
      </main>
    </div>
  );
}
