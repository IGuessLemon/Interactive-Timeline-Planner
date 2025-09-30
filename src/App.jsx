import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, Upload, FileDown, ChevronUp, ChevronDown, ZoomIn, ZoomOut, Move } from 'lucide-react';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [editingTask, setEditingTask] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState(null);
  
  const timelineRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('routineMaker');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setTasks(data.tasks || data);
        if (data.zoomLevel) setZoomLevel(data.zoomLevel);
        if (data.panOffset) setPanOffset(data.panOffset);
      } catch (e) {
        console.error('Error loading data');
      }
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('routineMaker', JSON.stringify({ tasks, zoomLevel, panOffset }));
  }, [tasks, zoomLevel, panOffset]);

  const addTask = () => {
    const newTask = {
      id: Date.now(),
      name: 'New Task',
      start: 12,
      duration: 1,
      color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
    };
    setTasks([...tasks, newTask]);
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const moveTask = (id, direction) => {
    const index = tasks.findIndex(t => t.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === tasks.length - 1)) return;
    
    const newTasks = [...tasks];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newTasks[index], newTasks[newIndex]] = [newTasks[newIndex], newTasks[index]];
    setTasks(newTasks);
  };

  const updateTaskName = (id, name) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, name } : t));
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.25, 4));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.max(0.25, Math.min(4, prev + delta)));
    }
  };

  const handlePanStart = (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handlePanMove = (e) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  const getTimeFromPosition = (clientX) => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = (clientX - rect.left) / zoomLevel;
    const timelineWidth = rect.width / zoomLevel;
    const hour = (x / timelineWidth) * 24;
    return Math.max(0, Math.min(24, hour));
  };

  const handleMouseDown = (e, task, type) => {
    e.stopPropagation();
    const startTime = getTimeFromPosition(e.clientX);
    
    setDragState({
      task,
      type,
      startX: e.clientX,
      startTime,
      originalStart: task.start,
      originalDuration: task.duration
    });
  };

  const handleMouseMove = (e) => {
    if (!dragState) return;

    const currentTime = getTimeFromPosition(e.clientX);
    const { task, type, originalStart, originalDuration, startTime } = dragState;

    if (type === 'move') {
      const timeDiff = currentTime - startTime;
      let newStart = originalStart + timeDiff;
      newStart = Math.max(0, Math.min(24 - task.duration, newStart));
      
      setTasks(tasks.map(t => 
        t.id === task.id ? { ...t, start: newStart } : t
      ));
    } else if (type === 'resize-left') {
      const timeDiff = currentTime - originalStart;
      let newStart = originalStart + timeDiff;
      let newDuration = originalDuration - timeDiff;
      
      if (newStart < 0) {
        newDuration += newStart;
        newStart = 0;
      }
      
      if (newDuration < 0.25) {
        newStart = originalStart + originalDuration - 0.25;
        newDuration = 0.25;
      }
      
      setTasks(tasks.map(t => 
        t.id === task.id ? { ...t, start: newStart, duration: newDuration } : t
      ));
    } else if (type === 'resize-right') {
      let newDuration = currentTime - task.start;
      newDuration = Math.max(0.25, Math.min(24 - task.start, newDuration));
      
      setTasks(tasks.map(t => 
        t.id === task.id ? { ...t, duration: newDuration } : t
      ));
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  useEffect(() => {
    if (dragState || isPanning) {
      window.addEventListener('mousemove', isPanning ? handlePanMove : handleMouseMove);
      window.addEventListener('mouseup', isPanning ? handlePanEnd : handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', isPanning ? handlePanMove : handleMouseMove);
        window.removeEventListener('mouseup', isPanning ? handlePanEnd : handleMouseUp);
      };
    }
  }, [dragState, isPanning, panStart, panOffset]);

  const exportProject = () => {
    const dataStr = JSON.stringify({ tasks, zoomLevel, panOffset }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `routine-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        setTasks(imported.tasks || imported);
        if (imported.zoomLevel) setZoomLevel(imported.zoomLevel);
        if (imported.panOffset) setPanOffset(imported.panOffset);
      } catch (error) {
        alert('Invalid file format');
      }
    };
    reader.readAsText(file);
  };

  const downloadImage = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1400;
    canvas.height = 120 + tasks.length * 70;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Daily Routine Timeline', 30, 35);
    ctx.font = '13px sans-serif';
    ctx.fillText(new Date().toLocaleString(), 30, 55);
    
    const hourWidth = (canvas.width - 250) / 24;
    
    for (let i = 0; i <= 24; i++) {
      const x = 200 + i * hourWidth;
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x, canvas.height - 20);
      ctx.stroke();
      
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i}:00`, x, 75);
    }
    
    tasks.forEach((task, index) => {
      const y = 90 + index * 70;
      const x = 200 + task.start * hourWidth;
      const width = task.duration * hourWidth;
      
      ctx.fillStyle = task.color;
      ctx.fillRect(x, y, width, 50);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(task.name, x + 10, y + 25);
      ctx.font = '11px sans-serif';
      ctx.fillText(`${task.start.toFixed(1)}:00 - ${(task.start + task.duration).toFixed(1)}:00`, x + 10, y + 42);
    });
    
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `routine-${new Date().toISOString().split('T')[0]}.png`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Tasks</h2>
          <button
            onClick={addTask}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            <Plus size={20} /> Add Task
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  {editingTask === task.id ? (
                    <input
                      type="text"
                      value={task.name}
                      onChange={(e) => updateTaskName(task.id, e.target.value)}
                      onBlur={() => setEditingTask(null)}
                      onKeyPress={(e) => e.key === 'Enter' && setEditingTask(null)}
                      className="w-full px-2 py-1 text-sm font-semibold border border-gray-300 rounded"
                      autoFocus
                    />
                  ) : (
                    <div
                      onClick={() => setEditingTask(task.id)}
                      className="text-sm font-semibold text-gray-800 cursor-pointer hover:text-blue-600"
                    >
                      {task.name}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    {task.start.toFixed(1)}:00 - {(task.start + task.duration).toFixed(1)}:00 ({task.duration.toFixed(1)}h)
                  </div>
                  <input
                    type="color"
                    value={task.color}
                    onChange={(e) => setTasks(tasks.map(t => t.id === task.id ? { ...t, color: e.target.value } : t))}
                    className="mt-2 w-8 h-8 rounded cursor-pointer"
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveTask(task.id, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    onClick={() => moveTask(task.id, 'down')}
                    disabled={index === tasks.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 border-t border-gray-200 space-y-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition cursor-pointer">
            <Upload size={18} /> Import
            <input type="file" accept=".json" onChange={importProject} className="hidden" />
          </label>
          <button
            onClick={exportProject}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
          >
            <Download size={18} /> Export
          </button>
          <button
            onClick={downloadImage}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
          >
            <FileDown size={18} /> Download Image
          </button>
        </div>
      </div>

      {/* Main Timeline */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Daily Routine Planner</h1>
              <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleZoomOut}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                title="Zoom Out"
              >
                <ZoomOut size={20} />
              </button>
              <span className="text-sm font-medium text-gray-600 min-w-[70px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                title="Zoom In"
              >
                <ZoomIn size={20} />
              </button>
              <button
                onClick={resetView}
                className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition ml-2"
                title="Reset View"
              >
                <Move size={20} />
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Hold Shift + Drag to pan | Ctrl/Cmd + Scroll to zoom | Middle-click to pan
          </p>
        </div>

        {/* Timeline Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-hidden bg-gray-100 relative cursor-pointer"
          onWheel={handleWheel}
          onMouseDown={handlePanStart}
          style={{ cursor: isPanning ? 'grabbing' : dragState ? 'default' : 'grab' }}
        >
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: '0 0',
              width: '1200px',
              minHeight: '600px',
              padding: '40px',
            }}
          >
            {/* Hour markers */}
            <div className="flex mb-6 relative" ref={timelineRef} style={{ width: '100%' }}>
              {Array.from({ length: 25 }, (_, i) => (
                <div key={i} className="flex-1 text-center relative">
                  <span className="text-xs text-gray-600 font-medium">{i}:00</span>
                  {i < 24 && (
                    <div className="absolute top-6 left-0 w-px h-full bg-gray-300" style={{ height: '500px' }} />
                  )}
                </div>
              ))}
            </div>

            {/* Tasks Timeline */}
            <div className="relative" style={{ minHeight: `${tasks.length * 80}px` }}>
              {tasks.map((task, index) => {
                const leftPercent = (task.start / 24) * 100;
                const widthPercent = (task.duration / 24) * 100;

                return (
                  <div
                    key={task.id}
                    className="absolute rounded-lg shadow-lg hover:shadow-xl transition-shadow"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      top: `${index * 80}px`,
                      height: '60px',
                      backgroundColor: task.color,
                      cursor: dragState?.task.id === task.id ? 'grabbing' : 'grab',
                    }}
                    onMouseDown={(e) => handleMouseDown(e, task, 'move')}
                  >
                    {/* Left resize handle */}
                    <div
                      className="absolute left-0 top-0 w-3 h-full cursor-ew-resize hover:bg-black hover:bg-opacity-20 transition"
                      onMouseDown={(e) => handleMouseDown(e, task, 'resize-left')}
                      style={{ zIndex: 10 }}
                    />

                    {/* Task content */}
                    <div className="px-4 py-3 text-white h-full flex flex-col justify-center pointer-events-none">
                      <div className="font-bold text-sm truncate">{task.name}</div>
                      <div className="text-xs opacity-90 mt-1">
                        {task.start.toFixed(1)}:00 - {(task.start + task.duration).toFixed(1)}:00
                      </div>
                    </div>

                    {/* Right resize handle */}
                    <div
                      className="absolute right-0 top-0 w-3 h-full cursor-ew-resize hover:bg-black hover:bg-opacity-20 transition"
                      onMouseDown={(e) => handleMouseDown(e, task, 'resize-right')}
                      style={{ zIndex: 10 }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};