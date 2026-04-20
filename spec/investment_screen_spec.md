# Investment Screen - Detailed Design Specification

## 1. Overview
The Investment screen is a data-driven interface that integrates directly with a locally hosted Python scripting bot (`get_web_data.py`). It fetches live SJC Gold prices from Facebook, updates historical JSON logs, and visually graphs market trends dynamically.

## 2. Data Flow & Backend Integration
- **API Endpoint:** `/api/gold/refresh` hosted via an Express.js Node backend.
- **Process:**
  1. Frontend React executes a GET request.
  2. Backend spawns the Python Bot via `child_process`.
  3. Python utilizes Playwright and EasyOCR to scan Facebook feeds.
  4. Data is stored in `history.json` and returned dynamically to the frontend.

## 3. Component Details (`Investment.jsx`)

### 3.1. Loading State
- Because the Python Playwright bot requires ~30 seconds to run invisibly, the UI features an overlay spinner (`.loading-state`) indicating exactly what the AI is doing ("Activating AI Bot... Crawling Facebook...").

### 3.2. Latest Price Widget
- Displays the most recent data block extracted.
- **Data Points:** Gold Type (9999/SJC), Sell Price, Buy Price, and the timestamp of the Facebook post.
- Employs `.price-box` styling (Red for Sell, Green for Buy).

### 3.3. Market Analysis Widget
- Computes trend logic entirely on the Frontend (React).
- **Core Metrics:**
  - **30-Day Average:** Mathematical mean of all historical sell prices.
  - **30-Day Min/Max:** Iterates through historical data to find the absolute floor and ceiling prices.
  - **Difference:** Current Sell Price minus the 30-Day Average.
- **Trend Engine:** Evaluates the `Difference` to output semantic trends (e.g., "Strong Uptrend", "Stagnant", "Slightly below average") mapped dynamically to React Icons (`FiTrendingUp`, `FiTrendingDown`).

### 3.4. Historical Line Chart Widget
- **Library:** `recharts` (`ResponsiveContainer`, `LineChart`).
- **Data Mapping:** Extracts the `post_date` (X-Axis) and visualizes both `sell_price` (Red Line) and `buy_price` (Green Line) on the Y-Axis.
- Features custom glassmorphism Tooltips activated on hover.

## 4. Error Handling
- Includes an `.error-banner` fallback. If the Node Server is dead or Python crashes, the UI immediately alerts the user clearly rather than hanging indefinitely.
- Missing values (`null`) from the backend are safely coalesced (`|| 0`) or skipped to prevent component crashes.
