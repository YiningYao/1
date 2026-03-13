/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Calculator, Beaker, Info, CheckCircle2, ChevronRight, Edit3, Palette, FlaskConical, Printer, X, GripVertical, Settings2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/// Types
interface Sample {
  id: string;
  name: string;
  concentration: number;
  color: string;
}

type PlateType = '6' | '12' | '24' | '96';

interface Plate {
  id: string;
  name: string;
  type: PlateType;
  wellAssignments: Record<string, string>; // wellId -> sampleId
}

const PLATE_CONFIGS: Record<PlateType, { rows: string[], cols: number[], gridClass: string }> = {
  '6': { rows: ['A', 'B'], cols: [1, 2, 3], gridClass: 'grid-cols-4' },
  '12': { rows: ['A', 'B', 'C'], cols: [1, 2, 3, 4], gridClass: 'grid-cols-5' },
  '24': { rows: ['A', 'B', 'C', 'D'], cols: [1, 2, 3, 4, 5, 6], gridClass: 'grid-cols-7' },
  '96': { rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], cols: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], gridClass: 'grid-cols-13' }
};

const SAMPLE_COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
];

// Well component for the plate
const Well = ({ wellId, sample, onClick, isDragging, dnaVol, isOver, fontSize, fontFamily, fontColor }: any) => {
  const fontStyle = {
    fontSize: `${fontSize}px`,
    fontFamily: fontFamily === 'mono' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : fontFamily === 'serif' ? 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' : 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
    color: fontColor,
  };

  return (
    <button
      onClick={onClick}
      className={`w-full aspect-square rounded-xl border-2 transition-all flex flex-col items-center justify-center relative group overflow-hidden
        ${sample
          ? 'border-transparent shadow-md'
          : 'bg-stone-50 border-stone-200 text-stone-300 hover:border-stone-400 hover:bg-stone-100'
        } ${isDragging ? 'opacity-50 ring-2 ring-emerald-500 ring-offset-2' : ''} 
        ${isOver && !isDragging ? 'bg-emerald-100 border-emerald-300' : ''}`}
      style={sample && !isDragging ? { backgroundColor: sample.color, ...fontStyle } : {}}
    >
      <span className="text-[10px] opacity-60 absolute top-1 left-1 font-bold print:text-[8px]" style={{ color: sample ? fontColor : 'inherit' }}>{wellId}</span>
      {sample ? (
        <div className="flex flex-col items-center justify-center w-full px-1">
          <span className="font-black leading-tight truncate w-full text-center drop-shadow-sm print:leading-none" style={{ fontSize: `${fontSize}px` }}>
            {sample.name}
          </span>
          <span className="mt-1 bg-black/20 px-1.5 py-0.5 rounded font-bold print:bg-transparent print:text-black print:mt-0.5" style={{ fontSize: `${Math.max(8, fontSize - 2)}px` }}>
            {dnaVol}μL
          </span>
        </div>
      ) : (
        <Plus className="w-4 h-4 opacity-20 print:hidden" />
      )}
    </button>
  );
};

