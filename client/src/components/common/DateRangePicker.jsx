import React from 'react';
import { Calendar } from 'lucide-react';
import './DateRangePicker.scss';

export const DateRangePicker = ({ selectedRange, onSelectRange, customFrom, customTo, onCustomChange }) => {
  const ranges = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: 'custom', label: 'Custom Range' }
  ];

  return (
    <div className="date-range-picker-container">
      <div className="range-pills">
        {ranges.map(r => (
          <button
            key={r.key}
            type="button"
            className={`range-pill ${selectedRange === r.key ? 'active' : ''}`}
            onClick={() => onSelectRange(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {selectedRange === 'custom' && (
        <div className="custom-range-inputs">
          <div className="input-with-icon">
            <Calendar size={14} />
            <input
              type="date"
              value={customFrom || ''}
              onChange={(e) => onCustomChange('from', e.target.value)}
              className="custom-date-field"
            />
          </div>
          <span className="to-divider">to</span>
          <div className="input-with-icon">
            <Calendar size={14} />
            <input
              type="date"
              value={customTo || ''}
              onChange={(e) => onCustomChange('to', e.target.value)}
              className="custom-date-field"
            />
          </div>
        </div>
      )}
    </div>
  );
};

