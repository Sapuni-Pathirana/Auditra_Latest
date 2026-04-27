import { Search } from '@mui/icons-material';
import {
  Box,
  Chip,
  Paper,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
} from '@mui/material';

const TAB_BADGE_COLORS = {
  all: { bg: '#64748B15', color: '#475569' },
  pending: { bg: '#1E88E515', color: '#1E88E5' },
  accepted: { bg: '#1565C015', color: '#1565C0' },
  rejected: { bg: '#DC262615', color: '#DC2626' },
  default: { bg: '#64748B15', color: '#475569' },
};

const TabLabelWithCount = ({ label, count, colorKey }) => {
  const badge = TAB_BADGE_COLORS[colorKey] || TAB_BADGE_COLORS.default;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {label}
      {count !== undefined && count !== null && (
        <Chip
          label={count}
          size="small"
          sx={{
            bgcolor: badge.bg,
            color: badge.color,
            fontWeight: 700,
            height: 20,
            border: `1px solid ${badge.color}50`,
            '& .MuiChip-label': { px: 1 },
          }}
        />
      )}
    </Box>
  );
};

export default function TabFilters({
  tab,
  onTabChange,
  tabs,
  tabsSx,
  search,
  onSearchChange,
  searchPlaceholder = 'Search projects...',
  searchSx,
  searchSize,
  wrapTabsInPaper = false,
  tabsPaperSx,
}) {
  const tabsNode = (
    <Tabs
      value={tab}
      onChange={(_, value) => onTabChange(value)}
      sx={{
        '& .MuiTabs-indicator': {
          height: 3,
          borderRadius: 999,
        },
        '& .MuiTab-root': {
          textTransform: 'none',
          fontWeight: 600,
          minHeight: 48,
          px: 2,
          mr: 1,
          borderRadius: 2,
        },
        ...tabsSx,
      }}
    >
      {tabs.map((tabItem, index) => (
        <Tab
          key={tabItem.key}
          value={tabItem.value ?? tabItem.key ?? index}
          label={(
            <TabLabelWithCount
              label={tabItem.label}
              count={tabItem.count}
              colorKey={tabItem.colorKey || tabItem.key}
            />
          )}
        />
      ))}
    </Tabs>
  );

  const shouldRenderSearch = search !== undefined && typeof onSearchChange === 'function';

  return (
    <>
      {wrapTabsInPaper ? <Paper sx={tabsPaperSx}>{tabsNode}</Paper> : tabsNode}

      {shouldRenderSearch && (
        <TextField
          fullWidth
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={searchSx}
          size={searchSize}
        />
      )}
    </>
  );
}