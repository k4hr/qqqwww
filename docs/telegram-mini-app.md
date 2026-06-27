# REDFILM Telegram Bot + Mini App

## 1. Создать бота

1. Откройте BotFather в Telegram.
2. Выполните `/newbot`.
3. Сохраните токен в Railway Variables как `TELEGRAM_BOT_TOKEN`.
4. Username бота сохраните как `TELEGRAM_BOT_USERNAME`.

## 2. Настроить Mini App

1. В BotFather откройте настройки бота.
2. Укажите домен `redfilm.win`, если BotFather запросит домен для Web App.
3. Mini App URL: `https://redfilm.win/tg`.

## 3. Railway Variables

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=redfilm_bot
TELEGRAM_WEBHOOK_SECRET=случайная_длинная_строка
NEXT_PUBLIC_TELEGRAM_MINI_APP_URL=https://redfilm.win/tg
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
3. Проверьте поиск в Mini App: `гарри поттер 4`, `шерлок 2010`, `извне сериал`.
4. Откройте карточку фильма и проверьте плеер.
5. Проверьте тестовую страницу внутри Telegram WebView:

```text
https://redfilm.win/tg-test-player
```

## 6. Что делает MVP

- Бот принимает `/start`, текстовый поиск и callback-кнопки.
- Mini App открывает мобильную версию REDFILM на `/tg`.
- Видео не отправляется файлами в Telegram.
- Просмотр идёт через текущий REDFILM/Vibix/Rendex player.
- Избранное и история работают только после server-side проверки Telegram `initData`.
