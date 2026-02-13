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
}

interface RoadmapEdge {
  from: string;
  to: string;
}

interface RoadmapData {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
}

const ElasticLine: React.FC<{ fromX: any, fromY: any, toX: any, toY: any, color: string, isActive: boolean }> = ({ fromX, fromY, toX, toY, color, isActive }) => {
  const path = useTransform([fromX, fromY, toX, toY], ([fx, fy, tx, ty]) => {
    const midY = (Number(fy) + Number(ty)) / 2;
    return `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
  });

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
  
  // Canvas Pan State
  const canvasPanX = motionValue(0);
  const canvasPanY = motionValue(0);

  // Create a map of motion values for each node
  const nodePositions = useRef<Record<string, { x: any, y: any }>>({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/roadmap/data');
        if (!response.ok) throw new Error('Failed to load roadmap data');
        const json = await response.json();
        
        // Initialize motion values
        const positions: Record<string, { x: any, y: any }> = {};
        json.nodes.forEach((node: RoadmapNode) => {
          positions[node.id] = {
            x: motionValue(node.initialX),
            y: motionValue(node.initialY)
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

  const handleResetView = () => {
    canvasPanX.set(0);
    canvasPanY.set(0);
  };

  if (loading) return <div className="w-full h-screen bg-gray-950 flex items-center justify-center text-amber-500 font-cinzel text-2xl animate-pulse">Consulting the Chronicles...</div>;
  if (error || !data) return <div className="w-full h-screen bg-gray-950 flex items-center justify-center text-red-500 font-cinzel">{error || 'Data Error'}</div>;

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden font-cinzel">
      {/* HUD Header */}
      <div className="absolute top-12 left-0 w-full text-center z-20 pointer-events-none">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 mb-2 tracking-tighter">
          ARALIA CHRONICLES
        </h1>
        <p className="text-gray-500 text-sm uppercase tracking-[0.3em]">Live Project Roadmap</p>
      </div>

      {/* Draggable Canvas Wrapper */}
      <motion.div
        drag
        dragMomentum={false}
        style={{ x: canvasPanX, y: canvasPanY }}
        className="absolute inset-0 cursor-move active:cursor-grabbing"
      >
        {/* SVG Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {data.edges.map((edge, idx) => {
            const fromPos = nodePositions.current[edge.from];
            const toPos = nodePositions.current[edge.to];
            const fromNode = data.nodes.find(n => n.id === edge.from);
            if (!fromPos || !toPos) return null;
            
            return (
              <ElasticLine 
                key={`${edge.from}-${edge.to}-${idx}`}
                fromX={fromPos.x} fromY={fromPos.y}
                toX={toPos.x} toY={toPos.y}
                color={fromNode?.color || '#ffffff'}
                isActive={fromNode?.status !== 'planned'}
              />
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {data.nodes.map((node) => {
          const pos = nodePositions.current[node.id];
          if (!pos) return null;
          
          return (
            <motion.div
              key={node.id}
              drag
              dragMomentum={false}
              onPointerDown={(e) => e.stopPropagation()} // Stop propagation to prevent canvas pan
              onDrag={(e, info) => {
                pos.x.set(node.initialX + info.offset.x);
                pos.y.set(node.initialY + info.offset.y);
              }}
              style={{
                x: pos.x,
                y: pos.y,
                translateX: "-50%",
                translateY: "-50%",
              }}
              className="absolute cursor-grab active:cursor-grabbing z-10 group"
            >
              {/* Main Node Body */}
              <div 
                className={`relative rounded-xl bg-gray-900 border-2 flex flex-col items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-2xl ${
                  node.type === 'root' ? 'w-32 h-32 border-double' : 
                  node.type === 'project' ? 'w-24 h-24 rotate-45' : 'w-16 h-16'
                }`}
                style={{ borderColor: node.color }}
              >
                 <div className={`text-center ${node.type === 'project' ? '-rotate-45' : ''}`}>
                   <div className="text-[8px] text-gray-500 uppercase font-bold mb-0.5">{node.status}</div>
                   <div className={`${node.type === 'root' ? 'text-sm' : 'text-[10px]'} font-bold text-gray-200 leading-tight px-2`}>
                     {node.label}
                   </div>
                   {node.progress !== undefined && (
                     <div className="text-[8px] text-amber-500 font-mono mt-1">{node.progress}%</div>
                   )}
                 </div>
              </div>

              {/* Interaction Tooltip */}
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

                    {node.progress !== undefined && (
                      <div className="mb-3">
                        <div className="flex justify-between text-[8px] text-gray-500 mb-1">
                          <span>Completion</span>
                          <span>{node.progress}%</span>
                        </div>
                        <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${node.progress}%` }}
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400" 
                          />
                        </div>
                      </div>
                    )}

                    {node.link && (
                      <button 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => window.open(`/Aralia/${node.link}`, '_blank')}
                        className="w-full py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[9px] font-bold rounded flex items-center justify-center gap-2 transition-colors pointer-events-auto"
                      >
                        <span>VIEW SPECIFICATION</span>
                        <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    )}
                 </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Footer Controls */}
      <div className="absolute bottom-12 left-0 w-full flex justify-center gap-4 z-20">
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


