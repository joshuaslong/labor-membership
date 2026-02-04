# Labor Organizing Interface Design System

## Direction: Solidarity & Purpose

This is not consumer SaaS. This is an organizing hub. The interface reflects the labor movement: grounded, purposeful, dense with information that matters, built from industrial materials.

**Domain:** Union halls, solidarity movements, organizing drives, chapter meetings, industrial materials, worker mobilization, collective action.

**Color World:** Concrete floors, steel tables, red solidarity banners, stone buildings, worn wood, typed manifestos, painted signs.

**Signature:** Uppercase section headers (RECENT MEMBERS, ACTIONS) — the industrial label maker, the protest sign. Clear, direct, functional communication.

**Intent:** Dense organizing hub for labor organizers. They're coordinating chapters, mobilizing members, tracking actions. Every pixel must earn its space. Functional, not friendly. Purposeful, not polished.

---

## Foundation

**Depth Strategy:** Borders-only
No drop shadows. Structure through light borders (stone-200/300). Surfaces differentiate through border weight and subtle background shifts, not elevation.

**Spacing Base:** 4px (Tailwind defaults)
Tighter than consumer apps. Use gap-3 (12px) for dense layouts, gap-6 (24px) only when breathing room matters.

**Typography:**
System font stack (already defined). Semibold headers for presence. Uppercase for section labels. Tabular numerals for data.

---

## Color System

### Foundation
- **Background:** bg-stone-50 (warm industrial base)
- **Surface:** bg-white (clean workspace)
- **Borders:** border-stone-200 (structure), border-stone-300 (hover emphasis)
- **Text:** text-gray-900 (primary), text-gray-600/500 (secondary/tertiary)

### Brand
- **Labor Red:** bg-labor-red, hover:bg-labor-red-600 (primary actions only)
- **Text Labor Red:** text-labor-red (links, emphasis)

### Semantic
- **Success:** bg-green-50 text-green-700 border-green-200
- **Warning:** bg-amber-50 text-amber-700 border-amber-200
- **Error:** bg-red-50 text-red-700 border-red-200
- **Neutral:** bg-stone-100 text-gray-600 border-stone-200

---

## Layout Patterns

### Dense Stats Grid
```
grid grid-cols-2 lg:grid-cols-4 gap-3
```
Each stat card:
- `bg-white border border-stone-200 rounded p-4`
- Uppercase label: `text-xs uppercase tracking-wide text-gray-500 font-medium mb-1`
- Value: `text-2xl font-semibold text-gray-900 tabular-nums`
- Subtext: `text-xs text-gray-600 mt-0.5`

### Asymmetric Content Grid
```
grid lg:grid-cols-3 gap-6
lg:col-span-2 (main content)
lg:col-span-1 (sidebar)
```

### Section Headers
Uppercase, functional clarity:
```
text-sm font-semibold text-gray-900 uppercase tracking-wide
```

### Dense Action Lists
```
space-y-0.5
block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded
```

---

## Components

### Primary Button (Labor Red)
```
btn-primary
inline-flex items-center justify-center gap-2
bg-labor-red text-white font-medium
px-4 py-2 rounded
transition-colors duration-150
hover:bg-labor-red-600
```

### Secondary Button (Borders-only)
```
btn-secondary
inline-flex items-center justify-center gap-2
bg-white text-gray-700 font-medium
px-4 py-2 rounded
border border-stone-200
transition-colors duration-150
hover:bg-stone-50 hover:border-stone-300
```

### Card (Borders-only)
```
card
bg-white rounded border border-stone-200 p-6
```

### Card with Hover
```
card-hover
card + transition-all duration-150
hover: border-stone-300 + subtle shadow
```

### Input Field
```
input-field
w-full px-3 py-2
bg-white text-gray-900
border border-stone-200 rounded
focus:border-labor-red focus:ring-1 focus:ring-labor-red
hover:border-stone-300 (when not focused)
```

### Badge (Status Indicators)
```
badge
inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
```
Variants: badge-success, badge-warning, badge-error, badge-neutral

### Links
```
link: text-labor-red hover:text-labor-red-600
link-subtle: text-gray-500 hover:text-gray-900
```

### Divider
```
border-t border-stone-200
```

---

## Page Structure

### Header Bar
```
border-b border-stone-200 bg-white
max-w-7xl mx-auto px-4 sm:px-6 py-4
```

### Content Container
```
max-w-7xl mx-auto px-4 sm:px-6 py-6
```

### Admin Dashboard Pattern
1. Header bar with page title
2. Dense stats grid (2 cols mobile, 4 cols desktop, gap-3)
3. Asymmetric content grid (2/3 main + 1/3 sidebar, gap-6)
4. Uppercase section headers
5. Compact list items with hover states

---

## Defaults to Reject

**Generic dashboard template:** Replaced with dense organizing hub layout
**Spacious padding:** Replaced with functional density (gap-3 for stats)
**Drop shadows:** Replaced with borders-only depth strategy
**Gray palette:** Replaced with warmer stone palette
**Sentence-case headers:** Replaced with uppercase section labels

---

## Application Notes

- Every surface must be barely different but distinguishable (subtle layering principle)
- No decorative color — color signals action, status, or identity
- Hover states: border-stone-300, bg-stone-50 (not gray)
- Focus states: labor-red ring
- Uppercase only for section headers and labels, not body text
- Tabular numerals for all numeric data
- Icons minimal, functional, never decorative

---

## Files Using This System

- `src/app/globals.css` — token definitions
- `src/app/admin/page.js` — admin dashboard (reference implementation)

---

## Expansion Guidance

When building new pages:
1. Ask: What does this human need to accomplish here?
2. Choose layout density based on task (organizing work = dense, reading content = spacious)
3. Use uppercase headers for functional sections
4. Apply borders-only depth consistently
5. Use labor-red sparingly (primary actions only)
6. Keep stone palette warm, not cold gray
