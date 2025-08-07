import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

const MultiSelectDropdown = ({ 
  options = [], 
  selectedValues = [], 
  onChange, 
  placeholder = "Select options...",
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value) => {
    const newSelectedValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    
    onChange(newSelectedValues);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const option = options.find(opt => opt.value === selectedValues[0]);
      return option ? option.label : placeholder;
    }
    return `${selectedValues.length} statuses selected`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
      >
        <span className="truncate">{getDisplayText()}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {selectedValues.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full px-3 py-2 text-left hover:bg-red-50 border-b border-gray-200 text-red-600 flex items-center justify-between font-medium"
            >
              <span>Clear Selection</span>
              <X className="w-4 h-4" />
            </button>
          )}
          
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToggle(option.value)}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
            >
              <span>{option.label}</span>
              {selectedValues.includes(option.value) && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}
          
          {options.length === 0 && (
            <div className="px-3 py-2 text-gray-500 text-center">
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
