import React from 'react';
import TodoList from '../components/TodoList';
import LunarCalendar from '../components/LunarCalendar';
import AiDock from '../components/AiDock';
import './Work.css';

const Work = () => {
  return (
    <div className="page-container animate-fade-in work-page">
      <header className="work-header">
        <h1 className="page-title">Workspace</h1>
        <p>Your ultimate dashboard for productivity.</p>
      </header>
      
      <div className="work-grid">
        <div className="work-left">
          <TodoList />
          <AiDock />
        </div>
        <div className="work-right">
          <LunarCalendar />
        </div>
      </div>
    </div>
  );
};

export default Work;
