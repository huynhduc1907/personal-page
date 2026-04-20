import React from 'react';
import './Entertainment.css';
import { SiFacebook, SiTiktok, SiZalo } from 'react-icons/si';
import { FaNewspaper } from 'react-icons/fa';

const Entertainment = () => {
  const links = [
    { name: 'Facebook', url: 'https://facebook.com', icon: <SiFacebook className="brand-icon facebook" /> },
    { name: 'TikTok', url: 'https://tiktok.com', icon: <SiTiktok className="brand-icon tiktok" /> },
    { name: 'Zalo', url: 'https://chat.zalo.me', icon: <SiZalo className="brand-icon zalo" /> },
    { name: 'VnExpress (VN)', url: 'https://vnexpress.net/', icon: <FaNewspaper className="brand-icon" style={{ color: '#9f1b22' }} /> },
    { name: 'NHK News (JP)', url: 'https://www3.nhk.or.jp/news/', icon: <FaNewspaper className="brand-icon" style={{ color: '#0055a4' }} /> },
  ];

  return (
    <div className="page-container animate-fade-in">
      <h1 className="page-title">Entertainment Hub</h1>
      <div className="cards-grid">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card glass-panel entertainment-card"
          >
            <div className="icon-wrapper">{link.icon}</div>
            <h3>{link.name}</h3>
            <p>Open {link.name} in a new tab</p>
          </a>
        ))}
      </div>
    </div>
  );
};

export default Entertainment;
