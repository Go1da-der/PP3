# 🚀 IT Team Notification System

Современная система уведомлений для IT-команд с красивым интерфейсом, реальным временем и легкой запускаемостью.

## ▶️ Запуск проекта

### Локальный запуск

1. Установите зависимости для бэкенда и фронтенда:

```bash
cd backend
npm install
cd ../frontend
npm install
```

2. Запустите бэкенд:

```bash
cd backend
npm run dev
```

3. В другом терминале запустите фронтенд:

```bash
cd frontend
npm run dev
```

4. Откройте приложение в браузере:

- Фронтенд: `http://localhost:3000` (или `http://localhost:3001`, если 3000 занят)
- Бэкенд API: `http://localhost:5000`
- Swagger: `http://localhost:5000/api-docs`
- Health Check: `http://localhost:5000/health`

### Запуск через Docker

```bash
docker-compose up -d
```

После старта через Docker откройте `http://localhost:3000`.

## ✨ Возможности

### 🎨 **Красивый интерфейс**
- Современный дизайн с градиентами и анимациями
- Адаптивный интерфейс для всех устройств
- Плавные переходы и микро-взаимодействия
- Темная/светлая тема

### ⚡ **Реальное время**
- Мгновенная доставка уведомлений через WebSocket
- Онлайн-статус пользователей
- Индикаторы набора текста
- Живые обновления без перезагрузки

### 🔔 **Умные уведомления**
- Различные типы: информация, успех, предупреждение, ошибка
- Приоритеты: низкий, средний, высокий, критический
- Каналы доставки: веб, email, telegram, slack
- Статусы прочтения

### 🛡️ **Безопасность**
- JWT аутентификация
- Роли и права доступа
- Защита от CSRF
- Безопасные заголовки

## 🚀 Быстрый запуск

### Способ 1: Docker (Рекомендуется)

```bash
# Клонируйте репозиторий
git clone <repository-url>
cd notification-system

# Запустите все сервисы одной командой
docker-compose up -d

# Откройте в браузере
open http://localhost:3000
```

### Способ 2: Ручной запуск

```bash
# 1. Запустите базы данных
docker-compose up -d postgres redis

# 2. Установите зависимости
cd backend && npm install
cd ../frontend && npm install

# 3. Настройте окружение
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Запустите миграции
cd backend && npm run migrate

# 5. Запустите приложения
# Терминал 1
cd backend && npm run dev

# Терминал 2  
cd frontend && npm run dev
```

## 🔗 Доступные сервисы

| Сервис | URL | Описание |
|--------|-----|----------|
| 🌐 Фронтенд | http://localhost:3000 | Основной интерфейс |
| 🔧 Бэкенд API | http://localhost:5000 | REST API |
| 📚 Документация API | http://localhost:5000/api-docs | Swagger UI |
| 💾 PostgreSQL | localhost:5432 | База данных |
| ⚡ Redis | localhost:6379 | Кэш и сессии |
| ❤️ Health Check | http://localhost:5000/health | Статус системы |

## 👤 Демонстрационные данные

Для быстрого входа используйте:

- **Email**: `admin@example.com`
- **Пароль**: `password`

## 🏗️ Архитектура

```
notification-system/
├── frontend/                 # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/      # UI компоненты
│   │   ├── pages/          # Страницы
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # API сервисы
│   │   ├── types/          # TypeScript типы
│   │   └── utils/          # Утилиты
│   ├── Dockerfile
│   └── nginx.conf
├── backend/                  # Node.js + Express
│   ├── src/
│   │   ├── controllers/     # Контроллеры
│   │   ├── models/          # Модели данных
│   │   ├── routes/          # Маршруты API
│   │   ├── middleware/      # Middleware
│   │   ├── services/        # Бизнес-логика
│   │   ├── config/          # Конфигурация
│   │   └── utils/          # Утилиты
│   └── Dockerfile
├── database/                 # Миграции БД
└── docker-compose.yml         # Docker конфигурация
```

## 🛠️ Технологический стек

### Frontend
- **React 18** + **TypeScript** - Основной фреймворк
- **Vite** - Быстрый сборщик
- **TailwindCSS** - Современные стили
- **Framer Motion** - Красивые анимации
- **Heroicons** - Иконки
- **Socket.io Client** - Real-time коммуникация

### Backend
- **Node.js** + **Express** - REST API
- **Socket.io** - WebSocket сервер
- **PostgreSQL** - Основная БД
- **Redis** - Кэш и сессии
- **JWT** - Аутентификация
- **Knex.js** - Query Builder

### DevOps
- **Docker** + **Docker Compose** - Контейнеризация
- **Nginx** - Reverse proxy
- **Health Checks** - Мониторинг состояния

## 📱 Основные функции

### 🔐 Аутентификация
- Регистрация и вход пользователей
- Обновление токенов доступа
- Защищенные маршруты

### 👥 Управление пользователями
- Профили пользователей
- Роли и права доступа
- Онлайн-статус

### 📨 Система уведомлений
- Создание и отправка уведомлений
- Приоритеты и типы
- История уведомлений
- Отметка о прочтении

### 🔄 Real-time функции
- Мгновенная доставка уведомлений
- Онлайн-пользователи
- Индикаторы набора текста
- Живые обновления

## 🔧 Конфигурация

### Backend (.env)
```env
PORT=5000
NODE_ENV=development

# База данных
DB_HOST=localhost
DB_PORT=5432
DB_NAME=notification_system
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## 🧪 Тестирование

```bash
# Backend тесты
cd backend && npm test

# Frontend тесты
cd frontend && npm test

# E2E тесты
npm run test:e2e
```

## 📊 Мониторинг

### Health Checks
- Бэкенд: `GET /health`
- База данных: автоматические проверки
- Redis: ping проверки

### Логирование
- Структурированные логи
- Уровни логирования
- Метрики производительности

## 🚀 Развертывание

### Production
```bash
# Production сборка
docker-compose -f docker-compose.prod.yml up -d

# Или с профилем
docker-compose --profile production up -d
```

### Переменные окружения для production
- Измените `JWT_SECRET` на безопасное значение
- Настройте `SMTP_*` для email уведомлений
- Добавьте `TELEGRAM_BOT_TOKEN` для Telegram
- Настройте `SLACK_*` для Slack интеграции

## 🤝 Contributing

1. Fork проекта
2. Создавайте feature branch
3. Вносите изменения
4. Создавайте Pull Request

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE)

## 🆘 Поддержка

Если возникли проблемы:

1. Проверьте [Issues](../../issues)
2. Посмотрите [Wiki](../../wiki)
3. Создавайте новый [Issue](../../issues/new)

---

**Создано с ❤️ для IT-команд**
#   P P 3  
 