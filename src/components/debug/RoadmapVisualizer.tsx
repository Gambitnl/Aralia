/**
 * @file RoadmapVisualizer.tsx
 * High-fidelity "Elastic" Roadmap Visualizer for Aralia RPG.
 */
import React, { useRef, useState, useEffect } from 'react';
import { motion, motionValue, useTransform } from 'framer-motion';

interface RoadmapNode {
  id: string;
  label: string;
  type: 'root' | 'project' | 'milestone' | 'task';
  status: 'done' | 'active' | 'planned';
  initialX: number;
  initialY: number;
  color: string;
  progress?: number;
  description?: string;
  link?: string;
  domain?: string;
  completedDate?: string;
  subNodes?: RoadmapNode[];
}

interface RoadmapEdge {
  from: string;
  to: string;
}

interface RoadmapData {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
}

type LayoutMode = 'manual' | 'timeline' | 'categorical' | 'spiral';
type TaxonomyMode = 'standard' | 'domain' | 'status';
type NavigationMode = 'canvas' | 'fog' | 'zoom';

const ElasticLine: React.FC<{ fromX: any, fromY: any, toX: any, toY: any, color: string, isActive: boolean, isHidden?: boolean }> = ({ fromX, fromY, toX, toY, color, isActive, isHidden }) => {
  const path = useTransform([fromX, fromY, toX, toY], ([fx, fy, tx, ty]) => {
    const midY = (Number(fy) + Number(ty)) / 2;
    return `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
  });

  if (isHidden) return null;

  return (
    <motion.path
      d={path}
      stroke={color}
      strokeWidth={isActive ? "4" : "2"}
      fill="none"
      strokeLinecap="round"
      style={{ 
        opacity: isActive ? 0.8 : 0.3,
        filter: isActive ? `drop-shadow(0 0 8px ${color})` : 'none',
        transition: 'stroke-width 0.3s, opacity 0.3s'
      }}
    />
  );
};

export const RoadmapVisualizer: React.FC = () => {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('manual');
  const [taxonomyMode, setTaxonomyMode] = useState<TaxonomyMode>('domain');
  const [navMode, setNavMode] = useState<NavigationMode>('canvas');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Canvas Pan State
  const canvasPanX = motionValue(0);
  const canvasPanY = motionValue(0);
  const canvasScale = motionValue(1);

  // Create a map of motion values for each node
  const nodePositions = useRef<Record<string, { x: any, y: any }>>({});

  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoom = (delta: number, mouseX?: number, mouseY?: number) => {
    const currentScale = canvasScale.get();
    const zoomFactor = delta > 0 ? 1.15 : 0.85; // Faster, snappier zoom
    const nextScale = Math.min(Math.max(currentScale * zoomFactor, 0.01), 10);
    
    if (mouseX !== undefined && mouseY !== undefined && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const cx = mouseX - rect.left;
      const cy = mouseY - rect.top;
      
      const panX = canvasPanX.get();
      const panY = canvasPanY.get();
      
      canvasPanX.set(cx - (cx - panX) * (nextScale / currentScale));
      canvasPanY.set(cy - (cy - panY) * (nextScale / currentScale));
    }
    
    canvasScale.set(nextScale);
    setZoomLevel(nextScale);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleZoom(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [data]); // Re-attach when data loads

  const applyLayout = (mode: LayoutMode, nodes: RoadmapNode[]) => {
    if (!nodes.length) return;

    switch (mode) {
      case 'timeline': {
        const sorted = [...nodes].sort((a, b) => {
          if (a.type === 'root') return -1;
          if (b.type === 'root') return 1;
          const da = a.completedDate ? new Date(a.completedDate).getTime() : 0;
          const db = b.completedDate ? new Date(b.completedDate).getTime() : 0;
          return da - db;
        });

        sorted.forEach((node, idx) => {
          const pos = nodePositions.current[node.id];
          if (pos) {
            pos.x.set(100 + idx * 300);
            pos.y.set(400 + (idx % 2 === 0 ? -150 : 150));
          }
        });
        break;
      }
      case 'categorical': {
        const domains = Array.from(new Set(nodes.map(n => n.domain || 'default')));
        domains.forEach((domain, dIdx) => {
          const domainNodes = nodes.filter(n => (n.domain || 'default') === domain);
          domainNodes.forEach((node, nIdx) => {
            const pos = nodePositions.current[node.id];
            if (pos) {
              pos.x.set(200 + dIdx * 450);
              pos.y.set(200 + nIdx * 180);
            }
          });
        });
        break;
      }
      case 'spiral': {
        nodes.forEach((node, idx) => {
          const pos = nodePositions.current[node.id];
          if (pos) {
            if (node.type === 'root') {
              pos.x.set(1000);
              pos.y.set(1000);
            } else {
              const angle = idx * 0.4;
              const radius = 200 + idx * 30;
              pos.x.set(1000 + Math.cos(angle) * radius);
              pos.y.set(1000 + Math.sin(angle) * radius);
            }
          }
        });
        break;
      }
      case 'manual':
        nodes.forEach(node => {
          const pos = nodePositions.current[node.id];
          if (pos) {
            pos.x.set(node.initialX);
            pos.y.set(node.initialY);
          }
        });
        break;
    }
  };

  useEffect(() => {
    if (data) applyLayout(layoutMode, data.nodes);
  }, [layoutMode, data]);

  const getNodeColor = (node: RoadmapNode) => {
    if (taxonomyMode === 'status') {
      if (node.status === 'done') return '#10b981';
      if (node.status === 'active') return '#fbbf24';
      return '#64748b';
    }
    return node.color;
  };

  const getNodeIcon = (node: RoadmapNode) => {
    switch (node.domain) {
      case 'spell-system': return '✨';
      case 'documentation': return '📜';
      case '3d': return '🧊';
      case 'tooling': return '🛠️';
      case 'character': return '👤';
      case 'world': return '🌍';
      default: return null;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/Aralia/api/roadmap/data');
        if (!response.ok) throw new Error('Failed to load roadmap data');
        const json = await response.json();
        
        // Load saved positions
        const savedPositionsRaw = localStorage.getItem('aralia_roadmap_positions');
        const savedPositions = savedPositionsRaw ? JSON.parse(savedPositionsRaw) : {};

        // Initialize motion values
        const positions: Record<string, { x: any, y: any }> = {};
        json.nodes.forEach((node: RoadmapNode) => {
          const saved = savedPositions[node.id];
          positions[node.id] = {
            x: motionValue(saved ? saved.x : node.initialX),
            y: motionValue(saved ? saved.y : node.initialY)
          };
        });
        
        nodePositions.current = positions;
        setData(json);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Roadmap data not found or inaccessible.');
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const savePositions = () => {
    if (!data) return;
    const positions: Record<string, { x: number, y: number }> = {};
    data.nodes.forEach(node => {
      const pos = nodePositions.current[node.id];
      if (pos) {
        positions[node.id] = { x: pos.x.get(), y: pos.y.get() };
      }
    });
    localStorage.setItem('aralia_roadmap_positions', JSON.stringify(positions));
  };

  const handleResetView = () => {
    canvasPanX.set(0);
    canvasPanY.set(0);
    canvasScale.set(1);
    setZoomLevel(1);
  };

  const isNodeVisible = (node: RoadmapNode) => {
    if (navMode === 'fog') {
      if (node.status === 'done' && node.type === 'task') return false;
    }
    if (navMode === 'zoom' && zoomLevel < 0.5) {
      return node.type === 'root' || node.type === 'project' || node.type === 'milestone';
    }
    return true;
  };

  const handleNodeClick = (id: string) => {
    setSelectedNodeId(id === selectedNodeId ? null : id);
  };

  if (loading) return <div className="w-full h-screen bg-gray-950 flex items-center justify-center text-amber-500 font-cinzel text-2xl animate-pulse">Consulting the Chronicles...</div>;
  if (error || !data) return <div className="w-full h-screen bg-gray-950 flex items-center justify-center text-red-500 font-cinzel">{error || 'Data Error'}</div>;

  const selectedNode = data.nodes.find(n => n.id === selectedNodeId);

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-gray-950 overflow-hidden font-cinzel">
      {/* HUD Header */}
      <div className="absolute top-12 left-0 w-full text-center z-20 pointer-events-none">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 mb-2 tracking-tighter">
          ARALIA CHRONICLES
        </h1>
        <p className="text-gray-500 text-sm uppercase tracking-[0.3em] mb-6">Live Project Roadmap</p>
        
        {/* Controls */}
        <div className="flex justify-center gap-8 pointer-events-auto">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-gray-600 uppercase font-bold">Layout</span>
            <div className="flex bg-gray-900/80 border border-gray-800 rounded-lg p-1">
              {(['manual', 'timeline', 'categorical', 'spiral'] as LayoutMode[]).map(mode => (
                <button key={mode} onClick={() => setLayoutMode(mode)} className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-colors ${layoutMode === mode ? 'bg-amber-500 text-gray-900' : 'text-gray-500 hover:text-gray-300'}`}>{mode}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-gray-600 uppercase font-bold">Taxonomy</span>
            <div className="flex bg-gray-900/80 border border-gray-800 rounded-lg p-1">
              {(['standard', 'domain', 'status'] as TaxonomyMode[]).map(mode => (
                <button key={mode} onClick={() => setTaxonomyMode(mode)} className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-colors ${taxonomyMode === mode ? 'bg-sky-500 text-gray-900' : 'text-gray-500 hover:text-gray-300'}`}>{mode}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-gray-600 uppercase font-bold">Navigation</span>
            <div className="flex bg-gray-900/80 border border-gray-800 rounded-lg p-1">
              {(['canvas', 'fog', 'zoom'] as NavigationMode[]).map(mode => (
                <button key={mode} onClick={() => setNavMode(mode)} className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition-colors ${navMode === mode ? 'bg-emerald-500 text-gray-900' : 'text-gray-500 hover:text-gray-300'}`}>{mode}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <span className="text-[10px] text-gray-600 uppercase font-bold">Persistence</span>
            <div className="flex gap-2">
              <button onClick={savePositions} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-gray-950 text-[10px] uppercase font-bold rounded-lg transition-all active:scale-95">Save</button>
              <button onClick={() => { localStorage.removeItem('aralia_roadmap_positions'); window.location.reload(); }} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-[10px] uppercase font-bold rounded-lg transition-all">Reset</button>
            </div>
          </div>
        </div>
      </div>

      {/* Drill-down Side Panel */}
      {selectedNode && (
        <motion.div initial={{ x: -400 }} animate={{ x: 0 }} className="absolute left-0 top-0 bottom-0 w-96 bg-gray-900/95 backdrop-blur-2xl border-r border-amber-500/30 z-30 p-8 shadow-2xl flex flex-col pointer-events-auto">
          <button onClick={() => setSelectedNodeId(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">✕</button>
          
          <div className="mb-8">
            <div className="flex gap-2 items-center mb-2">
              <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                selectedNode.status === 'done' ? 'border-emerald-500 text-emerald-500' : 'border-amber-500 text-amber-500'
              }`}>
                {selectedNode.status}
              </div>
              {selectedNode.priority && (
                <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-800 ${
                  selectedNode.priority.toLowerCase() === 'high' ? 'text-red-400' : 'text-sky-400'
                }`}>
                  {selectedNode.priority}
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold text-amber-400">{selectedNode.label}</h2>
            <p className="text-gray-500 text-[10px] mt-1 uppercase tracking-widest">{selectedNode.type} • {selectedNode.domain || 'Core'}</p>
          </div>

          <div className="flex-grow overflow-y-auto custom-scrollbar pr-4">
            <section className="mb-8">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-800 pb-1">Historical Context</h3>
              <p className="text-sm text-gray-300 leading-relaxed mb-4 italic">
                {selectedNode.description || `Specification and history for ${selectedNode.label}.`}
              </p>
              
              {selectedNode.dependencies && selectedNode.dependencies.length > 0 && (
                <div className="mb-4">
                  <div className="text-[8px] text-gray-500 uppercase font-bold mb-1">Prerequisites</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.dependencies.map(dep => (
                      <span key={dep} className="text-[8px] bg-amber-900/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">{dep}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.completedDate && (
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span>INTRODUCED:</span>
                  <span className="text-gray-300">{new Date(selectedNode.completedDate).toLocaleDateString()}</span>
                </div>
              )}
            </section>

            {selectedNode.goals && selectedNode.goals.length > 0 && (
              <section className="mb-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-800 pb-1">Primary Goals</h3>
                <ul className="space-y-2">
                  {selectedNode.goals.map((goal, idx) => (
                    <li key={idx} className="text-[11px] text-gray-300 flex gap-2">
                      <span className="text-amber-500/50">•</span>
                      {goal}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {selectedNode.filesImpacted && selectedNode.filesImpacted.length > 0 && (
              <section className="mb-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-800 pb-1">Codebase Footprint</h3>
                <div className="bg-black/40 rounded-lg p-3 border border-gray-800">
                  <div className="space-y-1.5">
                    {selectedNode.filesImpacted.map((file, idx) => (
                      <div key={idx} className="text-[9px] font-mono text-gray-400 flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                        <span className="w-1 h-1 rounded-full bg-sky-500/50" />
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {selectedNode.progress !== undefined && (
              <section className="mb-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-800 pb-1">Integrity</h3>
                <div className="flex justify-between text-[10px] text-amber-500 mb-2 font-mono">
                  <span>Progress</span>
                  <span>{selectedNode.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${selectedNode.progress}%` }} className="h-full bg-gradient-to-r from-amber-600 to-amber-400" />
                </div>
              </section>
            )}

            {selectedNode.subNodes && selectedNode.subNodes.length > 0 && (
              <section className="mb-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-800 pb-1">Sub-Items ({selectedNode.subNodes.length})</h3>
                <div className="space-y-2">
                  {selectedNode.subNodes.map((sub, idx) => (
                    <div key={idx} className="bg-gray-800/50 p-2 rounded border border-gray-700/50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-200">{sub.label}</span>
                        <span className="text-[8px] text-gray-500 uppercase">{sub.status}</span>
                      </div>
                      {sub.link && <button onClick={() => window.open(`/Aralia/${sub.link}`, '_blank')} className="p-1 hover:bg-gray-700 rounded transition-colors text-amber-500">🔗</button>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selectedNode.link && (
              <button onClick={() => window.open(`/Aralia/${selectedNode.link}`, '_blank')} className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-gray-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mb-3">
                <span>OPEN SPECIFICATION</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Background Pan & Zoom Grabber */}
      <motion.div
        onPan={(e, info) => {
          canvasPanX.set(canvasPanX.get() + info.delta.x);
          canvasPanY.set(canvasPanY.get() + info.delta.y);
        }}
        className="absolute inset-0 z-0 cursor-move active:cursor-grabbing pointer-events-auto"
      />

      {/* Moving Content Layer */}
      <motion.div
        style={{ x: canvasPanX, y: canvasPanY, scale: canvasScale }}
        className="absolute inset-0 origin-top-left z-10 pointer-events-none"
      >
        {/* SVG Layer */}
        <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none z-0">
          {data.edges.map((edge, idx) => {
            const fromPos = nodePositions.current[edge.from];
            const toPos = nodePositions.current[edge.to];
            const fromNode = data.nodes.find(n => n.id === edge.from);
            const toNode = data.nodes.find(n => n.id === edge.to);
            if (!fromPos || !toPos) return null;
            
            return (
              <ElasticLine 
                key={`${edge.from}-${edge.to}-${idx}`}
                fromX={fromPos.x} fromY={fromPos.y}
                toX={toPos.x} toY={toPos.y}
                color={getNodeColor(fromNode!)}
                isActive={fromNode?.status !== 'planned'}
                isHidden={!isNodeVisible(fromNode!) || !isNodeVisible(toNode!)}
              />
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {data.nodes.map((node) => {
          const pos = nodePositions.current[node.id];
          if (!pos || !isNodeVisible(node)) return null;

          return (
            <motion.div
              key={node.id}
              drag
              dragMomentum={false}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleNodeClick(node.id);
              }}
              onDrag={(e, info) => {
                const scale = canvasScale.get();
                pos.x.set(pos.x.get() + info.delta.x / scale);
                pos.y.set(pos.y.get() + info.delta.y / scale);
              }}
              style={{
                x: pos.x,
                y: pos.y,
                left: 0,
                top: 0,
                position: 'absolute',
                translateX: "-50%",
                translateY: "-50%",
              }}
              className="cursor-grab active:cursor-grabbing z-10 group pointer-events-auto"
            >
              {/* Main Node Body */}
              <div 
                className={`relative rounded-xl bg-gray-900 border-2 flex flex-col items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-2xl ${
                  node.type === 'root' ? 'w-32 h-32 border-double' : 
                  node.type === 'project' ? 'w-24 h-24 rotate-45' : 'w-16 h-16'
                }`}
                style={{ borderColor: getNodeColor(node) }}
              >
                 <div className={`text-center flex flex-col items-center ${node.type === 'project' ? '-rotate-45' : ''}`}>
                   {getNodeIcon(node) && <span className="text-xs mb-1 opacity-50">{getNodeIcon(node)}</span>}
                   <div className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">{node.status}</div>
                   <div className={`${node.type === 'root' ? 'text-sm' : 'text-[10px]'} font-bold text-gray-200 leading-tight px-2`}>
                     {node.label}
                   </div>
                   {node.progress !== undefined && (
                     <div className="text-[8px] text-amber-500 font-mono mt-1">{node.progress}%</div>
                   )}
                 </div>
              </div>

              {/* Tooltip */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                 <div className="bg-black/95 border border-amber-500/30 p-4 rounded-xl w-64 backdrop-blur-xl shadow-2xl">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-amber-400 text-xs font-bold">{node.label}</div>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded border ${
                        node.status === 'done' ? 'border-emerald-500 text-emerald-500' : 'border-amber-500 text-amber-500'
                      }`}>
                        {node.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-gray-400 text-[10px] leading-relaxed mb-3">
                      {node.description || `Milestone tracking for the ${node.label} ${node.type}.`}
                    </div>
                 </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Footer Controls */}
      <div className="absolute bottom-12 left-0 w-full flex justify-center gap-4 z-20">
        <div className="flex bg-gray-900/50 backdrop-blur-md border border-amber-500/30 rounded-full p-1 shadow-2xl">
          <button onClick={() => handleZoom(0.1)} className="w-10 h-10 flex items-center justify-center text-amber-500 hover:text-amber-400 transition-colors font-bold text-xl" title="Zoom In">+</button>
          <div className="w-[1px] bg-amber-500/20 my-2" />
          <button onClick={() => handleZoom(-0.1)} className="w-10 h-10 flex items-center justify-center text-amber-500 hover:text-amber-400 transition-colors font-bold text-xl" title="Zoom Out">−</button>
        </div>
        <button 
          onClick={handleResetView}
          className="bg-gray-900/50 hover:bg-gray-800 border border-amber-500/30 text-amber-500 font-bold py-3 px-8 rounded-full backdrop-blur-md transition-all hover:scale-105 active:scale-95 shadow-2xl"
        >
          Reset View
        </button>
        <button 
          onClick={() => window.location.href = '/Aralia/'}
          className="bg-gray-900/50 hover:bg-gray-800 border border-amber-500/30 text-amber-500 font-bold py-3 px-8 rounded-full backdrop-blur-md transition-all hover:scale-105 active:scale-95 shadow-2xl"
        >
          Return to Aralia
        </button>
      </div>
    </div>
  );
};
