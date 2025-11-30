# Backend API и Админка для управления ценами

## Описание

Backend сервер для управления ценами и условиями аренды залов. Включает:
- REST API для управления всеми сущностями
- Админ-панель для управления ценами без правки кода
- API endpoint для фронтового калькулятора

## Установка

1. Установите зависимости (уже установлены в основном проекте):
```bash
npm install
```

## Инициализация базы данных

1. Запустите миграцию данных из захардкоженных констант:
```bash
node backend/migrate.js
```

2. Создайте пользователя по умолчанию для админки:
```bash
node backend/create-user.js
```

По умолчанию создается пользователь:
- Username: `admin`
- Password: `admin123`
- Role: `admin`

**Внимание:** После первого входа обязательно смените пароль!

## Запуск сервера

```bash
node backend/server.js
```

Сервер запустится на порту 3000 (или порту, указанном в переменной окружения PORT).

### Доступные адреса:

- **Админ-панель:** http://localhost:3000/admin
- **API для калькулятора:** http://localhost:3000/api/pricing/halls-pricing
- **Health check:** http://localhost:3000/api/health

## Структура проекта

```
backend/
├── database.js          # Инициализация БД и создание таблиц
├── migrate.js           # Скрипт миграции данных
├── create-user.js       # Скрипт создания пользователя
├── server.js            # Express сервер
├── routes/              # API маршруты
│   ├── halls.js
│   ├── priceSets.js
│   ├── hallPrices.js
│   ├── extras.js
│   ├── extrasPrices.js
│   ├── seasonRules.js
│   ├── pricingApi.js    # Endpoint для фронта
│   └── auth.js
└── admin/               # Админ-панель
    ├── index.html
    └── admin.js
```

## API Endpoints

### Залы (Halls)
- `GET /api/halls` - Получить все залы
- `GET /api/halls/:id` - Получить зал по ID
- `POST /api/halls` - Создать зал
- `PUT /api/halls/:id` - Обновить зал
- `DELETE /api/halls/:id` - Удалить зал

### Прайс-сеты (Price Sets)
- `GET /api/price-sets` - Получить все прайс-сеты
- `GET /api/price-sets/:id` - Получить прайс-сет по ID
- `POST /api/price-sets` - Создать прайс-сет
- `PUT /api/price-sets/:id` - Обновить прайс-сет
- `DELETE /api/price-sets/:id` - Удалить прайс-сет

### Цены залов (Hall Prices)
- `GET /api/hall-prices?hall_id=X&price_set_id=Y` - Получить цены (с фильтрами)
- `GET /api/hall-prices/:id` - Получить цену по ID
- `POST /api/hall-prices` - Создать цену
- `PUT /api/hall-prices/:id` - Обновить цену
- `DELETE /api/hall-prices/:id` - Удалить цену

### Дополнительные услуги (Extras)
- `GET /api/extras` - Получить все услуги
- `GET /api/extras/:id` - Получить услугу по ID
- `POST /api/extras` - Создать услугу
- `PUT /api/extras/:id` - Обновить услугу
- `DELETE /api/extras/:id` - Удалить услугу

### Цены дополнительных услуг (Extras Prices)
- `GET /api/extras-prices?extra_id=X&price_set_id=Y` - Получить цены (с фильтрами)
- `GET /api/extras-prices/:id` - Получить цену по ID
- `POST /api/extras-prices` - Создать цену
- `PUT /api/extras-prices/:id` - Обновить цену
- `DELETE /api/extras-prices/:id` - Удалить цену

### Сезонные правила (Season Rules)
- `GET /api/season-rules` - Получить все правила
- `GET /api/season-rules/:id` - Получить правило по ID
- `POST /api/season-rules` - Создать правило
- `PUT /api/season-rules/:id` - Обновить правило
- `DELETE /api/season-rules/:id` - Удалить правило

### API для фронта (Pricing API)
- `GET /api/pricing/halls-pricing` - Получить все данные для калькулятора в формате, совместимом с существующим кодом

## Формат данных API для калькулятора

Endpoint `/api/pricing/halls-pricing` возвращает данные в следующем формате:

```json
{
  "halls": [
    {
      "code": "arma",
      "name": "Армалофт",
      "capacity": 120,
      "prices": {
        "standard": {
          "weekday": 3500,
          "friSat": 4500,
          "sun": 3500,
          "cleaningUpTo30": 2000,
          "cleaningOver30": 3000,
          "afterHoursFee": 500,
          "minHours": 2,
          "foodAlcoholFromHours": 2
        },
        "december": {
          ...
        }
      }
    }
  ],
  "extras": {
    "serving": {
      "name": "Сервировка / посуда",
      "pricingType": "per_unit",
      "priceSets": {
        "standard": {
          "basePrice": 1000,
          "additionalUnitPrice": 0,
          "unitDescription": "за каждые 10 человек"
        }
      }
    }
  },
  "seasonRules": [
    {
      "priceSetCode": "standard",
      "startDate": "2025-01-01",
      "endDate": "2025-12-31",
      "daysOfWeek": [0,1,2,3,4,5,6],
      "priority": 1
    }
  ]
}
```

## База данных

Используется SQLite (файл `backend/database.sqlite`). При первом запуске автоматически создаются все необходимые таблицы.

### Таблицы:
- `halls` - залы
- `price_sets` - наборы прайсов (стандарт, декабрь и т.п.)
- `hall_prices` - цены залов
- `extras` - дополнительные услуги
- `extras_prices` - цены дополнительных услуг
- `season_rules` - правила сезонности
- `price_logs` - логи изменений (для будущего использования)
- `users` - пользователи админки

## Использование админки

1. Запустите сервер
2. Откройте http://localhost:3000/admin
3. Войдите используя учетные данные (по умолчанию: admin/admin123)

В админке доступны следующие разделы:
- **Залы** - управление залами
- **Прайс-сеты** - управление наборами прайсов
- **Цены залов** - редактирование цен для каждого зала и прайс-сета
- **Доп. услуги** - управление дополнительными услугами
- **Цены доп. услуг** - редактирование цен на услуги
- **Сезонные правила** - управление правилами выбора прайса по дате

## Примечания

- Все изменения применяются сразу без перезапуска сервера
- База данных находится в файле `backend/database.sqlite`
- Рекомендуется делать резервные копии базы данных
- Для production рекомендуется использовать PostgreSQL или MySQL вместо SQLite

## Интеграция с фронтом

После запуска backend, фронтовый калькулятор будет загружать данные через API endpoint `/api/pricing/halls-pricing`. См. файл `js/pricing-calculator-api.js` для деталей интеграции.

