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
  getSettings: () => request('/settings'),
  updateSettings: (settings) => request('/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),
  validateKey: (provider, key) => request('/settings/validate-key', { method: 'POST', body: JSON.stringify({ provider, key }) }),
  getUsage: () => request('/usage'),
  cancelRun: (runId) => request(`/runs/${runId}/cancel`, { method: 'POST' }),
  getTemplates: () => request('/templates'),
  getChannels: () => request('/channels'),
  createChannel: (data) => request('/channels', { method: 'POST', body: JSON.stringify(data) }),
  deleteChannel: (id) => request(`/channels/${id}`, { method: 'DELETE' }),
  testChannel: (id) => request(`/channels/${id}/test`, { method: 'POST' }),
  findTelegramChat: (bot_token) => request('/channels/telegram/find-chat', { method: 'POST', body: JSON.stringify({ bot_token }) }),
  getBotChannels: (botId) => request(`/bots/${botId}/channels`),
  updateBotChannels: (botId, data) => request(`/bots/${botId}/channels`, { method: 'PUT', body: JSON.stringify(data) }),
  duplicateBot: (id) => request(`/bots/${id}/duplicate`, { method: 'POST' }),
  getBotStats: (id) => request(`/bots/${id}/stats`),
  getPipelines: () => request('/pipelines'),
  createPipeline: (data) => request('/pipelines', { method: 'POST', body: JSON.stringify(data) }),
  deletePipeline: (id) => request(`/pipelines/${id}`, { method: 'DELETE' }),
  runPipeline: (id) => request(`/pipelines/${id}/run`, { method: 'POST' }),
  getPipelineRuns: (id) => request(`/pipelines/${id}/runs`),
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
  exportBot: (id) => request(`/bots/${id}/export`),
  importBot: (data) => request('/bots/import', { method: 'POST', body: JSON.stringify(data) }),
  exportCsv: (id) => `${BASE}/bots/${id}/export-csv`,
  getSystem: () => request('/system'),
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
