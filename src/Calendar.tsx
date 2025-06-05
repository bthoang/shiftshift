import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Users, Edit2, Check, X } from 'lucide-react';

interface CalendarProps {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  renderDay: (date: Date) => React.ReactNode;
  onDayClick?: (date: Date) => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  currentMonth,
  onMonthChange,
  renderDay,
  onDayClick
}) => {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonth);
    if (direction === 'next') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    onMonthChange(newDate);
  };

  const monthYear = currentMonth.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  const days = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Calendar Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="text-xl font-bold text-gray-900">{monthYear}</h3>
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-700 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => (
            <div
              key={index}
              className={`min-h-[100px] ${date ? 'border rounded-lg' : ''}`}
              onClick={() => date && onDayClick && onDayClick(date)}
            >
              {date && (
                <div className="h-full">
                  <div className="p-2">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {date.getDate()}
                    </div>
                    {renderDay(date)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
