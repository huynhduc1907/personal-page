# Work Screen - Detailed Design Specification

## 1. Overview
The Work screen acts as the primary productivity hub of the Personal Dashboard. It integrates task management, advanced date tracking, and quick access to AI assistants, wrapped in a modern Glassmorphism UI.

## 2. Layout Structure
The screen is divided into two primary columns using CSS Grid/Flexbox:
- **Left Column (Productivity):** Contains the To-Do List and Lunar Calendar.
- **Right Column (AI Tools):** Contains the AI Assistant Dock (ChatGPT & Claude).

## 3. Component Details

### 3.1. To-Do List Widget (`TodoList.jsx`)
- **Purpose:** Allow the user to track daily tasks permanently.
- **Data Persistence:** Uses `localStorage` (key: `todo_list`) to save tasks across browser sessions.
- **UI Elements:**
  - Input field for new tasks.
  - Add button.
  - Dynamic list of tasks. Each task has a checkbox (to toggle completion status) and a Delete button.
- **Behavior:** Completed tasks feature a strike-through text effect and lowered opacity.

### 3.2. Lunar Calendar Widget (`LunarCalendar.jsx`)
- **Purpose:** Display the current Gregorian (Solar) date alongside its parallel Lunar date.
- **Logic:** Utilizes the `lunar-javascript` library to calculate the exact Lunar date, month, year, and Zodiac sign based on the current system date.
- **UI Elements:**
  - Large display of the current active date.
  - Sub-text translating the date into Lunar semantics.

### 3.3. AI Integration Dock (`AiDock.jsx`)
- **Purpose:** Provide immediate access to Large Language Models without leaving the dashboard.
- **UI Elements:**
  - Two primary panels for ChatGPT and Claude.
  - "Quick Launch" action buttons.
- **Security Bypass Logic:** Because both OpenAI and Anthropic strictly forbid `<iframe>` embedding (via `X-Frame-Options` and `CSP`), the widgets act as stylized launcher cards using `target="_blank"` to securely spawn new tabs while retaining the dashboard's design aesthetics.

## 4. Styling Notes
- Adheres to the global Dark Mode theme (`--bg-primary`, `--text-primary`).
- Uses `.glass-panel` utility class for translucent backgrounds and subtle borders.
