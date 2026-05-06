import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Work from './pages/Work';
import Entertainment from './pages/Entertainment';
import Investment from './pages/Investment';
import Transcribe from './pages/Transcribe';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <main className="main-content animate-fade-in">
          <Routes>
            <Route path="/" element={<Navigate to="/work" replace />} />
            <Route path="/work" element={<Work />} />
            <Route path="/entertainment" element={<Entertainment />} />
            <Route path="/investment" element={<Investment />} />
            <Route path="/transcribe" element={<Transcribe />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