const SortableWell = ({ wellId, plateId, sample, onClick, dnaVol, fontSize, fontFamily, fontColor }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: `well-${plateId}-${wellId}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="w-full aspect-square">
      <Well
        wellId={wellId}
        sample={sample}
        onClick={onClick}
        dnaVol={dnaVol}
        isDragging={isDragging}
        isOver={isOver}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fontColor={fontColor}
      />
    </div>
  );
};

// Sortable Plate Item Component
const SortablePlate = ({ plate, samples, sampleStats, toggleWell, clearPlate, removePlate, canRemove, onNameChange, onTypeChange, fontSize, fontFamily, fontColor, targetDnaAmount }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plate.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const config = PLATE_CONFIGS[plate.type as PlateType] || PLATE_CONFIGS['24'];

  const wellIds = React.useMemo(() => 
    config.rows.flatMap(r => config.cols.map(c => `well-${plate.id}-${r}${c}`)),
  [plate.id, plate.type]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden print:border-2 print:border-stone-300 print:rounded-none ${isDragging ? 'opacity-50 shadow-xl ring-2 ring-emerald-500' : ''}`}
    >
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/30 print:bg-white print:py-2">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-stone-200 rounded transition-colors print:hidden">
            <GripVertical className="w-4 h-4 text-stone-400" />
          </div>
          <span className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600 print:w-6 print:h-6">
            {plate.id}
          </span>
          <input
            type="text"
            value={plate.name}
            onChange={(e) => onNameChange(plate.id, e.target.value)}
            className="bg-transparent border-none focus:ring-0 font-bold text-stone-800 p-0 w-32 print:text-lg"
          />
          <select
            value={plate.type}
            onChange={(e) => onTypeChange(plate.id, e.target.value as PlateType)}
            className="text-xs bg-white border border-stone-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 print:hidden"
          >
            <option value="6">6-well</option>
            <option value="12">12-well</option>
            <option value="24">24-well</option>
            <option value="96">96-well</option>
          </select>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={() => clearPlate(plate.id)}
            className="text-xs font-medium text-stone-500 hover:text-stone-600 px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors"
          >
            清空本板
          </button>
          {canRemove && (
            <button
              onClick={() => removePlate(plate.id)}
              className="text-stone-400 hover:text-red-500 p-1 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="p-6 overflow-x-auto print:p-4">
        <div className="min-w-[600px] print:min-w-0">
          <SortableContext items={wellIds} strategy={() => null}>
            <div 
              className="grid gap-3 print:gap-2 plate-grid"
              style={{ gridTemplateColumns: `repeat(${config.cols.length + 1}, minmax(0, 1fr))` }}
            >
              <div className="w-full aspect-square"></div>
              {config.cols.map(c => (
                <div key={c} className="w-full aspect-square flex items-center justify-center text-sm font-black text-stone-400">
                  {c}
                </div>
              ))}

              {config.rows.map(r => (
                <React.Fragment key={r}>
                  <div className="w-full aspect-square flex items-center justify-center text-sm font-black text-stone-400">
                    {r}
                  </div>
                    {config.cols.map(c => {
                    const wellId = `${r}${c}`;
                    const assignedSampleId = plate.wellAssignments[wellId];
                    const sample = samples.find((s: any) => s.id === assignedSampleId);
                    const dnaVol = sample ? (targetDnaAmount / sample.concentration).toFixed(2) : null;
                    
                    return (
                      <SortableWell
                        key={wellId}
                        wellId={wellId}
                        plateId={plate.id}
                        sample={sample}
                        dnaVol={dnaVol}
                        onClick={() => toggleWell(plate.id, wellId)}
                        fontSize={fontSize}
                        fontFamily={fontFamily}
                        fontColor={fontColor}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </SortableContext>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [samples, setSamples] = useState<Sample[]>([
    { id: 's0', name: 's1-1', concentration: 800, color: SAMPLE_COLORS[0] },
    { id: 's1', name: 's1-2', concentration: 800, color: SAMPLE_COLORS[1] },
    { id: 's2', name: 's1-3', concentration: 800, color: SAMPLE_COLORS[2] },
    { id: 's3', name: 's2-1', concentration: 800, color: SAMPLE_COLORS[3] },
    { id: 's4', name: 's2-2', concentration: 800, color: SAMPLE_COLORS[4] },
    { id: 's5', name: 's2-3', concentration: 800, color: SAMPLE_COLORS[5] },
  ]);
  const [activeSampleId, setActiveSampleId] = useState<string>('s0');
  const [colorMode, setColorMode] = useState<'unique' | 'grouped'>('unique');
  const [wellFontSize, setWellFontSize] = useState<number>(11);
  const [wellFontFamily, setWellFontFamily] = useState<string>('sans');
  const [wellFontColor, setWellFontColor] = useState<string>('#ffffff');
  
  // Transfection Parameters
  const [targetDnaPerWell, setTargetDnaPerWell] = useState<number>(500);
  const [reagentPerWell, setReagentPerWell] = useState<number>(1.5);
  const [optiMemPerWell, setOptiMemPerWell] = useState<number>(25);

  const [plates, setPlates] = useState<Plate[]>([
    { id: '1', name: 'Plate 1', type: '24', wellAssignments: {} }
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const displaySamples = useMemo(() => {
    if (colorMode !== 'grouped') return samples;

    const groups: Record<string, string[]> = {};
    samples.forEach(s => {
      const prefix = s.name.split(/[- ]/)[0] || s.name;
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(s.id);
    });

    const groupKeys = Object.keys(groups);
    return samples.map(s => {
      const prefix = s.name.split(/[- ]/)[0] || s.name;
      const group = groups[prefix];
      const idxInGroup = group.indexOf(s.id);
      const groupIdx = groupKeys.indexOf(prefix);

      // Only apply grouped color if the sample hasn't been manually customized
      // Check if the color is a hex color with alpha (8 characters = hex + alpha)
      const isCustomColor = s.color.length > 7 && s.color.length <= 9;

      if (isCustomColor) {
        return s;
      }

      // Apply grouped color only for non-custom colors
      const baseColor = SAMPLE_COLORS[groupIdx % SAMPLE_COLORS.length];
      // Adjust opacity/lightness for similar colors
      const alpha = Math.max(0.3, 1 - (idxInGroup * 0.2));
      const hexAlpha = Math.round(alpha * 255).toString(16).padStart(2, '0');
      return {
        ...s,
        color: `${baseColor}${hexAlpha}`
      };
    });
  }, [samples, colorMode]);

  // Excel-like navigation
  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: 'name' | 'concentration') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRow = document.querySelector(`[data-row="${index + 1}"][data-field="${field}"]`) as HTMLInputElement;
      if (nextRow) {
        nextRow.focus();
        nextRow.select();
      } else if (index === samples.length - 1) {
        addSample();
        setTimeout(() => {
          const newRow = document.querySelector(`[data-row="${index + 1}"][data-field="${field}"]`) as HTMLInputElement;
          if (newRow) {
            newRow.focus();
            newRow.select();
          }
        }, 50);
      }
    }
  };

  const removeAllSamples = () => {
    if (window.confirm('确定要清空所有质粒样本吗？')) {
      setSamples([]);
      setActiveSampleId(null);
      setPlates(plates.map(p => ({ ...p, wellAssignments: {} })));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (activeId.startsWith('well-')) {
      // Well dragging logic
      const [, activePlateId, activeWellId] = activeId.split('-');
      const [, overPlateId, overWellId] = overId.split('-');
      
      if (activePlateId === overPlateId) {
        setPlates(plates.map(p => {
          if (p.id === activePlateId) {
            const newAssignments = { ...p.wellAssignments };
            const sampleId = newAssignments[activeWellId];
            const targetSampleId = newAssignments[overWellId];
            
            if (sampleId) {
              newAssignments[overWellId] = sampleId;
              if (targetSampleId) {
                newAssignments[activeWellId] = targetSampleId; // Swap
              } else {
                delete newAssignments[activeWellId]; // Move
              }
            }
            return { ...p, wellAssignments: newAssignments };
          }
          return p;
        }));
      }
    } else {
      // Plate dragging logic
      if (active.id !== over.id) {
        setPlates((items) => {
          const oldIndex = items.findIndex((i) => i.id === active.id);
          const newIndex = items.findIndex((i) => i.id === over.id);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
  };

  const updatePlateName = (id: string, name: string) => {
    setPlates(plates.map(p => p.id === id ? { ...p, name } : p));
  };

  // Sample Management
  const addSample = () => {
    const newId = `s${Date.now()}`;
    const colorIndex = samples.length % SAMPLE_COLORS.length;
    const newSample = {
      id: newId,
      name: `Plasmid ${samples.length + 1}`,
      concentration: 800,
      color: SAMPLE_COLORS[colorIndex]
    };
    setSamples([...samples, newSample]);
    setActiveSampleId(newId);
  };

  const updateSample = (id: string, updates: Partial<Sample>) => {
    setSamples(samples.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSample = (id: string) => {
    if (samples.length > 1) {
      const newSamples = samples.filter(s => s.id !== id);
      setSamples(newSamples);
      if (activeSampleId === id) {
        setActiveSampleId(newSamples[0].id);
      }
      // Clean up plate assignments
      setPlates(plates.map(p => {
        const newAssignments = { ...p.wellAssignments };
        Object.keys(newAssignments).forEach(wellId => {
          if (newAssignments[wellId] === id) {
            delete newAssignments[wellId];
          }
        });
        return { ...p, wellAssignments: newAssignments };
      }));
    }
  };

  const fillSeries = () => {
    if (samples.length === 0) return;
    
    // Find the active sample and its index
    const activeIdx = samples.findIndex(s => s.id === activeSampleId);
    if (activeIdx === -1) return;
    
    const currentSample = samples[activeIdx];
    const prevSample = activeIdx > 0 ? samples[activeIdx - 1] : null;
    
    // Simple regex to find the last number in the string
    const regex = /(\d+)(?!.*\d)/;
    
    let nextName = "";
    let nextConcentration = currentSample.concentration;
    
    if (prevSample) {
      const match1 = prevSample.name.match(regex);
      const match2 = currentSample.name.match(regex);
      
      if (match1 && match2) {
        const n1 = parseInt(match1[0]);
        const n2 = parseInt(match2[0]);
        const diff = n2 - n1;
        const prefix = currentSample.name.substring(0, match2.index);
        const suffix = currentSample.name.substring(match2.index! + match2[0].length);
        nextName = `${prefix}${n2 + diff}${suffix}`;
      } else {
        const match = currentSample.name.match(regex);
        if (match) {
          const n = parseInt(match[0]);
          const prefix = currentSample.name.substring(0, match.index);
          const suffix = currentSample.name.substring(match.index! + match[0].length);
          nextName = `${prefix}${n + 1}${suffix}`;
        } else {
          nextName = `${currentSample.name} (Copy)`;
        }
      }
    } else {
      const match = currentSample.name.match(regex);
      if (match) {
        const n = parseInt(match[0]);
        const prefix = currentSample.name.substring(0, match.index);
        const suffix = currentSample.name.substring(match.index! + match[0].length);
        nextName = `${prefix}${n + 1}${suffix}`;
      } else {
        nextName = `${currentSample.name} (Copy)`;
      }
    }

    const newId = `s${Date.now()}`;
    const colorIndex = samples.length % SAMPLE_COLORS.length;
    
    const newSample = {
      id: newId,
      name: nextName,
      concentration: nextConcentration,
      color: SAMPLE_COLORS[colorIndex]
    };

    // Insert after the current active sample
    const newSamples = [...samples];
    newSamples.splice(activeIdx + 1, 0, newSample);
    setSamples(newSamples);
    setActiveSampleId(newId);
  };

  const autoLayout = () => {
    // 1. Find which samples are already assigned
    const assignedSampleIds = new Set();
    plates.forEach(plate => {
      Object.values(plate.wellAssignments).forEach(sampleId => {
        assignedSampleIds.add(sampleId);
      });
    });

    // 2. Find samples that are NOT assigned
    const unassignedSamples = samples.filter(s => !assignedSampleIds.has(s.id));
    if (unassignedSamples.length === 0) return;

    let sampleIdx = 0;
    const newPlates = plates.map(plate => {
      const newAssignments = { ...plate.wellAssignments };
      const config = PLATE_CONFIGS[plate.type] || PLATE_CONFIGS['24'];
      
      for (let r = 0; r < config.rows.length; r++) {
        for (let c = 0; c < config.cols.length; c++) {
          const wellId = `${config.rows[r]}${config.cols[c]}`;
          if (!newAssignments[wellId] && sampleIdx < unassignedSamples.length) {
            newAssignments[wellId] = unassignedSamples[sampleIdx].id;
            sampleIdx++;
          }
        }
      }
      return { ...plate, wellAssignments: newAssignments };
    });

    setPlates(newPlates);
  };

  const resetLayout = () => {
    if (!window.confirm('确定要清空当前所有布局并重新按顺序规划吗？')) return;
    
    let globalSampleIdx = 0;
    setPlates(plates.map((plate) => {
      const newAssignments: Record<string, string> = {};
      const config = PLATE_CONFIGS[plate.type] || PLATE_CONFIGS['24'];
      
      for (let r = 0; r < config.rows.length; r++) {
        for (let c = 0; c < config.cols.length; c++) {
          const wellId = `${config.rows[r]}${config.cols[c]}`;
          if (globalSampleIdx < samples.length) {
            newAssignments[wellId] = samples[globalSampleIdx].id;
            globalSampleIdx++;
          }
        }
      }
      return { ...plate, wellAssignments: newAssignments };
    }));
  };

  // Plate Management
  const addPlate = () => {
    const newId = (Math.max(0, ...plates.map(p => parseInt(p.id))) + 1).toString();
    setPlates([...plates, { id: newId, name: `Plate ${newId}`, type: '24', wellAssignments: {} }]);
  };

  const removePlate = (id: string) => {
    if (plates.length > 1) {
      setPlates(plates.filter(p => p.id !== id));
    }
  };

  const updatePlateType = (id: string, type: PlateType) => {
    setPlates(plates.map(p => p.id === id ? { ...p, type, wellAssignments: {} } : p));
  };

  const toggleWell = (plateId: string, wellId: string) => {
    setPlates(plates.map(p => {
      if (p.id === plateId) {
        const newAssignments = { ...p.wellAssignments };
        if (newAssignments[wellId] === activeSampleId) {
          delete newAssignments[wellId];
        } else {
          newAssignments[wellId] = activeSampleId;
        }
        return { ...p, wellAssignments: newAssignments };
      }
      return p;
    }));
  };

  const clearPlate = (plateId: string) => {
    setPlates(plates.map(p => p.id === plateId ? { ...p, wellAssignments: {} } : p));
  };

  // Calculations
  const sampleStats = useMemo(() => {
    const stats: Record<string, number> = {};
    samples.forEach(s => stats[s.id] = 0);
    plates.forEach(p => {
      (Object.values(p.wellAssignments) as string[]).forEach(sid => {
        if (stats[sid] !== undefined) stats[sid]++;
      });
    });
    return stats;
  }, [plates, samples]);

  const totalSelectedWells = useMemo(() => {
    return (Object.values(sampleStats) as number[]).reduce((acc, count) => acc + count, 0);
  }, [sampleStats]);

  const calculationResults = useMemo(() => {
    const redundancy = 1.1;

    // Tube A results (per sample)
    const tubeAResults = displaySamples.map(sample => {
      const n = sampleStats[sample.id] || 0;
      if (n === 0) return null;

      const calcN = n; // Tube A uses exact count without redundancy
      const totalDnaNg = calcN * targetDnaPerWell;
      const dnaVol = totalDnaNg / sample.concentration;
      const optiMemA = calcN * optiMemPerWell;

      return {
        sample,
        n,
        calcN: calcN.toFixed(2),
        dna: dnaVol.toFixed(2),
        optiMem: optiMemA.toFixed(2),
        total: (dnaVol + optiMemA).toFixed(2)
      };
    }).filter(Boolean);

    // Tube B Master Mix (Total)
    const totalCalcN = totalSelectedWells * redundancy;
    const totalReagentVol = totalCalcN * reagentPerWell;
    const totalOptiMemB = totalCalcN * optiMemPerWell;

    return {
      tubeA: tubeAResults,
      tubeB: {
        totalWells: totalSelectedWells,
        totalCalcN: totalCalcN.toFixed(2),
        reagent: totalReagentVol.toFixed(2),
        optiMem: totalOptiMemB.toFixed(2),
        total: (totalReagentVol + totalOptiMemB).toFixed(2)
      }
    };
  }, [samples, sampleStats, totalSelectedWells, targetDnaPerWell, reagentPerWell, optiMemPerWell]);

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1C1917] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-emerald-600 p-1.5 sm:p-2 rounded-lg shadow-inner shrink-0">
              <Beaker className="text-white w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-base sm:text-xl font-bold tracking-tight text-stone-900 truncate">Quick-Trans</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-stone-100 text-stone-700 px-3 sm:px-4 py-2 rounded-xl hover:bg-stone-200 transition-colors text-xs sm:text-sm font-bold"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">打印 A4 报告</span>
              <span className="sm:hidden">打印</span>
            </button>
            <div className="hidden md:flex items-center gap-1 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-stone-500">支持 Excel 快捷键 & 拖拽</span>
            </div>
          </div>
        </div>
      </header>

      {/* Print Header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-stone-900">
          Quick-Trans - {new Date().toISOString().slice(0, 10).replace(/-/g, '').slice(2)}
        </h1>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 print:block print:p-0 print:max-w-none">
        {/* Left Column: Samples & Plates */}
        <div className="lg:col-span-7 space-y-8 print:space-y-12">
          {/* Samples Management List */}
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
            <div className="px-4 sm:p-6 py-3 border-b border-stone-100 bg-stone-50/50 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-semibold text-stone-800">质粒样本列表</h2>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={removeAllSamples}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-all border border-red-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    清空
                  </button>
                  <button
                    onClick={fillSeries}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-all border border-blue-100"
                    title="根据最后两个样本名称自动填充序列"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">格式填充</span>
                    <span className="sm:hidden">填充</span>
                  </button>
                  <button
                    onClick={addSample}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-all border border-emerald-100"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    添加质粒
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500 font-bold print:bg-white">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 border-b border-stone-100 print:px-2">颜色</th>
                    <th className="px-3 sm:px-6 py-3 border-b border-stone-100 print:px-2">质粒名称</th>
                    <th className="px-3 sm:px-6 py-3 border-b border-stone-100 print:px-2">浓度 (ng/μL)</th>
                    <th className="px-3 sm:px-6 py-3 border-b border-stone-100 print:px-2">孔数</th>
                    <th className="px-3 sm:px-6 py-3 border-b border-stone-100 print:hidden">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  <AnimatePresence mode="popLayout">
                    {displaySamples.map((sample, idx) => (
                      <motion.tr
                        key={sample.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setActiveSampleId(sample.id)}
                        className={`group cursor-pointer transition-colors ${activeSampleId === sample.id ? 'bg-emerald-50/40' : 'hover:bg-stone-50/50'} print:bg-white`}
                      >
                        <td className="px-3 sm:px-6 py-2.5 print:px-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={sample.color}
                              onChange={(e) => updateSample(sample.id, { color: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-6 h-6 rounded border-none p-0 cursor-pointer bg-transparent"
                            />
                            {activeSampleId === sample.id && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse print:hidden" />}
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-2.5 print:px-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={sample.name}
                              data-row={idx}
                              data-field="name"
                              onChange={(e) => updateSample(sample.id, { name: e.target.value })}
                              onKeyDown={(e) => handleKeyDown(e, idx, 'name')}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent border-none focus:ring-0 font-bold p-0 w-full text-sm text-stone-800"
                            />
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-2.5 print:px-2">
                          <input
                            type="number"
                            value={sample.concentration}
                            data-row={idx}
                            data-field="concentration"
                            onChange={(e) => updateSample(sample.id, { concentration: Number(e.target.value) })}
                            onKeyDown={(e) => handleKeyDown(e, idx, 'concentration')}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent border-none focus:ring-0 font-mono text-stone-600 p-0 w-16 sm:w-20 text-sm"
                          />
                        </td>
                        <td className="px-3 sm:px-6 py-2.5 text-sm font-bold text-stone-400 print:px-2">
                          {sampleStats[sample.id] || 0}
                        </td>
                        <td className="px-3 sm:px-6 py-2.5 print:hidden">
                          {samples.length > 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeSample(sample.id);
                              }}
                              className="text-stone-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </section>

            <div className="space-y-6 print:break-inside-avoid">
              <div className="flex flex-col gap-4 print:mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                    孔板布局
                    <span className="text-xs font-normal bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full print:hidden">
                      {plates.length} 个板子
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2 print:hidden">
                    <button
                      onClick={() => setColorMode(colorMode === 'unique' ? 'grouped' : 'unique')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-colors text-xs font-bold border ${
                        colorMode === 'grouped' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-600'
                      }`}
                    >
                      <Palette className="w-3.5 h-3.5" />
                      {colorMode === 'grouped' ? '同名相似色' : '独立配色'}
                    </button>
                    <button
                      onClick={autoLayout}
                      className="flex items-center gap-1.5 bg-blue-600 text-white px-2.5 py-1.5 rounded-xl hover:bg-blue-700 transition-colors text-xs font-medium shadow-sm"
                      title="仅将未排布的质粒加入空位"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      增量规划
                    </button>
                    <button
                      onClick={resetLayout}
                      className="flex items-center gap-1.5 bg-amber-500 text-white px-2.5 py-1.5 rounded-xl hover:bg-amber-600 transition-colors text-xs font-medium shadow-sm"
                      title="清空当前布局并按列表顺序重新排列"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      重新规划
                    </button>
                    <button
                      onClick={addPlate}
                      className="flex items-center gap-1.5 bg-stone-900 text-white px-2.5 py-1.5 rounded-xl hover:bg-stone-800 transition-colors text-xs font-medium shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      添加新板
                    </button>
                  </div>
                </div>

                {/* Font Customization Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
                  <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-2xl border border-stone-200">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-stone-400" />
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">布局字体</span>
                    </div>
                    <div className="h-4 w-px bg-stone-200"></div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-stone-400">大小</label>
                      <input 
                        type="range" min="8" max="20" value={wellFontSize} 
                        onChange={(e) => setWellFontSize(parseInt(e.target.value))}
                        className="w-20 accent-emerald-600"
                      />
                      <span className="text-xs font-mono text-stone-600 w-8">{wellFontSize}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select 
                        value={wellFontFamily} 
                        onChange={(e) => setWellFontFamily(e.target.value)}
                        className="text-xs bg-stone-50 border-stone-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="sans">Sans</option>
                        <option value="serif">Serif</option>
                        <option value="mono">Mono</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" value={wellFontColor} 
                        onChange={(e) => setWellFontColor(e.target.value)}
                        className="w-6 h-6 rounded border-none p-0 cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-2xl border border-stone-200">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-stone-400" />
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">转染参数</span>
                    </div>
                    <div className="h-4 w-px bg-stone-200"></div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-stone-400">DNA(ng)</label>
                      <input 
                        type="number" value={targetDnaPerWell} 
                        onChange={(e) => setTargetDnaPerWell(Number(e.target.value))}
                        className="w-16 text-xs bg-stone-50 border-stone-200 rounded-lg p-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-stone-400">试剂(μL)</label>
                      <input 
                        type="number" step="0.1" value={reagentPerWell} 
                        onChange={(e) => setReagentPerWell(Number(e.target.value))}
                        className="w-16 text-xs bg-stone-50 border-stone-200 rounded-lg p-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-stone-400">Opti(μL)</label>
                      <input 
                        type="number" value={optiMemPerWell} 
                        onChange={(e) => setOptiMemPerWell(Number(e.target.value))}
                        className="w-16 text-xs bg-stone-50 border-stone-200 rounded-lg p-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={plates.map(p => p.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-6">
                    {plates.map((plate) => (
                      <SortablePlate
                        key={plate.id}
                        plate={plate}
                        samples={displaySamples}
                        sampleStats={sampleStats}
                        toggleWell={toggleWell}
                        clearPlate={clearPlate}
                        removePlate={removePlate}
                        canRemove={plates.length > 1}
                        onNameChange={updatePlateName}
                        onTypeChange={updatePlateType}
                        fontSize={wellFontSize}
                        fontFamily={wellFontFamily}
                        fontColor={wellFontColor}
                        targetDnaAmount={targetDnaPerWell}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-5 print:mt-12">
          <div className="sticky top-24 space-y-6 print:static print:space-y-8">
            {totalSelectedWells === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center space-y-4 print:hidden">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
                  <Calculator className="w-8 h-8 text-stone-300" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-stone-500">等待标记样本</p>
                  <p className="text-sm text-stone-400">请选择左侧质粒样本，并点击孔板进行标记</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 print:space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-stone-800 print:text-2xl">计算结果</h2>
                  <span className="text-xs font-medium text-stone-400 print:text-sm">含 10% 冗余</span>
                </div>

                {/* Tube B Master Mix - Highlighted */}
                <div className="bg-orange-600 rounded-2xl p-6 text-white shadow-lg shadow-orange-200 space-y-4 print:bg-white print:text-stone-900 print:border-2 print:border-orange-600 print:shadow-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-white text-orange-600 flex items-center justify-center text-xs font-black print:bg-orange-600 print:text-white">B</span>
                      <h3 className="font-bold print:text-xl">试剂 Master Mix (总计)</h3>
                    </div>
                    <span className="text-[10px] bg-orange-500 px-2 py-0.5 rounded-full print:bg-stone-100 print:text-stone-600 print:text-xs">共 {calculationResults.tubeB.totalWells} 孔</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-700/50 p-3 rounded-xl border border-orange-500/30 print:bg-stone-50 print:border-stone-200">
                      <p className="text-[10px] text-orange-200 font-bold uppercase mb-1 print:text-stone-400">转染试剂</p>
                      <p className="text-xl font-mono font-black print:text-2xl">{calculationResults.tubeB.reagent} <span className="text-xs">μL</span></p>
                    </div>
                    <div className="bg-orange-700/50 p-3 rounded-xl border border-orange-500/30 print:bg-stone-50 print:border-stone-200">
                      <p className="text-[10px] text-orange-200 font-bold uppercase mb-1 print:text-stone-400">Opti-MEM</p>
                      <p className="text-xl font-mono font-black print:text-2xl">{calculationResults.tubeB.optiMem} <span className="text-xs">μL</span></p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-orange-500/30 flex justify-between items-center print:border-stone-200">
                    <span className="text-xs font-bold text-orange-100 print:text-stone-500">B 管总体积</span>
                    <span className="text-lg font-black print:text-2xl">{calculationResults.tubeB.total} μL</span>
                  </div>
                </div>

                {/* Tube A Individual Results */}
                <div className="space-y-4 print:break-inside-avoid">
                  <h3 className="text-sm font-bold text-stone-500 px-2 uppercase tracking-wider print:text-lg">A 管 (DNA 稀释液 - 独立配制)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:grid-cols-3 print:gap-2">
                    {calculationResults.tubeA.map((res) => (
                      <div
                        key={res.sample.id}
                        className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden print:border-stone-300 print:rounded-lg"
                      >
                        <div className="p-4 flex items-center justify-between border-b border-stone-50 bg-stone-50/30 print:bg-white print:py-1 print:px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full print:w-2 print:h-2" style={{ backgroundColor: res.sample.color }} />
                            <span className="font-bold text-stone-800 text-sm print:text-xs truncate max-w-[80px]">{res.sample.name}</span>
                          </div>
                          <span className="text-[10px] text-stone-400 font-bold print:text-[8px]">{res.n} 孔</span>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-4 print:p-2 print:gap-2">
                          <div className="space-y-1 print:space-y-0">
                            <p className="text-[10px] text-stone-400 font-bold uppercase print:text-[8px] print:mb-0">DNA</p>
                            <p className="text-sm font-mono font-bold text-emerald-600 print:text-xs">{res.dna} μL</p>
                          </div>
                          <div className="space-y-1 print:space-y-0">
                            <p className="text-[10px] text-stone-400 font-bold uppercase print:text-[8px] print:mb-0">Opti-MEM</p>
                            <p className="text-sm font-mono font-bold text-emerald-600 print:text-xs">{res.optiMem} μL</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Steps Card */}
                <div className="bg-stone-900 rounded-2xl p-6 text-white space-y-4 shadow-xl print:bg-white print:text-stone-900 print:border-2 print:border-stone-900 print:shadow-none print:break-inside-avoid">
                  <h3 className="font-bold flex items-center gap-2 text-emerald-400 print:text-stone-900 print:text-xl">
                    <Info className="w-4 h-4" />
                    混合指南
                  </h3>
                  <div className="space-y-3 text-xs text-stone-300 leading-relaxed print:text-stone-700 print:text-sm">
                    <p><span className="text-white font-bold print:text-stone-900">1. 准备 B 管：</span>按 Master Mix 一次性配制总试剂稀释液。</p>
                    <p><span className="text-white font-bold print:text-stone-900">2. 准备 A 管：</span>为每个质粒样本独立配制 DNA 稀释液。</p>
                    <p><span className="text-white font-bold print:text-stone-900">3. 混合：</span>向每支 A 管中加入 <span className="text-emerald-400 font-bold print:text-emerald-600">26.5 μL</span> B 管试剂，吹吸混匀。</p>
                    <p><span className="text-white font-bold print:text-stone-900">4. 静置：</span>室温孵育 15-20 分钟。</p>
                    <p><span className="text-white font-bold print:text-stone-900">5. 滴加：</span>每孔加入 <span className="text-emerald-400 font-bold print:text-emerald-600 font-black">50 μL</span> 混合液。</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-stone-200 mt-12 text-center print:hidden">
        <p className="text-stone-400 text-sm">
          © 2026 Quick-Trans · 转染计算器
        </p>
        <p className="text-stone-400 text-sm mt-1">
          Ivy Yao
        </p>
      </footer>

      {/* Print-only Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4;
            margin: 5mm;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 8pt;
          }
          .min-h-screen {
            background: white !important;
          }
          main {
            display: grid !important;
            grid-template-columns: 1fr !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .lg\\:col-span-7, .lg\\:col-span-5 {
            width: 100% !important;
            display: block !important;
            margin-bottom: 5mm !important;
          }

          /* Hide all sections except plate layout and B tube */
          section {
            display: none !important;
          }
          
          /* Show only plate layout section */
          section:has(.plate-grid) {
            display: block !important;
          }
          
          /* Hide A tube results (3rd child of results container) */
          .space-y-6 > .space-y-6 > div:nth-child(3) {
            display: none !important;
          }
          
          /* Hide guide section (4th child of results container) */
          .bg-stone-900 {
            display: none !important;
          }
          
          /* Hide results section title */
          .lg\\:col-span-5 > div > div > div:first-child {
            display: none !important;
          }

          /* Ensure plate layout is compact */
          .plate-grid {
            gap: 1mm !important;
          }
          .aspect-square {
            border-width: 1px !important;
            border-color: #e5e7eb !important;
            min-height: 5mm !important;
          }

          /* Scale down large plates for print */
          .plate-grid[style*="repeat(13"] {
            font-size: 6pt !important;
          }
          .plate-grid[style*="repeat(13"] .aspect-square {
            min-height: 4mm !important;
          }

          /* Force colors in print */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide non-essential elements */
          .print\\:hidden, header, footer {
            display: none !important;
          }

          /* Hide buttons except those used for wells */
          button:not([class*="aspect-square"]) {
            display: none !important;
          }

          /* Show essential elements */
          .print\\:block {
            display: block !important;
          }
          .print\\:grid-cols-3 {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }

          /* Specific adjustments for 24-well plate readability */
          .rounded-xl {
            border-radius: 2px !important;
          }

          /* Master Mix section styling for print */
          .bg-orange-600 {
            background-color: white !important;
            color: black !important;
            border: 2px solid #ea580c !important;
            padding: 10px !important;
          }
          .bg-orange-700\\/50 {
            background-color: #fff7ed !important;
            border: 1px solid #fed7aa !important;
            padding: 5px !important;
          }
          .text-orange-200 {
            color: #9a3412 !important;
          }

          /* Page breaks */
          * {
            page-break-inside: avoid !important;
          }
          h1, h2, h3 {
            page-break-after: avoid !important;
            margin-top: 1mm !important;
            margin-bottom: 1mm !important;
          }

          /* Scale down if too many plates */
          .space-y-6, .space-y-8 {
            gap: 5px !important;
          }
          .p-6 {
            padding: 5px !important;
          }
          .p-4 {
            padding: 4px !important;
          }
        }
      `}} />
    </div>
  );
}
