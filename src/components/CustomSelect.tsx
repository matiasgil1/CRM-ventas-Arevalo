import React, { useState, useRef, useEffect, SelectHTMLAttributes } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface CustomSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'subtle' | 'table' | 'amber';
  containerClassName?: string;
  onChange?: (e: { target: { value: string; name?: string } }) => void;
}

interface ParsedOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  icon: Icon,
  variant = 'default',
  containerClassName = '',
  className = '',
  children,
  value,
  onChange,
  disabled,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract option objects from React children
  const options: ParsedOption[] = [];

  const extractOptionsFromChildren = (childNodes: React.ReactNode) => {
    React.Children.forEach(childNodes, (child) => {
      if (!child || !React.isValidElement(child)) return;

      if (child.type === 'option') {
        const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
        const optValue = props.value !== undefined ? String(props.value) : String(props.children || '');
        options.push({
          value: optValue,
          label: props.children || optValue,
          disabled: props.disabled,
          className: props.className,
        });
      } else if (child.props && (child.props as { children?: React.ReactNode }).children) {
        extractOptionsFromChildren((child.props as { children?: React.ReactNode }).children);
      }
    });
  };

  extractOptionsFromChildren(children);

  const selectedOption = options.find((opt) => String(opt.value) === String(value)) || options[0];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelect = (optValue: string) => {
    if (disabled) return;
    setIsOpen(false);
    if (onChange) {
      onChange({
        target: {
          value: optValue,
          name,
        },
      });
    }
  };

  // Button styling variants
  let buttonStyle = "w-full text-left flex items-center justify-between transition-all font-extrabold text-xs rounded-xl border cursor-pointer select-none focus:outline-none ";

  if (variant === 'default') {
    buttonStyle += "bg-white border-slate-200/90 hover:border-slate-300 text-slate-800 shadow-2xs hover:shadow-xs py-2.5 ";
  } else if (variant === 'subtle') {
    buttonStyle += "bg-[#F3F7F7] hover:bg-white border-[#E2E8F0] hover:border-slate-300 text-[#2D3748] py-2 ";
  } else if (variant === 'table') {
    buttonStyle += "py-1.5 bg-white border-slate-200 text-slate-800 hover:border-slate-300 shadow-2xs ";
  } else if (variant === 'amber') {
    buttonStyle += "bg-amber-50/90 hover:bg-amber-100/90 border-amber-200/90 text-amber-900 py-2 ";
  }

  if (isOpen) {
    buttonStyle += " ring-2 ring-[#40C4C0]/40 border-[#40C4C0] bg-white ";
  }

  if (disabled) {
    buttonStyle += " opacity-50 cursor-not-allowed pointer-events-none ";
  }

  const paddingLeft = Icon ? 'pl-9 ' : 'pl-3.5 ';
  const paddingRight = 'pr-8 ';

  return (
    <div ref={containerRef} className={`relative min-w-[140px] ${containerClassName}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`${buttonStyle} ${paddingLeft} ${paddingRight} ${className}`}
      >
        <span className="truncate block">
          {selectedOption ? selectedOption.label : <span className="text-slate-400">Seleccionar...</span>}
        </span>
      </button>

      {/* Optional Leading Icon */}
      {Icon && (
        <Icon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none shrink-0" />
      )}

      {/* Trailing Animated Chevron */}
      <ChevronDown
        className={`w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none shrink-0 transition-transform duration-200 ${
          isOpen ? 'rotate-180 text-[#40C4C0]' : ''
        }`}
      />

      {/* Custom Floating Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl max-h-60 overflow-y-auto p-1.5 transition-all duration-150 animate-in fade-in-50 slide-in-from-top-1">
          {options.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-400 font-medium">Sin opciones</div>
          ) : (
            options.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer mb-0.5 last:mb-0 ${
                    isSelected
                      ? 'bg-[#40C4C0]/15 text-[#00807D] font-extrabold shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900'
                  } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : ''} ${opt.className || ''}`}
                >
                  <span className="truncate pr-2">{opt.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#00807D] shrink-0 stroke-[3]" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
