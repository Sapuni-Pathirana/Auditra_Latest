import { Search } from '@mui/icons-material';
import {
  Paper,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
} from '@mui/material';

export default function ProjectsTabFilters({
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
    <Tabs value={tab} onChange={(_, value) => onTabChange(value)} sx={tabsSx}>
      {tabs.map((tabItem) => (
        <Tab key={tabItem.key} label={tabItem.label} />
      ))}
    </Tabs>
  );

  return (
    <>
      {wrapTabsInPaper ? <Paper sx={tabsPaperSx}>{tabsNode}</Paper> : tabsNode}

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
    </>
  );
}
