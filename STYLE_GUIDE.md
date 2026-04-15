# Auditra Web App - Style Guide

## Color Palette

### Blue Variations (Primary)

| Name         | Hex Code  | Usage                                      |
|--------------|-----------|---------------------------------------------|
| Dark Blue    | `#0D47A1` | Reviewed status, dark accents               |
| Primary Blue | `#1565C0` | Approved, accepted, completed, primary actions |
| Medium Blue  | `#1E88E5` | Pending, awaiting, medium emphasis           |
| Bright Blue  | `#2563EB` | Active, in-progress statuses                |
| Light Blue   | `#42A5F5` | Light accents, dark mode success            |
| Soft Blue    | `#90CAF9` | Fallback/default label color                |

### Red (Error/Rejection Only)

| Name | Hex Code  | Usage                          |
|------|-----------|--------------------------------|
| Red  | `#DC2626` | Rejected, cancelled, error, absent |

### Neutral

| Name       | Hex Code  | Usage                     |
|------------|-----------|---------------------------|
| Slate      | `#64748B` | Draft status, default fallback |

---

## Label / Chip Styles

All labels and chips across the project follow a **consistent bordered style**. No solid-background chips are used.

### Standard Pattern

```jsx
<Chip
  label="Label Text"
  size="small"
  sx={{
    bgcolor: `${color}15`,        // Very subtle tinted background (8% opacity)
    color: color,                  // Colored text
    fontWeight: 600,
    fontSize: '0.72rem',
    border: `1px solid ${color}50`, // Visible border (31% opacity)
  }}
/>
```

### StatusChip Component (`src/components/StatusChip.jsx`)

Reusable component for status labels. Accepts `status` and optional `label` props.

```jsx
<StatusChip status="approved" />
<StatusChip status="pending" label="Custom Label" />
```

**Internal styling:**
- Background: `${color}15` (subtle tint)
- Text: status color from `getStatusColor()`
- Border: `1px solid ${color}50`
- Font: 600 weight, 12px, capitalize

### Status Color Mapping (`src/utils/helpers.js`)

```
pending     → #1E88E5 (Medium Blue)
active      → #2563EB (Bright Blue)
in_progress → #2563EB (Bright Blue)
completed   → #1565C0 (Primary Blue)
approved    → #1565C0 (Primary Blue)
accepted    → #1565C0 (Primary Blue)
submitted   → #1565C0 (Primary Blue)
present     → #1565C0 (Primary Blue)
reviewed    → #0D47A1 (Dark Blue)
half_day    → #1E88E5 (Medium Blue)
cancelled   → #DC2626 (Red)
rejected    → #DC2626 (Red)
absent      → #DC2626 (Red)
draft       → #64748B (Slate)
default     → #64748B (Slate)
```

### Priority Color Mapping

```
high   → #0D47A1 (Dark Navy Blue)
medium → #1E88E5 (Medium Blue)
low    → #1565C0 (Primary Blue)
```

### Inline Chip Examples

When creating chips directly (not using `StatusChip`), follow the same pattern:

```jsx
// Single color chip
<Chip
  label="Hired"
  size="small"
  sx={{
    fontSize: '0.72rem',
    fontWeight: 600,
    color: '#1565C0',
    bgcolor: '#1565C015',
    border: '1px solid #1565C050',
  }}
/>

// Dynamic color chip using a config object
const config = { color: '#1E88E5', bg: '#1E88E515' };

<Chip
  label={config.label}
  size="small"
  sx={{
    bgcolor: config.bg,
    color: config.color,
    fontWeight: 600,
    fontSize: 12,
    border: `1px solid ${config.color}50`,
  }}
/>
```

### Config Object Pattern

For pages with multiple statuses, define a config object:

```js
const STATUS_CHIP_COLORS = {
  pending:  '#1E88E5',
  reviewed: '#0D47A1',
  rejected: '#DC2626',
  approved: '#1565C0',
  assigned: '#1565C0',
};

// Usage in chip sx:
{
  color: STATUS_CHIP_COLORS[status] || '#90CAF9',
  bgcolor: `${STATUS_CHIP_COLORS[status] || '#90CAF9'}15`,
  border: `1px solid ${STATUS_CHIP_COLORS[status] || '#90CAF9'}50`,
}
```

For configs with background included:

```js
const RESPONSE_CONFIG = {
  pending:  { label: 'Awaiting',  color: '#1E88E5', bg: '#1E88E515' },
  accepted: { label: 'Accepted',  color: '#1565C0', bg: '#1565C015' },
  rejected: { label: 'Rejected',  color: '#DC2626', bg: '#DC262615' },
};
```

---

## Button Styles

### Theme Defaults (`src/theme.js`)

All buttons inherit these global defaults:
- `textTransform: 'none'` (no uppercase)
- `borderRadius: 8px`
- `fontWeight: 600`

### Primary Action Buttons

Used for main actions (Approve, Accept, Submit, Save, Create).

```jsx
<Button
  variant="contained"
  color="primary"
  startIcon={<CheckCircleIcon />}
>
  Approve
</Button>
```

### Outlined Buttons

Used for secondary actions or paired with a primary action.

```jsx
<Button
  variant="outlined"
  color="primary"
>
  Cancel
</Button>
```

### Error / Destructive Buttons

Used for reject, delete, or destructive actions.

```jsx
// Outlined style (preferred for reject actions)
<Button
  variant="outlined"
  color="error"
  startIcon={<CancelIcon />}
>
  Reject
</Button>

// Contained style (for delete/remove)
<Button
  variant="contained"
  color="error"
>
  Delete
</Button>
```

### Small Table Action Buttons

Used inside table rows for compact actions.

```jsx
<Button
  size="small"
  variant="outlined"
  sx={{ textTransform: 'none', whiteSpace: 'nowrap', minWidth: 0, px: 1 }}
>
  Review
</Button>
```

### Disabled / Status Buttons

Used to display a status as a non-interactive button.

```jsx
<Button
  size="small"
  variant="outlined"
  disabled
  sx={{ textTransform: 'none', minWidth: 0, px: 1 }}
>
  Assigned
</Button>
```

### Icon Buttons

Used in table rows for view/action icons.

```jsx
<IconButton size="small" color="primary">
  <Visibility fontSize="small" />
</IconButton>
```

---

## Key Rules

1. **Blue only** - All label/chip/button colors must use blue variations. No green, amber, purple, or other colors.
2. **Red preserved** - Red (`#DC2626`) is only used for error states: rejected, cancelled, absent, and error actions.
3. **No solid-background chips** - All chips use the bordered style: subtle tinted background + colored text + visible border.
4. **Consistent opacity suffixes**:
   - `15` suffix for backgrounds (e.g., `#1565C015`) = ~8% opacity
   - `20` suffix for backgrounds (e.g., `#1565C020`) = ~13% opacity
   - `50` suffix for borders (e.g., `#1565C050`) = ~31% opacity
5. **White text** - Only used in landing page elements and auth pages, never in label/chip components.
6. **Fallback color** - Use `#90CAF9` (Soft Blue) as the fallback for unknown statuses, never grey.
7. **`color="primary"`** - Use for all MUI button color props. Never use `color="success"` or `color="warning"`.
