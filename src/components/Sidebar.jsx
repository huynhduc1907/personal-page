import React from 'react';
import { NavLink } from 'react-router-dom';
import { FiBriefcase, FiAperture, FiTrendingUp } from 'react-icons/fi';
import './Sidebar.css';

const Sidebar = () => {
  const navItems = [
    { name: 'Work', path: '/work', icon: <FiBriefcase /> },
    { name: 'Entertainment', path: '/entertainment', icon: <FiAperture /> },
    { name: 'Investment', path: '/investment', icon: <FiTrendingUp /> },
  ];

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <h2>My Dashboard</h2>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {navItems.map((item) => (
            <li key={item.name}>
              <NavLink 
                to={item.path} 
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                <span className="icon">{item.icon}</span>
                <span className="text">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="sidebar-footer">
        <p>AI Integrated Workflow</p>
      </div>
    </aside>
  );
};

export default Sidebar;
