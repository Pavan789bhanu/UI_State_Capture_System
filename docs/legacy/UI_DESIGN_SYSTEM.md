# UI Design System - 0.05 Probability

## Design Philosophy

This UI implements a **0.05 probability design** system, meaning:
- **95% consistency** across all components
- **5% variation** only for functional necessity
- Maximum uniformity in spacing, sizing, and interactions
- Highly predictable and maintainable codebase

## Theme System

### Available Themes

#### 1. **Light Theme** (Default)
- Primary Background: `#f8fafc`
- Secondary Background: `#ffffff`
- Ideal for daytime use and standard environments

#### 2. **Dark Theme**
- Primary Background: `#0f172a`
- Secondary Background: `#1e293b`
- Reduced eye strain in low-light conditions

#### 3. **Midnight Theme**
- Primary Background: `#030712`
- Secondary Background: `#111827`
- Maximum contrast reduction for night use

### Theme Switching
Click the Settings icon (⚙️) in the header to access theme controls:
- **Visual theme selector** with icons
- **Instant switching** with smooth transitions
- **Persistent selection** (saved to localStorage)
- **System-wide application** via CSS variables

## Animation System

### Login Animations
When the application loads, components animate in with:
- **Fade-in-up**: Main content (600ms ease-out)
- **Slide-in-left**: Sidebar (600ms ease-out)
- **Slide-in-right**: Header (600ms ease-out)
- **Staggered delays**: List items appear sequentially

### Interaction Animations

#### Ripple Effect
- **Triggered on**: Button clicks, interactive elements
- **Visual feedback**: Wave-like expansion from click point
- **Duration**: 600ms
- **Implementation**: `useRipple()` hook

#### Hover Glow
- **Triggered on**: Mouse hover over cards and interactive elements
- **Effect**: Radial gradient glow centered at element
- **Transition**: 300ms smooth fade
- **Purpose**: Subtle visual hierarchy

#### Scale Animations
- **Hover**: Elements scale to 102% (2% growth)
- **Active/Click**: Elements scale to 98% (2% reduction)
- **Duration**: 200ms
- **Purpose**: Tactile button feedback

### Card Animations
- **Hover lift**: Cards translate -2px and gain enhanced shadow
- **Scale-in on load**: Cards appear with 400ms scale animation
- **Staggered appearance**: Each card delays by 100ms

## Standardized Design System

### Spacing (0.05 Probability)
```css
Padding: p-4 (16px) - Universal standard
Gaps: gap-4 (16px) - Consistent spacing
Margins: mb-4 (16px) or mb-6 (24px)
Border radius: rounded-lg (8px)
```

### Typography
```css
Headings (h1): text-2xl (24px), font-semibold
Subheadings (h2): text-base (16px), font-semibold
Body text: text-sm (14px), font-medium
Small text: text-xs (12px)
Font family: Inter (Google Fonts)
```

### Icon Sizes
```css
Standard icons: 16px
Large icons: 20px
No variations: Removed 12px, 14px, 18px
Stroke width: 2 (universal)
```

### Button Standards
```css
Primary: btn-primary class
Secondary: btn-secondary class
Padding: px-4 py-2 (16px horizontal, 8px vertical)
Border radius: rounded-lg (8px)
Font: text-sm font-medium
```

### Table Design
```css
Headers: px-4 py-3, uppercase text-xs
Cells: px-4 py-3, text-sm
Borders: 1px solid border-color
Background: Alternating on hover only
```

### Card Standards
```css
Padding: p-4 (16px)
Border: 1px solid border-color
Shadow: Soft (0 1px 3px)
Hover shadow: Medium (0 4px 12px)
Border radius: rounded-lg (8px)
```

## CSS Variables System

### Theme-aware Variables
All colors use CSS custom properties for theme switching:

```css
--bg-primary: Primary background color
--bg-secondary: Secondary background (cards, panels)
--bg-tertiary: Tertiary background (input fields, hover states)
--text-primary: Primary text color
--text-secondary: Secondary text (labels, descriptions)
--border-color: Border and divider color
--brand: Brand/accent color
--brand-hover: Brand hover state
--shadow: Shadow color with opacity
```

### Usage in Components
```jsx
style={{ backgroundColor: 'rgb(var(--bg-secondary))' }}
style={{ color: 'rgb(var(--text-primary))' }}
style={{ borderColor: 'rgb(var(--border-color))' }}
```

## Animation Classes

### Available Animations
```css
.animate-fade-in-up - Fade in from bottom (600ms)
.animate-slide-in-left - Slide from left (600ms)
.animate-slide-in-right - Slide from right (600ms)
.animate-scale-in - Scale from 90% to 100% (400ms)
.animate-gradient - Background gradient shift (8s loop)
```

### Staggered Animations
Use inline styles for sequential delays:
```jsx
style={{ animationDelay: `${index * 0.1}s` }}
```

## Interactive Effects

### Ripple Container
Add to clickable elements:
```jsx
className="ripple-container"
onClick={createRipple}
```

