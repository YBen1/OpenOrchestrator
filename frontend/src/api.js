const BASE = '/api';

async function request(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  listBots: () => request('/bots'),
  getBot: (id) => request(`/bots/${id}`),
  createBot: (data) => request('/bots', { method: 'POST', body: JSON.stringify(data) }),
  updateBot: (id, data) => request(`/bots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBot: (id) => request(`/bots/${id}`, { method: 'DELETE' }),
  runBot: (id) => request(`/bots/${id}/run`, { method: 'POST' }),
  listRuns: (id) => request(`/bots/${id}/runs`),
  listResults: (id) => request(`/bots/${id}/results`),
  listDocs: (id) => request(`/bots/${id}/docs`),
  activity: () => request('/activity'),
  listTriggers: () => request('/triggers'),
  createTrigger: (data) => request('/triggers', { method: 'POST', body: JSON.stringify(data) }),
  deleteTrigger: (id) => request(`/triggers/${id}`, { method: 'DELETE' }),
};

export function connectWs(botId, onMessage) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/bots/${botId}`);
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => setTimeout(() => connectWs(botId, onMessage), 3000);
  return ws;
}
