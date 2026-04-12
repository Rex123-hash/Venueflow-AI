import React from 'react';
import { motion } from 'framer-motion';

interface DensityBadgeProps {
  density: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  className?: string;
  showDot?: boolean;
}

const DensityBadge: React.FC<DensityBadgeProps> = ({ density, className = '', showDot = true }) => {
  const getStyles = () => {
    switch (density) {
      case 'CRITICAL':
        return 'bg-danger/20 text-danger border-danger/30';
      case 'HIGH':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
      case 'LOW':
      default:
        return 'bg-success/20 text-success border-success/30';
    }
  };

  const getDotStyles = () => {
    switch (density) {
      case 'CRITICAL': return 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.8)]';
      case 'HIGH': return 'bg-warning shadow-[0_0_8px_rgba(245,158,11,0.8)]';
      case 'MEDIUM': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]';
      case 'LOW':
      default: return 'bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    }
  };

  const isBlinking = density === 'CRITICAL' || density === 'HIGH';

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wider ${getStyles()} ${className}`}>
      {showDot && (
        <motion.div 
          animate={isBlinking ? { opacity: [1, 0.4, 1] } : {}}
          transition={isBlinking ? { duration: density === 'CRITICAL' ? 0.8 : 1.5, repeat: Infinity } : {}}
          className={`w-2 h-2 rounded-full ${getDotStyles()}`} 
        />
      )}
      {density}
    </div>
  );
};

export default DensityBadge;