### Hover Glow
Add to cards and interactive elements:
```jsx
className="hover-glow"
```

### Gradient Animation
Add to brand elements:
```jsx
className="animate-gradient"
style={{ background: 'linear-gradient(135deg, rgb(var(--brand)), rgb(var(--brand-hover)))' }}
```

## Effects Toggle

Users can disable animations:
- Access via Settings menu (⚙️)
- Toggle "Animations" switch
- Persists across sessions
- Respects user preferences for accessibility

## Performance Considerations

### Optimizations
- **CSS transitions over JS**: Hardware-accelerated
- **Will-change hints**: Transform and opacity
- **Reduced motion**: Respects `prefers-reduced-motion`
- **Lazy animations**: Only active components animate
- **Single paint**: Transform/opacity don't trigger reflow

### Best Practices
- Animations < 600ms for perceived speed
- Use `ease-out` for entrance animations
- Use `ease-in` for exit animations
- Stagger < 100ms per item
- Hover effects < 300ms

## Component Examples

### Animated Button
```jsx
<button 
  onClick={createRipple}
  className="btn-primary ripple-container"
>
  Click Me
</button>
```

### Themed Card
```jsx
<div 
  className="card p-4 hover-glow"
  style={{ 
    backgroundColor: 'rgb(var(--bg-secondary))',
    color: 'rgb(var(--text-primary))'
  }}
>
  Content
</div>
```

### Staggered List
```jsx
{items.map((item, index) => (
  <div 
    key={item.id}
    className="animate-fade-in-up"
    style={{ animationDelay: `${index * 0.1}s` }}
  >
    {item.name}
  </div>
))}
```

## Browser Compatibility

### Supported Features
- CSS Custom Properties (all modern browsers)
- CSS Animations (all modern browsers)
- CSS Transitions (all modern browsers)
- localStorage (all browsers)

### Fallbacks
- Default light theme if localStorage fails
- Standard colors if CSS variables unsupported
- Graceful degradation without animations

## Accessibility

### Features
- Color contrast meets WCAG AA standards (all themes)
- Animation toggle for motion sensitivity
- Keyboard navigation support
- Screen reader compatible
- Focus indicators on interactive elements

### ARIA Support
- Semantic HTML structure
- Proper heading hierarchy
- Button roles and labels
- Status indicators for workflows

## Design Tokens

### Spacing Scale
```
4px   - gap-1   - Tight spacing
8px   - gap-2   - Button padding
16px  - gap-4   - Standard (95% of uses)
24px  - gap-6   - Section spacing
32px  - gap-8   - Large spacing
```

### Shadow Scale
```
Soft:   0 1px 3px rgba(0,0,0,0.05)  - Default cards
Medium: 0 4px 12px rgba(0,0,0,0.07) - Hover state
```

### Border Radius
```
rounded-lg: 8px - Universal standard (buttons, cards, inputs)
rounded-full: 50% - Avatars, badges
rounded-md: 6px - Status badges, small elements
```

## Migration from 0.1 to 0.05

### Key Changes
1. **Reduced spacing variations**: Only p-4, mb-4, mb-6
2. **Standardized icon sizes**: 16px and 20px only
3. **Unified transitions**: 200ms (interactions), 300ms (themes)
4. **Theme system**: CSS variables replace static colors
5. **Animation system**: Keyframe animations replace simple transitions

### Breaking Changes
None - All changes are additive and backwards compatible.

## Future Enhancements

### Planned Features
- [ ] High contrast theme
- [ ] Custom theme creator
- [ ] Animation presets (subtle, normal, enhanced)
- [ ] Transition curve customization
- [ ] Background pattern options
- [ ] Sound effects (optional)
- [ ] Haptic feedback (mobile)

## Developer Guide

### Adding New Components
1. Use CSS variables for all colors
2. Apply standard padding (p-4)
3. Add ripple-container for clickable elements
4. Include hover-glow for cards
5. Use standard icon sizes (16px or 20px)
6. Apply fade-in-up animation

### Theme Testing
Test all components in all three themes:
```bash
# Open DevTools Console
document.documentElement.setAttribute('data-theme', 'light')
document.documentElement.setAttribute('data-theme', 'dark')
document.documentElement.setAttribute('data-theme', 'midnight')
```

### Performance Testing
Monitor animation performance:
- Open Chrome DevTools > Performance
- Record interaction
- Check for 60fps maintenance
- Ensure no layout thrashing

## Summary

The 0.05 probability design system provides:
- ✅ **3 beautiful themes** (light, dark, midnight)
- ✅ **Smooth animations** (login, hover, click)
- ✅ **Ripple effects** on all interactions
- ✅ **95% consistency** across all components
- ✅ **Theme persistence** via localStorage
- ✅ **Animation toggle** for accessibility
- ✅ **Professional appearance** with minimal variation
- ✅ **Maintainable codebase** with standardized patterns

This creates a modern, engaging user experience while maintaining extreme consistency and predictability in the design system.
