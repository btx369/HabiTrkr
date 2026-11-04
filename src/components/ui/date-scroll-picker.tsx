import React, { useState, useRef, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Calendar, LucideIcon } from 'lucide-react';
import { parseStoredDate, toDateKey } from '@/lib/dateUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDateLocale } from '@/lib/dateLocale';


interface ScrollPickerProps {
  value: Date;
  onChange: (date: Date) => void;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The twelve month names for the active language, replacing a hardcoded English array.
 *
 * These are produced by date-fns rather than by the translation dictionary, because date-fns
 * already ships correct month names for every language the app offers and month names are
 * exactly the kind of thing a hand-written list gets subtly wrong.
 */
const useMonthNames = (): string[] => {
  const locale = useDateLocale();
  return useMemo(
    () => Array.from({ length: 12 }, (_, month) => format(new Date(2024, month, 1), 'LLLL', { locale })),
    [locale],
  );
};

const getDaysInMonth = (month: number, year: number) => {
  return new Date(year, month + 1, 0).getDate();
};

export const ScrollColumn = ({ 
  items, 
  selectedIndex, 
  onSelectionChange, 
  height = 200 
}: {
  items: (string | number)[];
  selectedIndex: number;
  onSelectionChange: (index: number) => void;
  height?: number;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const itemHeight = 40;
  const visibleItems = Math.floor(height / itemHeight);
  const centerOffset = Math.floor(visibleItems / 2);

  // Scroll to selected item whenever it changes
  useEffect(() => {
    if (containerRef.current && !isScrollingRef.current) {
      const scrollTop = selectedIndex * itemHeight;
      containerRef.current.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  }, [selectedIndex, itemHeight]);

  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>();

  const handleScroll = () => {
    if (!containerRef.current || isScrollingRef.current) return;
    
    // Clear existing timeout
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    // Set new timeout for scroll end detection
    scrollTimeout.current = setTimeout(() => {
      if (containerRef.current) {
        const scrollTop = containerRef.current.scrollTop;
        const nearestIndex = Math.round(scrollTop / itemHeight);
        const clampedIndex = Math.max(0, Math.min(items.length - 1, nearestIndex));
        
        // Snap to nearest item
        containerRef.current.scrollTo({
          top: clampedIndex * itemHeight,
          behavior: 'smooth'
        });
        
        if (clampedIndex !== selectedIndex) {
          onSelectionChange(clampedIndex);
        }
      }
    }, 150);
  };

  const handleTouchStart = () => {
    isScrollingRef.current = true;
  };

  const handleTouchEnd = () => {
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    const newIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + delta));
    if (newIndex !== selectedIndex) {
      onSelectionChange(newIndex);
    }
  };

  const handleItemClick = (index: number) => {
    onSelectionChange(index);
  };

  return (
    <div className="flex-1 relative">
      <div 
        ref={containerRef}
        className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] snap-y snap-mandatory"
        style={{ height: `${height}px` }}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ height: `${centerOffset * itemHeight}px` }} />
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center justify-center text-center cursor-pointer transition-all duration-200 snap-center",
              "hover:bg-hover/50",
              index === selectedIndex 
                ? "text-foreground font-semibold scale-110" 
                : "text-muted-foreground"
            )}
            style={{ height: `${itemHeight}px` }}
            onClick={() => handleItemClick(index)}
          >
            {item}
          </div>
        ))}
        <div style={{ height: `${centerOffset * itemHeight}px` }} />
      </div>
      
      {/* Selection indicator */}
      <div 
        className="absolute left-0 right-0 border-t border-b border-primary/30 bg-primary/5 pointer-events-none"
        style={{
          top: `${centerOffset * itemHeight}px`,
          height: `${itemHeight}px`,
        }}
      />
    </div>
  );
};

