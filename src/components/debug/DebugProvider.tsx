import { createContext, useContext, useState, ReactNode } from 'react';
import { AlertTriangle, X, Terminal } from 'lucide-react';

export interface DebugLog {
  id: string;
  message: string;
  details?: any;
  timestamp: Date;
  type: 'error' | 'info';
}

interface DebugContextType {
  logs: DebugLog[];
  logError: (message: string, details?: any) => void;
  logInfo: (message: string, details?: any) => void;
  clearLogs: () => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export function DebugProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // In production, we might want to disable this or hide it
  // @ts-ignore
  const isDevelopment = import.meta.env.MODE === 'development';

  const addLog = (message: string, details: any, type: 'error' | 'info') => {
    const newLog: DebugLog = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      details,
      timestamp: new Date(),
      type
    };
    console[type](message, details); // Also log to console
    setLogs((prev) => [newLog, ...prev]);
  };

  const logError = (message: string, details?: any) => addLog(message, details, 'error');
  const logInfo = (message: string, details?: any) => addLog(message, details, 'info');
  const clearLogs = () => setLogs([]);

  return (
    <DebugContext.Provider value={{ logs, logError, logInfo, clearLogs }}>
      {children}
      
      {/* Floating Debug Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 left-4 z-50 p-3 rounded-full shadow-lg text-white transition-colors ${
          logs.some(l => l.type === 'error') ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-gray-800 hover:bg-gray-900'
        }`}
        title="Debug Panel"
      >
        {logs.some(l => l.type === 'error') ? <AlertTriangle className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
      </button>

      {/* Debug Panel Overlay */}
      {isOpen && (
        <div className="fixed inset-y-0 left-0 w-96 max-w-[90vw] bg-gray-900 shadow-2xl z-50 flex flex-col font-mono text-sm border-r border-gray-700 transition-transform">
          <div className="p-4 bg-gray-950 border-b border-gray-800 flex justify-between items-center text-white">
            <h3 className="font-bold flex items-center gap-2">
              <Terminal className="w-4 h-4" /> 
              لوحة التصحيح والمراقبة 
              <span className="text-xs bg-gray-800 px-2 py-1 rounded-full">{logs.length}</span>
            </h3>
            <div className="flex items-center gap-3">
              <button onClick={clearLogs} className="text-gray-400 hover:text-white text-xs underline">مسح</button>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3" dir="ltr">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center mt-10">No logs yet...</div>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id} 
                  className={`p-3 rounded border ${
                    log.type === 'error' 
                      ? 'bg-red-900/20 border-red-800/50 text-red-200' 
                      : 'bg-gray-800/50 border-gray-700 text-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-xs opacity-75">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                      log.type === 'error' ? 'bg-red-800' : 'bg-gray-700'
                    }`}>
                      {log.type}
                    </span>
                  </div>
                  <div className="font-semibold">{log.message}</div>
                  {log.details && (
                    <pre className="mt-2 text-[10px] overflow-x-auto bg-black/40 p-2 rounded text-gray-400 max-h-40">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (context === undefined) {
    throw new Error('useDebug must be used within a DebugProvider');
  }
  return context;
}
