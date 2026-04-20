import React, { useState } from 'react';
import './AiDock.css';
import { SiOpenai } from 'react-icons/si';

const AiDock = () => {
  const [activeAI, setActiveAI] = useState('chatgpt');

  return (
    <div className="ai-dock-container glass-panel">
      <div className="ai-header">
        <h2>AI Integration</h2>
        <div className="ai-tabs">
          <button 
            className={`ai-tab ${activeAI === 'chatgpt' ? 'active' : ''}`}
            onClick={() => setActiveAI('chatgpt')}
          >
            <SiOpenai /> ChatGPT
          </button>
          <button 
            className={`ai-tab ${activeAI === 'claude' ? 'active' : ''}`}
            onClick={() => setActiveAI('claude')}
          >
            Claude
          </button>
        </div>
      </div>
      
      <div className="warning-banner">
        Note: If the embedded view below is blocked or refuses to connect, it's due to the AI's strict security policies. Click the button below to open in a new window instead.
      </div>
      
      <div className="ai-actions">
        {activeAI === 'chatgpt' ? (
          <button className="launch-btn" onClick={() => window.open('https://chatgpt.com', '_blank', 'width=800,height=600')}>Launch ChatGPT App</button>
        ) : (
          <button className="launch-btn" onClick={() => window.open('https://claude.ai', '_blank', 'width=800,height=600')}>Launch Claude App</button>
        )}
      </div>

      <div className="ai-webview">
        {activeAI === 'chatgpt' ? (
          <iframe src="https://chatgpt.com" title="ChatGPT Webview" sandbox="allow-same-origin allow-scripts allow-forms" />
        ) : (
          <iframe src="https://claude.ai" title="Claude Webview" sandbox="allow-same-origin allow-scripts allow-forms" />
        )}
      </div>
    </div>
  );
};

export default AiDock;
