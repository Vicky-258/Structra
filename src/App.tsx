import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './index.css';

type DatasetRecord = Record<string, string>;

interface ToastInfo {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

function App() {
  const [data, setData] = useState<DatasetRecord[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [newColumnName, setNewColumnName] = useState('');
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [deleteColName, setDeleteColName] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  
  // Undo/Redo state for cell edits
  const [cellHistory, setCellHistory] = useState<DatasetRecord[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [editingCellState, setEditingCellState] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const showToast = (message: string, type: ToastInfo['type'] = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const computeColumns = (records: DatasetRecord[]) => {
    const cols = new Set<string>();
    records.forEach(row => {
      Object.keys(row).forEach(key => cols.add(key));
    });
    const colArray = Array.from(cols);
    setColumns(colArray);
    
    // Reset selections if they are no longer valid
    if (colArray.length > 0) {
      if (!colArray.includes(renameFrom)) setRenameFrom(colArray[0]);
      if (!colArray.includes(deleteColName)) setDeleteColName(colArray[0]);
    }
  };

  const loadData = async () => {
    try {
      const records: DatasetRecord[] = await invoke('load_data');
      setData(records);
      computeColumns(records);
      setCellHistory([JSON.parse(JSON.stringify(records))]);
      setHistoryIndex(0);
    } catch (err) {
      showToast(String(err), 'error');
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const restoredData = JSON.parse(JSON.stringify(cellHistory[newIndex]));
      setData(restoredData);
      computeColumns(restoredData);
      showToast('Undo successful', 'info');
    }
  };

  const handleRedo = () => {
    if (historyIndex < cellHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const restoredData = JSON.parse(JSON.stringify(cellHistory[newIndex]));
      setData(restoredData);
      computeColumns(restoredData);
      showToast('Redo successful', 'info');
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [historyIndex, cellHistory]);

  const saveData = async () => {
    try {
      await invoke('save_data', { records: data });
      showToast('Saved JSON successfully!', 'success');
    } catch (err) {
      showToast(String(err), 'error');
    }
  };

  const exportJsonl = async () => {
    try {
      await invoke('export_jsonl', { records: data });
      showToast('Exported JSONL successfully!', 'success');
    } catch (err) {
      showToast(String(err), 'error');
    }
  };

  const clearData = async () => {
    if (!confirm('Are you sure you want to clear the dataset?')) return;
    try {
      await invoke('clear_data');
      setData([]);
      setColumns([]);
      showToast('Dataset cleared!', 'warning');
    } catch (err) {
      showToast(String(err), 'error');
    }
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    if (columns.includes(newColumnName)) {
      showToast('Column already exists', 'error');
      return;
    }
    
    const newData = data.length > 0 ? data.map(row => ({ ...row, [newColumnName]: '' })) : [{ [newColumnName]: '' }];
    setData(newData);
    computeColumns(newData);
    showToast(`Added column: ${newColumnName}`, 'success');
    setNewColumnName('');
  };

  const handleRenameColumn = () => {
    if (!renameFrom || !renameTo.trim()) return;
    if (columns.includes(renameTo)) {
      showToast('Destination column already exists', 'error');
      return;
    }

    const newData = data.map(row => {
      const newRow = { ...row };
      newRow[renameTo] = newRow[renameFrom];
      delete newRow[renameFrom];
      return newRow;
    });

    setData(newData);
    computeColumns(newData);
    showToast(`Renamed ${renameFrom} → ${renameTo}`, 'success');
    setRenameFrom('');
    setRenameTo('');
  };

  const handleDeleteColumn = () => {
    if (!deleteColName) return;
    
    const newData = data.map(row => {
      const newRow = { ...row };
      delete newRow[deleteColName];
      return newRow;
    });

    setData(newData);
    computeColumns(newData);
    showToast(`Deleted ${deleteColName}`, 'warning');
    if (newData.length === 0 || Object.keys(newData[0]).length === 0) {
      setData([]);
      setColumns([]);
    }
  };

  const handleCellChange = (rowIndex: number, colKey: string, value: string) => {
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [colKey]: value };
    setData(newData);
  };

  const handleCellFocus = (value: string) => {
    setEditingCellState(value);
  };

  const handleCellBlur = (currentValue: string) => {
    if (editingCellState !== null && editingCellState !== currentValue) {
      const newHistory = cellHistory.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(data)));
      if (newHistory.length > 50) newHistory.shift();
      setCellHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    setEditingCellState(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    const key = e.key;
    const target = e.target as HTMLInputElement;
    
    let nextRow = rowIndex;
    let nextCol = colIndex;

    if (key === 'ArrowUp') {
      nextRow = Math.max(0, rowIndex - 1);
    } else if (key === 'ArrowDown' || key === 'Enter') {
      nextRow = Math.min(data.length - 1, rowIndex + 1);
    } else if (key === 'ArrowLeft') {
      if (target.selectionStart === 0) {
        nextCol = Math.max(0, colIndex - 1);
      } else {
        return;
      }
    } else if (key === 'ArrowRight') {
      if (target.selectionEnd === target.value.length) {
        nextCol = Math.min(columns.length - 1, colIndex + 1);
      } else {
        return;
      }
    } else {
      return;
    }

    if (nextRow !== rowIndex || nextCol !== colIndex) {
      e.preventDefault();
      const id = `cell-${nextRow}-${nextCol}`;
      const el = document.getElementById(id);
      if (el) {
        el.focus();
      }
    }
  };

  const handleAddRow = () => {
    const newRow: DatasetRecord = {};
    columns.forEach(col => newRow[col] = '');
    setData([...data, newRow]);
  };
  
  const handleDeleteRow = (rowIndex: number) => {
    const newData = data.filter((_, idx) => idx !== rowIndex);
    setData(newData);
  };

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <div className={`sidebar ${!isSidebarOpen ? 'closed' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.png" alt="Structra Logo" style={{ width: '32px', height: '32px', borderRadius: '6px' }} />
          <div>
            <h1 style={{ marginBottom: 0, lineHeight: 1 }}>Structra</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.125rem' }}>DATASET WORKSPACE</p>
          </div>
        </div>
        
        <div className="sidebar-content">
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-value">{data.length}</span>
              <span className="metric-label">Rows</span>
            </div>
            <div className="metric-card">
              <span className="metric-value">{columns.length}</span>
              <span className="metric-label">Columns</span>
            </div>
          </div>
          
          <div className="control-group" style={{ marginTop: '2rem' }}>
            <button onClick={exportJsonl} style={{ marginBottom: '1rem' }}>
              Export JSONL
            </button>
            <button onClick={clearData} className="btn-danger">
              Clear Dataset
            </button>
          </div>

          <h2>Add Column</h2>
          <div className="control-group">
            <input 
              type="text" 
              placeholder="Column Name" 
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              style={{ marginBottom: '0.5rem' }}
            />
            <button onClick={handleAddColumn}>Add Column</button>
          </div>

          {columns.length > 0 && (
            <>
              <h2>Rename Column</h2>
              <div className="control-group">
                <select 
                  value={renameFrom} 
                  onChange={(e) => setRenameFrom(e.target.value)}
                  style={{ marginBottom: '0.5rem' }}
                >
                  <option value="" disabled>Select Column</option>
                  {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
                <input 
                  type="text" 
                  placeholder="New Name" 
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  style={{ marginBottom: '0.5rem' }}
                />
                <button onClick={handleRenameColumn}>Rename Column</button>
              </div>

              <h2>Delete Column</h2>
              <div className="control-group">
                <select 
                  value={deleteColName} 
                  onChange={(e) => setDeleteColName(e.target.value)}
                  style={{ marginBottom: '0.5rem' }}
                >
                  <option value="" disabled>Select Column</option>
                  {columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
                <button onClick={handleDeleteColumn} className="btn-danger">Delete Column</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* MAIN EDITOR */}
      <div className="main-content">
        <div className="main-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button 
              className="sidebar-toggle" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle Sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
            </button>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              &gt; dataset.json
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={handleAddRow} style={{ padding: '0.5rem 1rem', width: 'auto' }}>
              + Add Row
            </button>
            <button onClick={saveData} className="btn-primary" style={{ padding: '0.5rem 1.5rem', width: 'auto' }}>
              Save Changes
            </button>
          </div>
        </div>
        
        <div className="editor-container">
          {data.length === 0 && columns.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
              <p>NO DATASET LOADED</p>
              <span style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Add a column to get started</span>
            </div>
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    {columns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {rowIndex + 1}
                      </td>
                      {columns.map((col, colIndex) => (
                        <td key={col}>
                          <input 
                            id={`cell-${rowIndex}-${colIndex}`}
                            type="text" 
                            value={row[col] || ''} 
                            onChange={(e) => handleCellChange(rowIndex, col, e.target.value)}
                            onFocus={(e) => handleCellFocus(e.target.value)}
                            onBlur={(e) => handleCellBlur(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="row-delete-btn" 
                          onClick={() => handleDeleteRow(rowIndex)}
                          title="Delete Row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* TOASTS */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
