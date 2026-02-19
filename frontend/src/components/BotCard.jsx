export default function BotCard({ bot, onSelect, onRun }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-700 transition cursor-pointer group"
      onClick={() => onSelect(bot.id)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{bot.emoji}</span>
          <h3 className="font-semibold text-white">{bot.name}</h3>
        </div>
        {bot.schedule && (
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">⏰ {bot.schedule}</span>
        )}
      </div>
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{bot.description || bot.prompt}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{bot.model}</span>
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => onRun(bot.id)}
            className="bg-indigo-600/80 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-lg transition">
            ▶️ Run
          </button>
          <button onClick={() => onSelect(bot.id)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition">
            📋 Log
          </button>
        </div>
      </div>
    </div>
  );
}
