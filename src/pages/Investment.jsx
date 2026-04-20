import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { FiTrendingUp, FiTrendingDown, FiMinus, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import './Investment.css';

const Investment = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGoldData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/gold/refresh`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch gold price. Make sure the Node backend is running and the bot is properly configured.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoldData();
  }, []);

  // Analysis logic
  const analyzeMarket = (current, history) => {
    if (!history || history.length === 0) return { trend: 'NEUTRAL', diff: 0, text: 'No historical data' };
    
    let min = Infinity;
    let max = -Infinity;

    // Average of sell prices
    const sum = history.reduce((acc, point) => {
      const sell = point.sell_price || 0;
      if (sell > 0 && sell < min) min = sell;
      if (sell > max) max = sell;
      return acc + sell;
    }, 0);
    const avg = sum / history.length;
    
    const currentSell = current.sell_price || 0;
    const diff = currentSell - avg;
    
    let trend = 'NEUTRAL';
    let text = 'Stagnant';
    if (diff > 500) {
      trend = 'UP';
      text = 'Strong Uptrend compared to average.';
    } else if (diff > 0) {
      trend = 'UP';
      text = 'Slightly elevated compared to average.';
    } else if (diff < -500) {
      trend = 'DOWN';
      text = 'Strong Downtrend compared to average.';
    } else if (diff < 0) {
      trend = 'DOWN';
      text = 'Slightly below average.';
    }

    return { trend, diff, text, avg, min, max };
  };

  const current = data?.current || {};
  const history = data?.history || [];
  const analysis = analyzeMarket(current, history);

  // Format Recharts data
  const chartData = history.map(h => ({
    date: h.post_date.split(' ')[0],
    sell: h.sell_price,
    buy: h.buy_price
  }));

  return (
    <div className="page-container animate-fade-in investment-page">
      <header className="page-header flex-between">
        <h1 className="page-title">Investment Hub</h1>
        <button 
          className="refresh-btn" 
          onClick={fetchGoldData} 
          disabled={loading}
        >
          <FiRefreshCw className={loading ? 'spinning' : ''} />
          {loading ? 'Crawling Facebook...' : 'Force Refresh'}
        </button>
      </header>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {data?.stale && !error && (
        <div className="stale-banner">
          <FiAlertTriangle />
          <span>
            Không thể lấy giá mới từ Facebook. Đang hiển thị dữ liệu cũ nhất ({data.current?.post_date}).
            {data.stale_reason && <em> — {data.stale_reason}</em>}
          </span>
        </div>
      )}

      {loading && !data && (
        <div className="loading-state glass-panel">
          <div className="spinner"></div>
          <h2>Activating AI Bot</h2>
          <p>The Python bot is automatically opening Facebook, scanning the latest post, and extracting data. This typically takes ~30 seconds...</p>
        </div>
      )}

      {data && (
        <div className="investment-grid">
          {/* Latest Price Widget */}
          <div className="gold-widget glass-panel">
            <h2 className="widget-title">Latest SJC Gold</h2>
            <div className="gold-type">Type: {current.gold_type}</div>
            
            <div className="prices-display">
              <div className="price-box">
                <span className="label">Sell Price</span>
                <span className="value">{(current.sell_price || 0).toLocaleString()} <small>VND</small></span>
              </div>
              <div className="price-box buy">
                <span className="label">Buy Price</span>
                <span className="value">{(current.buy_price || 0).toLocaleString()} <small>VND</small></span>
              </div>
            </div>
            
            <div className="time-info">Latest scan: {current.post_date} {current.time}</div>
          </div>

          {/* Analysis Widget */}
          <div className="analysis-widget glass-panel">
            <h2 className="widget-title">Market Analysis</h2>
            
            <div className={`trend-indicator ${analysis.trend.toLowerCase()}`}>
              {analysis.trend === 'UP' && <FiTrendingUp className="trend-icon" />}
              {analysis.trend === 'DOWN' && <FiTrendingDown className="trend-icon" />}
              {analysis.trend === 'NEUTRAL' && <FiMinus className="trend-icon" />}
              <span className="trend-text">{analysis.text}</span>
            </div>

            <div className="analysis-stats">
              <div className="stat-line">
                <span>30-Day Average:</span>
                <span>{Math.round(analysis.avg).toLocaleString()} VND</span>
              </div>
              <div className="stat-line">
                <span>30-Day Min / Max:</span>
                <span>{analysis.min !== Infinity ? analysis.min.toLocaleString() : 0} / {analysis.max !== -Infinity ? analysis.max.toLocaleString() : 0} VND</span>
              </div>
              <div className="stat-line">
                <span>Difference:</span>
                <span className={analysis.diff >= 0 ? 'up' : 'down'}>
                  {analysis.diff >= 0 ? '+' : ''}{Math.round(analysis.diff).toLocaleString()} VND
                </span>
              </div>
            </div>
          </div>

          {/* Chart Widget */}
          <div className="chart-widget glass-panel">
            <h2 className="widget-title">Historical Trends (30 Points)</h2>
            <div className="chart-container">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                    <YAxis domain={['auto', 'auto']} stroke="rgba(255,255,255,0.5)" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#171923', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Line type="monotone" dataKey="sell" stroke="#ef4444" name="Sell Price" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="buy" stroke="#10b981" name="Buy Price" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="no-data">Not enough data to graph.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Investment;
