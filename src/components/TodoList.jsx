import React, { useState, useEffect } from 'react';
import './TodoList.css';
import { FiCheckCircle, FiCircle, FiPlus, FiTrash2 } from 'react-icons/fi';

const TodoList = () => {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('personal_todos');
    if (saved) return JSON.parse(saved);
    return [{ id: Date.now(), text: 'Explore your new dashboard!', completed: false }];
  });
  const [input, setInput] = useState('');

  useEffect(() => {
    localStorage.setItem('personal_todos', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setTasks([{ id: Date.now(), text: input.trim(), completed: false }, ...tasks]);
    setInput('');
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="todo-container glass-panel">
      <h2>Daily Tasks</h2>
      <form onSubmit={addTask} className="todo-form">
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder="What needs to be done?" 
        />
        <button type="submit" className="add-btn"><FiPlus /></button>
      </form>
      <ul className="todo-list">
        {tasks.map(task => (
          <li key={task.id} className={`todo-item ${task.completed ? 'completed' : ''}`}>
            <button className="check-btn" onClick={() => toggleTask(task.id)}>
              {task.completed ? <FiCheckCircle className="checked" /> : <FiCircle />}
            </button>
            <span className="task-text">{task.text}</span>
            <button className="delete-btn" onClick={() => deleteTask(task.id)}>
              <FiTrash2 />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodoList;
