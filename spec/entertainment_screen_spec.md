# Entertainment Screen - Detailed Design Specification

## 1. Overview
The Entertainment screen is designed as a centralized portal for quick navigation to social media and news outlets. It prioritizes readability, fast interaction, and visual appeal using interactive widget cards.

## 2. Layout Structure
The interface utilizes a responsive CSS Grid system (`grid-template-columns: repeat(auto-fill, minmax(250px, 1fr))`) to automatically adapt to the user's screen size, ensuring a neat arrangement of app launcher cards.

## 3. Component Details

### 3.1. Social Media Links
Each social platform is represented as a clickable Widget Card featuring the platform's native brand colors on hover.
- **Facebook:** Deep blue accent.
- **TikTok:** Black/Cyan/Magenta layered accent.
- **Zalo:** Light blue accent.

### 3.2. News Portals
To stay updated with local and international trends:
- **VnExpress:** Vietnam's leading news portal.
- **NHK News:** Reputable Japanese news outlet.

### 3.3. Widget Interaction Model
- **Default State:** Glassmorphism panel (`background: rgba(255, 255, 255, 0.03)`).
- **Hover State:** The card slightly elevates (`transform: translateY(-5px)`), the border brightens, and a subtle drop-shadow emerges matching the platform's brand color. 
- **Action:** Clicking anywhere on the card opens the specified URL in a new browser tab (`target="_blank" rel="noopener noreferrer"`).

## 4. Scalability
The grid structure allows infinite horizontal and vertical expansion. Future links can simply be appended to the static array mapping without requiring CSS layout modifications.
