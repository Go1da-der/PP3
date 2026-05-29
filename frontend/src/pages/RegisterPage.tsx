import { FormEvent, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, BadgePlus, Mail, ShieldCheck, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const RegisterPage = () => {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Пароли не совпадают.')
      return
    }

    setLoading(true)

    const result = await register({
      email: form.email,
      password: form.password,
      firstName: form.firstName,
      lastName: form.lastName,
      phone: form.phone,
    })

    if (result.success) {
      navigate('/dashboard')
    } else {
      setError(result.error || 'Не удалось создать аккаунт.')
    }

    setLoading(false)
  }

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
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
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/[0.35] bg-sky-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-100">
            <BadgePlus className="h-3.5 w-3.5" />
            Регистрация участника
          </span>

          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tight text-white">
              Добавьте нового участника в рабочий контур
            </h1>
            <p className="max-w-xl text-sm leading-7 text-slate-300">
              Новый аккаунт создается с ролью разработчика по умолчанию. Права выше выдаются только администратором внутри системы.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
          <form onSubmit={handleSubmit} className="panel space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="label-text" htmlFor="register-first-name">
                  Имя
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="register-first-name"
                    type="text"
                    className="field pl-11"
                    value={form.firstName}
                    onChange={(event) => updateField('firstName', event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="label-text" htmlFor="register-last-name">
                  Фамилия
                </label>
                <input
                  id="register-last-name"
                  type="text"
                  className="field"
                  value={form.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="label-text" htmlFor="register-email">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="register-email"
                  type="email"
                  className="field pl-11"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="label-text" htmlFor="register-phone">
                Телефон
              </label>
              <input
                id="register-phone"
                type="tel"
                className="field"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                placeholder="+7 ..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="label-text" htmlFor="register-password">
                  Пароль
                </label>
                <input
                  id="register-password"
                  type="password"
                  className="field"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="label-text" htmlFor="register-confirm-password">
                  Подтверждение
                </label>
                <input
                  id="register-confirm-password"
                  type="password"
                  className="field"
                  value={form.confirmPassword}
                  onChange={(event) => updateField('confirmPassword', event.target.value)}
                  minLength={6}
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
              <span>{loading ? 'Создаем аккаунт...' : 'Создать аккаунт'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="panel-muted space-y-5">
            <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/30 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 text-amber-200" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">
                    Что произойдет после регистрации
                  </p>
                  <p className="text-sm leading-6 text-slate-300">
                    Пользователь получит роль разработчика, сможет войти в систему и участвовать в командных уведомлениях после назначения в нужные команды.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
                Ограничение по ролям
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Самостоятельно выбрать роль администратора или менеджера при регистрации больше нельзя. Это убирает дыру в доступах и делает поведение ролей предсказуемым.
              </p>
            </div>

            <p className="text-sm text-slate-300">
              Уже есть доступ?{' '}
              <Link to="/login" className="font-semibold text-amber-200 transition hover:text-amber-100">
                Вернуться ко входу
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default RegisterPage
