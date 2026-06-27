# REDFILM Telegram Bot + Mini App

## 1. Создать бота

1. Откройте BotFather в Telegram.
2. Выполните `/newbot`.
3. Сохраните токен в Railway Variables как `TELEGRAM_BOT_TOKEN`.
4. Username бота сохраните как `TELEGRAM_BOT_USERNAME`.

## 2. Настроить Mini App

1. В BotFather откройте настройки бота.
2. Укажите домен `redfilm.win`, если BotFather запросит домен для Web App.
3. Mini App URL: `https://redfilm.win/`.

Mini App открывает обычную мобильную версию REDFILM. Отдельная `/tg`-версия не используется, параметр `?tg=1` не нужен.

## 3. Railway Variables

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=redfilm_bot
TELEGRAM_WEBHOOK_SECRET=случайная_длинная_строка
NEXT_PUBLIC_TELEGRAM_MINI_APP_URL=https://redfilm.win/
TELEGRAM_ADMIN_IDS=
```

`TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET` не должны попадать в client-side код.

## 4. Деплой и webhook

После деплоя откройте:

```text
https://redfilm.win/admin/telegram
```

Нажмите `setWebhook`, либо установите вручную:

```text
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://redfilm.win/api/telegram/webhook&secret_token=<SECRET>
```

Проверка webhook:

```text
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

## 5. Проверка

1. Напишите боту `/start`.
2. Нажмите `Открыть REDFILM`.
3. Должен открыться обычный мобильный REDFILM на `https://redfilm.win/`.
4. Сверху интерфейс Telegram не должен перекрывать логотип и поиск.
5. Приложение должно раскрываться на максимум через Telegram WebApp `expand()` / `requestFullscreen()`, если клиент Telegram поддерживает эти методы.
6. Свайп вниз не должен сворачивать приложение, если клиент Telegram поддерживает `disableVerticalSwipes()`.
7. Проверьте поиск: `гарри поттер 4`, `шерлок 2010`, `извне сериал`.
8. Откройте фильм и проверьте Vibix/Rendex player.
9. Проверьте тестовую страницу внутри Telegram WebView:

```text
https://redfilm.win/tg-test-player
```

## 6. Что делает MVP

- Бот принимает `/start`, текстовый поиск и callback-кнопки.
- Mini App открывает обычный сайт REDFILM, а не отдельную `/tg`-версию.
- TelegramWebAppBridge автоматически активируется только если есть `window.Telegram?.WebApp`.
- Bridge вызывает `ready()`, `expand()`, `requestFullscreen()`, `disableVerticalSwipes()` через feature detection.
- Bridge добавляет CSS safe-area отступы только внутри Telegram.
- Видео не отправляется файлами в Telegram.
- Просмотр идёт через текущий REDFILM/Vibix/Rendex player.
- Избранное и история работают только после server-side проверки Telegram `initData`.
