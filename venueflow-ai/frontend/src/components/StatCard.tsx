import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  color?: 'accent' | 'accent2' | 'success' | 'warning' | 'danger';
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  prefix = '', 
  suffix = '', 
  trend, 
  trendValue,
  icon,
  color = 'accent',
  delay = 0 
}) => {
  const isNumber = typeof value === 'number';
  const spring = useSpring(0, { mass: 1, stiffness: 50, damping: 15 });
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString('en-IN'));

  useEffect(() => {
    if (isNumber) {
      spring.set(value as number);
    }
  }, [value, isNumber, spring]);

  const getColorClasses = () => {
    switch (color) {
      case 'accent2': return 'text-accent2 bg-accent2/10';
      case 'success': return 'text-success bg-success/10';
      case 'warning': return 'text-warning bg-warning/10';
      case 'danger': return 'text-danger bg-danger/10';
      case 'accent':
      default: return 'text-accent bg-accent/10';
    }
  };

  return (
    <motion.div
      role="region"
      aria-label={`${title}: ${prefix}${isNumber ? Math.round(value as number).toLocaleString('en-IN') : value}${suffix}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="card p-5 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300"
    >
      {/* Background Glow */}
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity ${
        color === 'danger' ? 'bg-danger' : 
        color === 'success' ? 'bg-success' : 
        color === 'accent2' ? 'bg-accent2' : 
        'bg-accent'
      }`} />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="text-text-secondary text-sm font-medium">{title}</h3>
        {icon && (
          <div className={`p-2 rounded-lg ${getColorClasses()}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="relative z-10">
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-xl font-medium text-text-secondary">{prefix}</span>}
          {isNumber ? (
            <motion.span className="text-3xl font-black tracking-tight text-text-primary mono">
               {display}
            </motion.span>
          ) : (
            <span className="text-3xl font-black tracking-tight text-text-primary">{value}</span>
          )}
          {suffix && <span className="text-xl font-medium text-text-secondary">{suffix}</span>}
        </div>

        {trend && trendValue && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
            {trend === 'up' && (
              <span className="text-success flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                {trendValue}
              </span>
            )}
            {trend === 'down' && (
              <span className="text-success flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                {trendValue}
              </span>
            )}
            {trend === 'neutral' && (
              <span className="text-text-secondary flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" /></svg>
                {trendValue}
              </span>
            )}
            <span className="text-text-secondary truncate">vs last hour</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default StatCard;
