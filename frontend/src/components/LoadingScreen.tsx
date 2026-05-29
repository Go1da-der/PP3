import { motion } from 'framer-motion'

const LoadingScreen = () => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.22),_transparent_38%),linear-gradient(160deg,_#06131d_0%,_#102434_55%,_#18384a_100%)] px-6 text-slate-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:68px_68px]" />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex max-w-sm flex-col items-center gap-6 rounded-[2rem] border border-white/[0.15] bg-white/10 px-10 py-12 text-center shadow-[0_30px_80px_rgba(3,7,18,0.45)] backdrop-blur"
      >
        <motion.div
          className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/20 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-3xl font-black text-slate-950"
          animate={{ rotate: [0, 6, -6, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          IT
        </motion.div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.38em] text-amber-200/90">
            Notification Center
          </p>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Поднимаем рабочее пространство команды
          </h1>
          <p className="text-sm leading-6 text-slate-300">
            Загружаем пользователей, каналы и ленту уведомлений.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="h-3 w-3 rounded-full bg-amber-300"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -8, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.16 }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default LoadingScreen
