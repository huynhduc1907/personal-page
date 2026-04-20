import React, { useState, useEffect } from 'react';
import { Solar } from 'lunar-javascript';
import './LunarCalendar.css';

const LunarCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const startDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const monthDays = daysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const grid = Array.from({ length: 42 }, (_, i) => {
    if (i >= startDay && i < startDay + monthDays) {
      const solarDay = i - startDay + 1;
      const solarObj = Solar.fromYmd(currentDate.getFullYear(), currentDate.getMonth() + 1, solarDay);
      const lunar = solarObj.getLunar();
      return { 
        solar: solarDay, 
        lunar: `${lunar.getDay()}/${lunar.getMonth()}`
      };
    }
    return null;
  });

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="calendar-container glass-panel">
      <div className="calendar-header">
        <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
        <div className="cal-controls">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>Prev</button>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>Next</button>
        </div>
      </div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="cal-day-header">{day}</div>
        ))}
        {grid.map((dayObj, i) => (
          <div key={i} className={`cal-cell ${dayObj ? 'has-date' : ''}`}>
            {dayObj && (
              <>
                <span className="solar-date">{dayObj.solar}</span>
                <span className="lunar-date">{dayObj.lunar}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="gcal-events">
        <h3>Upcoming Google Events</h3>
        <p className="placeholder-text">Please set up your Google Calendar API keys to sync real events.</p>
      </div>
    </div>
  );
};

export default LunarCalendar;