export function DateScrollPicker({ 
  value, 
  onChange, 
  onCancel, 
  onConfirm, 
  open, 
  onOpenChange 
}: ScrollPickerProps) {
  const { t } = useLanguage();
  const monthNames = useMonthNames();
  const [tempDate, setTempDate] = useState(value);

  useEffect(() => {
    if (open) {
      setTempDate(value);
    }
  }, [open, value]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 200 }, (_, i) => currentYear - 100 + i);
  const selectedDayIndex = tempDate.getDate() - 1;
  const selectedMonthIndex = tempDate.getMonth();
  let selectedYearIndex = years.indexOf(tempDate.getFullYear());
  
  // Ensure year index is valid and reset to current date if out of range
  if (selectedYearIndex === -1) {
    setTempDate(new Date());
    selectedYearIndex = years.indexOf(currentYear);
  }
  selectedYearIndex = Math.max(0, selectedYearIndex);

  const daysInMonth = getDaysInMonth(selectedMonthIndex, tempDate.getFullYear());
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handleDayChange = (index: number) => {
    const newDate = new Date(tempDate);
    newDate.setDate(index + 1);
    setTempDate(newDate);
  };

  const handleMonthChange = (index: number) => {
    const newDate = new Date(tempDate);
    newDate.setMonth(index);
    
    // Adjust day if it doesn't exist in the new month
    const daysInNewMonth = getDaysInMonth(index, newDate.getFullYear());
    if (newDate.getDate() > daysInNewMonth) {
      newDate.setDate(daysInNewMonth);
    }
    
    setTempDate(newDate);
  };

  const handleYearChange = (index: number) => {
    const newDate = new Date(tempDate);
    const newYear = years[index];
    newDate.setFullYear(newYear);
    
    // Adjust for leap year
    const daysInNewMonth = getDaysInMonth(newDate.getMonth(), newYear);
    if (newDate.getDate() > daysInNewMonth) {
      newDate.setDate(daysInNewMonth);
    }
    
    setTempDate(newDate);
  };

  const handleConfirm = () => {
    onChange(tempDate);
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md mx-auto p-0">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('selectDate')}</h3>
          
          <div className="flex gap-4 mb-6">
            {/* Day Column */}
            <div className="flex-1">
              <div className="text-sm font-medium text-center mb-2 text-muted-foreground">{t('dayView')}</div>
              <ScrollColumn
                items={days}
                selectedIndex={Math.min(selectedDayIndex, days.length - 1)}
                onSelectionChange={handleDayChange}
              />
            </div>
            
            {/* Month Column */}
            <div className="flex-1">
              <div className="text-sm font-medium text-center mb-2 text-muted-foreground">{t('monthView')}</div>
              <ScrollColumn
                items={monthNames}
                selectedIndex={selectedMonthIndex}
                onSelectionChange={handleMonthChange}
              />
            </div>
            
            {/* Year Column */}
            <div className="flex-1">
              <div className="text-sm font-medium text-center mb-2 text-muted-foreground">{t('year')}</div>
              <ScrollColumn
                items={years}
                selectedIndex={selectedYearIndex}
                onSelectionChange={handleYearChange}
              />
            </div>
          </div>
          
          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              {t('cancel')}
            </Button>
            <Button onClick={handleConfirm} className="flex-1">
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface DatePickerInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  label?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconPosition?: 'left' | 'right';
}

export function DatePickerInput({ value, onChange, className, id, label, icon: Icon, iconColor, iconPosition = 'right' }: DatePickerInputProps) {
  const { t } = useLanguage();
  const dateLocale = useDateLocale();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  
  // Parse the date value, ensuring we always have a valid Date object
  const getValidDate = (dateString: string | undefined): Date => {
    if (!dateString) return new Date();
    // A local day, not UTC midnight, or the picker opens (and saves) the day before.
    return parseStoredDate(dateString) ?? new Date();
  };
  
  const dateValue = getValidDate(value);
  
  const handleDateChange = (newDate: Date) => {
    onChange(toDateKey(newDate));
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return t('selectDate');
    const date = parseStoredDate(dateString) ?? new Date();
    // This was `toLocaleDateString('en-US', …)`, which printed "Oct 2, 2026" whatever
    // language the app was set to. 'PP' is date-fns' localised medium date.
    return format(date, 'PP', { locale: dateLocale });
  };

  const IconComponent = Icon || Calendar;

  return (
    <>
      <div className={cn("relative", className)}>
        {label && (
          /*
           * `mb-2`, not `mb-1`. The 4px this used was one of three different label gaps in the
           * same editor — 0px in TitleInput, 4px here, 8px in the sections that relied on a
           * wrapper. 8px matches those and matches the field above and below it.
           */
          <Label className="text-sm text-muted-foreground mb-2 block">{label}</Label>
        )}
        <div className="relative">
          {iconPosition === 'left' && (
            <IconComponent 
              className={cn(
                "absolute left-3 h-4 w-4 pointer-events-none top-1/2 transform -translate-y-1/2"
              )}
              color={iconColor}
            />
          )}
          <input
            id={id}
            type="text"
            value={formatDisplayDate(value)}
            readOnly
            onClick={() => setIsPickerOpen(true)}
            className={cn(
              "w-full h-10 py-2 text-sm border border-input rounded-md bg-muted cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              iconPosition === 'left' ? "pl-10 pr-3" : "px-3"
            )}
            placeholder={t('selectDate')}
          />
          {iconPosition === 'right' && (
            <IconComponent 
              className={cn(
                "absolute right-3 h-4 w-4 pointer-events-none top-1/2 transform -translate-y-1/2",
                !iconColor && "text-muted-foreground"
              )}
              color={iconColor}
            />
          )}
        </div>
      </div>
      
      <DateScrollPicker
        value={dateValue}
        onChange={handleDateChange}
        onCancel={() => setIsPickerOpen(false)}
        onConfirm={() => setIsPickerOpen(false)}
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
      />
    </>
  );
}