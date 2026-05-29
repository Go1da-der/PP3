import { FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, BellRing, KeyRound, ShieldCheck, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const demoAccounts = [
  {
    role: 'Администратор',
    email: 'admin@example.com',
    password: 'password',
    description: 'Глобальная рассылка, весь каталог пользователей и управление ролями.',
  },
  {
    role: 'Менеджер',
    email: 'manager@example.com',
    password: 'password',
    description: 'Командные уведомления и прямые сообщения только внутри общего контура.',
  },
  {
    role: 'Разработчик',
    email: 'dev@example.com',
    password: 'password',
    description: 'Рассылка только в свои команды.',
  },
  {
    role: 'Тестировщик',
    email: 'qa@example.com',
    password: 'password',
    description: 'Только входящие уведомления с автоматическим подтверждением.',
  },
]

const LoginPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('admin@example.com')
  const [password, setPassword] = useState('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const result = await login({ email, password })

    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error || 'Не удалось выполнить вход.')
    }

    setLoading(false)
  }

  return (
    <div className="auth-shell">
      <div className="auth-background" />
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="auth-card"
      >
        <div className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/[0.35] bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100">
            <BellRing className="h-3.5 w-3.5" />
            IT Team Notification System
          </span>

          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tight text-white">
              Единый вход в систему уведомлений команды
            </h1>
            <p className="max-w-xl text-sm leading-7 text-slate-300">
              Выберите демо-роль или войдите под своей учетной записью, чтобы проверить push-уведомления, различия прав и автоматическое прочтение сообщений.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
          <form onSubmit={handleSubmit} className="panel space-y-5">
            <div className="space-y-2">
              <label className="label-text" htmlFor="login-email">
                Рабочий email
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-email"
                  type="email"
                  className="field pl-11"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="label-text" htmlFor="login-password">
                Пароль
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type="password"
                  className="field pl-11"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.12] px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <span>{loading ? 'Выполняем вход...' : 'Открыть дашборд'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="panel-muted space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">
                Демо-роли
              </p>
              <h2 className="mt-3 text-2xl font-black text-white">
                Быстрая проверка различий между правами
              </h2>
            </div>

            <div className="space-y-3">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="w-full rounded-[1.6rem] border border-white/10 bg-slate-950/[0.35] p-5 text-left transition hover:border-amber-300/30 hover:bg-white/5"
                  onClick={() => {
                    setEmail(account.email)
                    setPassword(account.password)
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{account.role}</p>
                      <p className="mt-1 text-sm text-slate-300">{account.email}</p>
                    </div>
                    <span className="pill text-slate-200">password</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{account.description}</p>
                </button>
              ))}
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 text-amber-200" />
                <p className="text-sm leading-6 text-slate-300">
                  После входа откроется общий дашборд с реальными ограничениями по ролям, автоматическим прочтением входящих сообщений и Swagger-документацией API.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Нужен отдельный аккаунт?{' '}
              <Link to="/register" className="font-semibold text-amber-200 transition hover:text-amber-100">
                Зарегистрироваться
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage
