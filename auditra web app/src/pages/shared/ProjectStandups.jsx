import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, IconButton, List, ListItem,
  Divider, Button, Chip, Autocomplete, CircularProgress,
} from '@mui/material';
import { Send, Assignment, CheckCircle } from '@mui/icons-material';
import axiosClient from '../../api/axiosClient';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../contexts/AuthContext';

function formatTime(dt) {
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const KIND_LABELS = {
  work_to_do: { label: 'Work To Do', color: 'warning' },
  work_done: { label: 'Work Done', color: 'success' },
  free: { label: 'Message', color: 'default' },
};

export default function ProjectStandups({ projectId }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('free');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const currentUsername = user?.username || null;
  const currentUserId = user?.id || null;
  const currentDisplayName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim();

  const appendUniqueMessage = useCallback((incoming) => {
    if (!incoming) return;
    setMessages((prev) => {
      const incomingId = incoming.id;
      if (incomingId != null && prev.some((m) => m.id === incomingId)) {
        return prev;
      }
      return [...prev, incoming];
    });
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get(`/standups/projects/${projectId}/messages/`);
      setMessages(Array.isArray(res.data) ? res.data : []);
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadMessages();
    axiosClient.get(`/standups/projects/${projectId}/members/`).then((r) => setMembers(r.data || []));
  }, [projectId, loadMessages]);

  // WebSocket live updates — dedicated /ws/standups/<projectId>/ connection
  useEffect(() => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
    if (!token) return undefined;
    const base = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000').replace(/\/$/, '');
    const wsUrl = `${base}/ws/standups/${projectId}/?token=${token}`;
    let ws;
    let pingTimer;
    let reconnectTimer;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'standup_message' && data.message) {
            appendUniqueMessage(data.message);
          }
        } catch {}
      };
      ws.onopen = () => {
        pingTimer = setInterval(() => {
          try { ws.send(JSON.stringify({ action: 'ping' })); } catch {}
        }, 30000);
      };
      ws.onclose = () => {
        clearInterval(pingTimer);
        if (!closed) reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
    };

    connect();

    return () => {
      closed = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      try { ws && ws.close(); } catch {}
    };
  }, [projectId, appendUniqueMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    const payload = { body: body.trim(), kind };
    try {
      const res = await axiosClient.post(`/standups/projects/${projectId}/messages/post/`, payload);
      // Keep POST fallback for slower websocket delivery, deduped by id.
      appendUniqueMessage(res.data);
      setBody('');
      setKind('free');
    } catch {}
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === '@') {
      setMentionQuery('');
    }
  };

  const insertMention = (member) => {
    const name = member.username;
    const newBody = body.replace(/@[\w.-]*$/, `@${name} `);
    setBody(newBody);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const filteredMembers = mentionQuery !== null
    ? members.filter((m) =>
        m.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        (m.first_name + ' ' + m.last_name).toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
            <CircularProgress />
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', pt: 6, color: 'text.secondary' }}>
            <Typography>No messages yet. Start the standup!</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {messages.map((msg, i) => {
              const isMine =
                (currentUserId != null && msg.author === currentUserId) ||
                (currentUsername && msg.author_username === currentUsername) ||
                (currentDisplayName && msg.author_name === currentDisplayName);
              const seenByOthers = Array.isArray(msg.seen_by)
                ? msg.seen_by.filter((v) => v.username !== msg.author_username)
                : [];
              return (
                <ListItem
                  key={msg.id || i}
                  alignItems="flex-start"
                  sx={{ px: 0, py: 1.2, justifyContent: isMine ? 'flex-end' : 'flex-start' }}
                >
                  {!isMine && (
                    <UserAvatar
                      user={{ username: msg.author_name, profile_image_url: msg.author_avatar }}
                      size={36}
                      sx={{ mr: 1.5, mt: 0.5 }}
                    />
                  )}
                  <Paper
                    elevation={0}
                    sx={{
                      px: 1.5,
                      py: 1,
                      maxWidth: '82%',
                      borderRadius: 2,
                      bgcolor: isMine ? '#DCF8C6' : '#FFFFFF',
                      color: 'text.primary',
                      border: '1px solid',
                      borderColor: isMine ? '#b7e3a2' : 'divider',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={700} color={isMine ? 'success.dark' : 'primary.main'}>
                        {msg.author_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {msg.author_role}
                      </Typography>
                      <Chip
                        label={KIND_LABELS[msg.kind]?.label || msg.kind}
                        icon={
                          msg.kind === 'work_to_do'
                            ? <Assignment sx={{ fontSize: 12 }} />
                            : msg.kind === 'work_done'
                              ? <CheckCircle sx={{ fontSize: 12 }} />
                              : undefined
                        }
                        size="small"
                        color={KIND_LABELS[msg.kind]?.color || 'default'}
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ ml: 'auto' }}
                      >
                        {formatTime(msg.created_at)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {msg.body.split(' ').map((word, wi) =>
                        word.startsWith('@') ? (
                          <Typography
                            key={wi}
                            component="span"
                            color="primary.main"
                            fontWeight={700}
                          >
                            {word}{' '}
                          </Typography>
                        ) : `${word} `
                      )}
                    </Typography>
                    {isMine && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {seenByOthers.length > 0
                          ? `Seen by: ${seenByOthers.map((u) => u.name || u.username).join(', ')}`
                          : 'Sent'}
                      </Typography>
                    )}
                  </Paper>
                  {isMine && (
                    <UserAvatar
                      user={{ username: msg.author_name, profile_image_url: msg.author_avatar }}
                      size={36}
                      sx={{ ml: 1.5, mt: 0.5 }}
                    />
                  )}
                </ListItem>
              );
            })}
            <div ref={bottomRef} />
          </List>
        )}
      </Box>

      <Divider />

      {/* Template buttons */}
      <Box sx={{ px: 2, pt: 1, display: 'flex', gap: 1 }}>
        <Button
          size="small" variant={kind === 'work_to_do' ? 'contained' : 'outlined'}
          color="warning" startIcon={<Assignment />}
          onClick={() => setKind((k) => k === 'work_to_do' ? 'free' : 'work_to_do')}
        >
          Work To Do
        </Button>
        <Button
          size="small" variant={kind === 'work_done' ? 'contained' : 'outlined'}
          color="success" startIcon={<CheckCircle />}
          onClick={() => setKind((k) => k === 'work_done' ? 'free' : 'work_done')}
        >
          Work Done
        </Button>
      </Box>

      {/* Mention autocomplete */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <Paper sx={{ mx: 2, mb: 0.5, maxHeight: 160, overflow: 'auto', zIndex: 10 }} elevation={4}>
          <List dense disablePadding>
            {filteredMembers.map((m) => (
              <ListItem
                key={m.id}
                onClick={() => insertMention(m)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, px: 2, py: 0.75 }}
              >
                <UserAvatar user={m} size={24} sx={{ mr: 1 }} />
                <Typography variant="body2">{m.username}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>({m.role})</Typography>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Message input */}
      <Box sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
        <TextField
          inputRef={inputRef}
          multiline maxRows={4} fullWidth size="small"
          placeholder="Type a message... Use @ to mention"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            const match = e.target.value.match(/@([\w.-]*)$/);
            if (match) setMentionQuery(match[1]);
            else setMentionQuery(null);
          }}
          onKeyDown={handleKeyDown}
        />
        <IconButton color="primary" onClick={handleSend} disabled={!body.trim() || sending}>
          {sending ? <CircularProgress size={20} /> : <Send />}
        </IconButton>
      </Box>
    </Box>
  );
}
