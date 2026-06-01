---
name: ZANI Executive
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#44474f'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#75777f'
  outline-variant: '#c4c6d2'
  surface-tint: '#495e8a'
  primary: '#00020a'
  on-primary: '#ffffff'
  primary-container: '#001b44'
  on-primary-container: '#7084b3'
  inverse-primary: '#b1c6f9'
  secondary: '#0052d2'
  on-secondary: '#ffffff'
  secondary-container: '#346cec'
  on-secondary-container: '#fefcff'
  tertiary: '#030011'
  on-tertiary: '#ffffff'
  tertiary-container: '#26005d'
  on-tertiary-container: '#9965ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#b1c6f9'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#314671'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b3c5ff'
  on-secondary-fixed: '#001849'
  on-secondary-fixed-variant: '#003fa5'
  tertiary-fixed: '#eaddff'
  tertiary-fixed-dim: '#d2bbff'
  on-tertiary-fixed: '#25005a'
  on-tertiary-fixed-variant: '#5a00c6'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
  success-vibrant: '#28C76F'
  error-base: '#ba1a1a'
  warning-soft: '#FF9F43'
  ai-gradient-start: '#7C3AED'
  ai-gradient-end: '#1E6BFF'
  ai-glow: rgba(124, 58, 237, 0.15)
  surface-muted: '#F2F4F7'
typography:
  kpi-display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  kpi-display-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  sidebar-width: 260px
  card-gap: 20px
  container-padding-desktop: 24px
  container-padding-mobile: 16px
  gutter-md: 16px
---

## Brand & Style
ZANI Executive is a high-fidelity business management interface designed for clarity, authority, and intelligence. The brand personality is professional and systematic, yet elevated by "Smart Intellect" features that utilize Glassmorphism and vibrant gradients to denote AI-driven insights. 

The aesthetic is **Corporate Modern** with a **Glassmorphic** layer for high-priority intelligence components. It targets business owners who require a "Control Tower" view of their operations, balancing traditional reliability with forward-thinking technology. The emotional response should be one of "calm control" and "informed urgency."

## Colors
The palette is rooted in a deep navy **Primary** (#001b44) representing stability and trust. The **Secondary** blue drives action and primary interactions, while a **Tertiary** violet is reserved specifically for AI and premium "smart" features.

Backgrounds utilize a very light cool gray (#f8f9fb) to reduce eye strain. Semantic colors are vibrant to ensure critical business metrics (growth vs. loss) are immediately legible. A signature dual-tone gradient (Violet to Blue) is used for the "AI Glass" effect to differentiate automated insights from standard data.

## Typography
The system relies exclusively on **Inter** to maintain a utilitarian, Swiss-inspired clarity. 

- **KPI Display:** Large, bold, and slightly tightened letter-spacing for maximum impact on core business metrics.
- **Headlines:** Semi-bold weights used for section titling to establish clear hierarchy.
- **Labels:** Used for metadata and button text; often uppercase with slight tracking for technical feel.
- **Scalability:** Headline and KPI sizes transition downward by 20-25% on mobile devices to preserve screen real estate without losing emphasis.

## Layout & Spacing
The layout employs a **Sidebar-Fixed Fluid Grid**. On desktop, a 260px sidebar provides persistent navigation, while the main canvas expands to fill the viewport (capped at 1400px for legibility). 

**Spacing Principles:**
- **Bento Grid:** Information is clustered into logical blocks (cards) using a consistent 20px gap.
- **Vertical Rhythm:** Sections are separated by 32px to 40px (4-5x base unit).
- **Mobile Adaptation:** The sidebar disappears in favor of a bottom navigation bar and a sticky top-header. Margins compress from 24px to 16px to maximize content area.

## Elevation & Depth
Depth is expressed through three distinct layers:
1.  **Canvas (Level 0):** Background (#f8f9fb) provides the foundation.
2.  **Raised Surface (Level 1):** White cards (#FFFFFF) with a very subtle, tinted shadow (`0 4px 20px rgba(0, 47, 108, 0.04)`) create a clean, flat-depth look.
3.  **Glass (Level 2/Feature):** The AI Insights card uses a translucent background (`rgba(255, 255, 255, 0.8)`) with a 12px backdrop-blur and a 1px gradient-border to signal "active intelligence" floating above the data.

Outlines are used sparingly (Level 1 borders at 20% opacity) to define boundaries without adding visual weight.

## Shapes
The system uses a "Rounded" language to soften the corporate aesthetic and feel more accessible. 
- **Standard Cards/Sections:** 0.75rem (12px) for a modern, friendly container.
- **Buttons & Inputs:** 0.5rem (8px) for structural stability.
- **Badges/Search Bars:** Full pill-shape (9999px) to distinguish them from actionable containers.
- **Icon Containers:** 8px to 12px depending on context.

## Components
- **Buttons:** Primary buttons are solid Secondary Blue. Ghost/Secondary buttons use a light gray background or a simple border.
- **KPI Cards:** Feature a title, a large value, a percentage trend badge, and a low-opacity sparkline at the bottom for historical context.
- **Urgent Actions:** Use colored left-accents (4px) to denote priority (e.g., Warning Orange for budget, Secondary Blue for assignments).
- **Navigation:** Vertical on desktop with a high-contrast active state (border-left + tinted background). Horizontal on mobile with clear iconography.
- **Badges:** Small, rounded-pill shapes with high-contrast text and low-opacity backgrounds (e.g., Success Green at 10% opacity for "Online").
- **Inputs:** Search fields are pill-shaped with background fills (#F2F4F7) and no borders, using icons as leading elements.