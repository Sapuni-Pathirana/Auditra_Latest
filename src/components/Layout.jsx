import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import logo from '../assets/logo.webp';
import {
  Box, Drawer, AppBar, Toolbar, Typography, IconButton, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Avatar, Divider, useMediaQuery,
  useTheme, Menu, MenuItem, Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { roleMenuConfig, getRoleLabel } from '../utils/roleConfig';
import NotificationDropdown from './NotificationDropdown';

const DRAWER_WIDTH = 260;
const DRAWER_COLLAPSED = 72;

export default function Layout() {
  const { user, role, passwordChanged, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const menuItems = roleMenuConfig[role] || roleMenuConfig.unassigned;
  const currentWidth = isMobile ? DRAWER_WIDTH : (collapsed ? DRAWER_COLLAPSED : DRAWER_WIDTH);
  const c = theme.palette.custom;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <Box sx={{
        p: collapsed && !isMobile ? 1.5 : 2,
        textAlign: 'center',
        minHeight: 72,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Box
          component="img"
          src={logo}
          alt="Auditra"
          sx={{
            width: '100%',
            maxWidth: collapsed && !isMobile ? 36 : 140,
            height: (collapsed && !isMobile) ? 40 : 'auto',
            objectFit: (collapsed && !isMobile) ? 'cover' : 'contain',
            objectPosition: 'left',
            transition: 'all 0.25s ease',
          }}
        />
      </Box>

      <Divider sx={{ borderColor: c.sidebarDivider }} />

      {/* User info */}
      <Box sx={{ p: collapsed && !isMobile ? 1.5 : 2, display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: collapsed && !isMobile ? 'center' : 'flex-start' }}>
        <Avatar
          sx={{
            width: 38,
            height: 38,
            bgcolor: c.sidebarAvatarBg,
            border: `1.5px solid ${c.sidebarAvatarBorder}`,
            flexShrink: 0,
          }}
        >
          <PersonIcon sx={{ fontSize: 22, color: c.sidebarAccent }} />
        </Avatar>
        {(!collapsed || isMobile) && (
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: c.sidebarTextActive, lineHeight: 1.3 }} noWrap>
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.first_name || user?.username}
            </Typography>
            <Typography variant="caption" sx={{ color: c.sidebarAccent, fontSize: 11 }}>
              {getRoleLabel(role)}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: c.sidebarDivider }} />

      {/* Navigation */}
      <List sx={{ flex: 1, px: collapsed && !isMobile ? 0.5 : 1, py: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const button = (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  minHeight: 44,
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  px: collapsed && !isMobile ? 1.5 : 2,
                  bgcolor: isActive ? c.sidebarActive : 'transparent',
                  '&:hover': { bgcolor: c.sidebarHover },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? c.sidebarAccent : c.sidebarText,
                    minWidth: collapsed && !isMobile ? 0 : 40,
                    justifyContent: 'center',
                  }}
                >
                  <Icon fontSize="small" />
                </ListItemIcon>
                {(!collapsed || isMobile) && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? c.sidebarTextActive : c.sidebarText,
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
          return collapsed && !isMobile ? (
            <Tooltip title={item.label} placement="right" key={item.path}>
              {button}
            </Tooltip>
          ) : (
            <Box key={item.path}>{button}</Box>
          );
        })}
      </List>

      <Divider sx={{ borderColor: c.sidebarDivider }} />

      {/* Bottom section */}
      <List sx={{ px: collapsed && !isMobile ? 0.5 : 1, pb: 2 }}>
        {/* Collapse toggle (desktop only) */}
        {!isMobile && (
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => setCollapsed(!collapsed)}
              sx={{
                borderRadius: 2,
                minHeight: 44,
                justifyContent: collapsed ? 'center' : 'flex-start',
                px: collapsed ? 1.5 : 2,
                '&:hover': { bgcolor: c.sidebarHover },
              }}
            >
              <ListItemIcon sx={{ color: c.sidebarCollapseText, minWidth: collapsed ? 0 : 40, justifyContent: 'center' }}>
                {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText primary="Collapse" primaryTypographyProps={{ fontSize: 14, color: c.sidebarCollapseText }} />
              )}
            </ListItemButton>
          </ListItem>
        )}
        <ListItem disablePadding>
          <Tooltip title={collapsed && !isMobile ? 'Logout' : ''} placement="right">
            <ListItemButton
              onClick={handleLogout}
              sx={{
                borderRadius: 2,
                minHeight: 44,
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                px: collapsed && !isMobile ? 1.5 : 2,
                '&:hover': { bgcolor: c.sidebarLogoutHover },
              }}
            >
              <ListItemIcon sx={{ color: c.sidebarLogout, minWidth: collapsed && !isMobile ? 0 : 40, justifyContent: 'center' }}>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              {(!collapsed || isMobile) && (
                <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: 14, color: c.sidebarLogout }} />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: currentWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: currentWidth,
              transition: 'width 0.25s ease',
              overflowX: 'hidden',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar position="sticky" elevation={0}>
          <Toolbar>
            {isMobile && (
              <IconButton onClick={() => setMobileOpen(true)} edge="start" sx={{ mr: 2 }}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
              {menuItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
            </Typography>

            {/* Notifications */}
            <NotificationDropdown />

            {/* User menu */}
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(59,130,246,0.15)' : '#E8F4FD',
                  transition: 'background-color 0.2s',
                  '&:hover': { bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(59,130,246,0.25)' : '#D6ECF8' },
                }}
              >
                <PersonIcon sx={{ fontSize: 22, color: 'primary.main' }} />
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={!!anchorEl}
              onClose={() => setAnchorEl(null)}
              PaperProps={{ sx: { mt: 1, minWidth: 200, borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' } }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="body2" fontWeight={600}>
                  {user?.first_name && user?.last_name
                    ? `${user.first_name} ${user.last_name}`
                    : user?.username}
                </Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/dashboard/profile'); }} sx={{ py: 1.2 }}>Profile</MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/dashboard/change-password'); }} sx={{ py: 1.2 }}>Change Password</MenuItem>
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); handleLogout(); }} sx={{ py: 1.2, color: 'error.main' }}>Logout</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, p: { xs: 1.5, sm: 2, md: 3 } }}>
          {['client', 'agent'].includes(role) && passwordChanged === false && location.pathname !== '/dashboard/force-change-password' ? (
            <Navigate to="/dashboard/force-change-password" replace />
          ) : (
            <Outlet />
          )}
        </Box>
      </Box>
    </Box>
  );
}
