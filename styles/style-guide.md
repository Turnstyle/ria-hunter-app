# RIA Hunter Style Guide

## Color Palette

- **Primary**: Blue tones for main actions and branding
  - Main: `primary-600` (#0284c7)
  - Light: `primary-200` (#b9e6fe)
  - Dark: `primary-800` (#075985)

- **Secondary**: Slate gray for text and secondary elements
  - Main: `secondary-500` (#64748b)
  - Light: `secondary-200` (#e2e8f0)
  - Dark: `secondary-800` (#1e293b)

- **Accent**: Green tones for success states and highlights
  - Main: `accent-500` (#10b981)
  - Light: `accent-200` (#a7f3d0)
  - Dark: `accent-700` (#047857)

- **Neutral**: For backgrounds and subtle elements
  - White: `#ffffff`
  - Light gray: `secondary-100` (#f1f5f9)
  - Dark gray: `secondary-300` (#cbd5e1)

## Typography

- **Fonts**:
  - Sans-serif: `Inter` (fallback to system-ui, sans-serif)
  - Monospace: `Roboto Mono` (fallback to monospace)

- **Font Sizes**:
  - Headings:
    - H1: `text-3xl md:text-4xl lg:text-5xl font-bold`
    - H2: `text-2xl md:text-3xl font-bold`
    - H3: `text-xl md:text-2xl font-semibold`
    - H4: `text-lg font-semibold`
  - Body:
    - Regular: `text-base`
    - Small: `text-sm`
    - Extra small: `text-xs`

## Spacing

- Use Tailwind's built-in spacing scale
- Additional custom spacing:
  - `128`: 32rem
  - `144`: 36rem

## Borders & Shadows

- Rounded corners: `rounded-md` (default) or `rounded-lg` (larger elements)
- Custom rounded: `rounded-4xl` (2rem) for hero elements
- Shadows: 
  - Light: `shadow-sm`
  - Medium: `shadow`
  - Emphasized: `shadow-lg`

## Components

### Buttons

- Primary: `bg-primary-600 hover:bg-primary-700 text-white rounded-md px-4 py-2`
- Secondary: `bg-secondary-200 hover:bg-secondary-300 text-secondary-800 rounded-md px-4 py-2`
- Accent: `bg-accent-500 hover:bg-accent-600 text-white rounded-md px-4 py-2`
- Disabled: `bg-secondary-200 text-secondary-400 cursor-not-allowed rounded-md px-4 py-2`

### Cards

- Standard: `bg-white rounded-lg shadow p-4 sm:p-6`
- Highlighted: `bg-white rounded-lg shadow-lg border border-accent-200 p-4 sm:p-6`

### Forms

- Input: `border border-secondary-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500`
- Label: `text-sm font-medium text-secondary-700 mb-1`
- Error: `text-red-600 text-sm mt-1`

## Responsive Design

- Mobile-first approach using Tailwind breakpoints:
  - `sm`: 640px (small devices)
  - `md`: 768px (medium devices)
  - `lg`: 1024px (large devices)
  - `xl`: 1280px (extra large devices)
  - `2xl`: 1536px (2x extra large devices)

- Always test both portrait and landscape modes on:
  - iPhone (375px-428px)
  - iPad (768px-1024px)

## Accessibility

- Ensure text contrast meets WCAG AA standards (4.5:1 for normal text)
- Use semantic HTML elements
- Include aria-labels on interactive elements
- Manage focus states properly
