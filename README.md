# Инструкция по редактированию информации о залах


## Структура файлов

Каждый зал имеет свой HTML файл:
- `armaloft.html` - Зал Армалофт
- `merkuri.html` - Зал Меркури
- `samolet.html` - Зал Самолет
- `rufer.html` - Зал Руфер
- `pulka.html` - Зал Пулька

Фотографии хранятся в папке `photos/` с подпапками для каждого зала:
- `photos/armaloft/`
- `photos/merkuri/`
- `photos/samolet/`
- `photos/rufer/`
- `photos/pulka/`

Видео хранятся в папке `video/`:
- `video/pulka.mp4`
- `video/rufer.mp4`

---

## 1. Как изменить фотографии зала

### Шаг 1: Подготовьте фотографии
1. Поместите новые фотографии в соответствующую папку `photos/{название_зала}/`
2. Рекомендуемый формат: JPG
3. Рекомендуемое разрешение: не менее 1920x1080px
4. Назовите файлы последовательно: `{название_зала}1.jpg`, `{название_зала}2.jpg`, и т.д.

**Пример для зала Армалофт:**
```
photos/armaloft/armaloft1.jpg
photos/armaloft/armaloft2.jpg
photos/armaloft/armaloft3.jpg
```

### Шаг 2: Отредактируйте HTML файл
Откройте HTML файл нужного зала (например, `armaloft.html`) и найдите секцию галереи:

```html
<div class="room-gallery-track" id="galleryTrack">
    <div class="room-gallery-slide">
        <img src="photos/armaloft/armaloft1.jpg" alt="Arma Loft - фото 1">
    </div>
    <div class="room-gallery-slide">
        <img src="photos/armaloft/armaloft2.jpg" alt="Arma Loft - фото 2">
    </div>
    <!-- Добавьте или удалите слайды здесь -->
</div>
```

**Чтобы добавить новое фото:**
- Добавьте новый блок `<div class="room-gallery-slide">` с изображением внутри
- Укажите правильный путь к файлу в атрибуте `src`
- Обновите текст в атрибуте `alt` для доступности

**Пример добавления нового фото:**
```html
<div class="room-gallery-slide">
    <img src="photos/armaloft/armaloft9.jpg" alt="Arma Loft - фото 9">
</div>
```

**Чтобы удалить фото:**
- Удалите соответствующий блок `<div class="room-gallery-slide">`

**Чтобы заменить фото:**
- Замените файл в папке `photos/` с тем же именем, или
- Измените путь в атрибуте `src` на новый файл

---

## 2. Как изменить характеристики зала

Характеристики находятся в секции `.room-characteristics` в HTML файле.

### Найти секцию характеристик:
```html
<div class="room-characteristics">
    <h3 class="room-characteristics-title">Характеристики</h3>
    <div class="room-characteristic-item">
        <div class="room-characteristic-icon">
            <!-- SVG иконка -->
        </div>
        <span>ПЛОЩАДЬ 70 М²</span>
    </div>
    <div class="room-characteristic-item">
        <div class="room-characteristic-icon">
            <!-- SVG иконка -->
        </div>
        <span>ДО 50 ЧЕЛОВЕК</span>
    </div>
</div>
```

### Изменить площадь:
Найдите строку с площадью и измените текст внутри тега `<span>`:
```html
<span>ПЛОЩАДЬ 70 М²</span>
```
Замените на нужное значение, например:
```html
<span>ПЛОЩАДЬ 120 М²</span>
```

### Изменить количество человек:
Найдите строку с количеством человек и измените текст:
```html
<span>ДО 50 ЧЕЛОВЕК</span>
```
Замените на нужное значение, например:
```html
<span>ДО 80 ЧЕЛОВЕК</span>
```

### Добавить новую характеристику:
Скопируйте блок `.room-characteristic-item` и вставьте перед закрывающим тегом `</div>` секции `.room-characteristics`:
```html
<div class="room-characteristic-item">
    <div class="room-characteristic-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="..." fill="#CC7A6F"/>
        </svg>
    </div>
    <span>НОВАЯ ХАРАКТЕРИСТИКА</span>
</div>
```

---

## 3. Как изменить список "Что находится в зале?"

Список содержимого зала находится в секции `.room-features-section`.

### Найти секцию:
```html
<div class="room-features-section">
    <h3 class="room-features-title">Что находится в зале?</h3>
    <div class="room-features-grid">
        <div class="room-features-column">
            <!-- Элементы первой колонки -->
        </div>
        <div class="room-features-column">
            <!-- Элементы второй колонки -->
        </div>
    </div>
</div>
```

### Структура элемента:
Каждый элемент списка имеет такую структуру:
```html
<div class="room-feature-item">
    <div class="room-feature-check">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#CC7A6F"/>
        </svg>
    </div>
    <span>Текст элемента</span>
</div>
```

### Изменить существующий элемент:
Найдите нужный элемент и измените текст внутри тега `<span>`:
```html
<span>Танцпол с профессиональным светом, звуком и дымом</span>
```

### Добавить новый элемент:
1. Решите, в какую колонку добавить (первую или вторую)
2. Скопируйте блок `.room-feature-item` и вставьте в нужную колонку
3. Измените текст внутри тега `<span>`

**Пример добавления в первую колонку:**
```html
<div class="room-features-column">
    <!-- Существующие элементы -->
    <div class="room-feature-item">
        <div class="room-feature-check">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#CC7A6F"/>
            </svg>
        </div>
        <span>НОВЫЙ ЭЛЕМЕНТ</span>
    </div>
</div>
```

### Удалить элемент:
Удалите весь блок `<div class="room-feature-item">...</div>`

### Добавить новую колонку (если нужно больше двух):
Если нужно больше двух колонок, добавьте еще один блок:
```html
<div class="room-features-column">
    <div class="room-feature-item">
        <!-- элементы -->
    </div>
</div>
```

---

## 4. Как добавить или изменить видео

Видео отображается в секции `.room-video-section`. Не все залы имеют видео (сейчас видео есть только у залов Пулька и Руфер).

### Найти секцию видео:
```html
<div class="room-video-section">
    <video class="room-video" controls preload="metadata" poster="">
        <source src="video/pulka.mp4" type="video/mp4">
        Ваш браузер не поддерживает воспроизведение видео.
    </video>
</div>
```

### Добавить видео к залу, у которого его нет:
1. Поместите видеофайл в папку `video/` с именем `{название_зала}.mp4`
   - Например: `video/armaloft.mp4`
2. Откройте HTML файл зала
3. Найдите секцию `.room-description` (после формы бронирования)
4. После закрывающего тега `</div>` секции `.room-description`, добавьте:

```html
<!-- Видео -->
<div class="room-video-section">
    <video class="room-video" controls preload="metadata" poster="">
        <source src="video/{название_зала}.mp4" type="video/mp4">
        Ваш браузер не поддерживает воспроизведение видео.
    </video>
</div>
```

**Пример для зала Армалофт:**
```html
<!-- Видео -->
<div class="room-video-section">
    <video class="room-video" controls preload="metadata" poster="">
        <source src="video/armaloft.mp4" type="video/mp4">
        Ваш браузер не поддерживает воспроизведение видео.
    </video>
</div>
```

### Изменить существующее видео:
1. Замените файл в папке `video/` с тем же именем, или
2. Измените путь в атрибуте `src` тега `<source>`:
```html
<source src="video/новое_видео.mp4" type="video/mp4">
```

### Добавить постер (превью) для видео:
Если хотите добавить изображение-превью для видео, поместите изображение в папку и укажите путь в атрибуте `poster`:
```html
<video class="room-video" controls preload="metadata" poster="images/video-poster.jpg">
```

### Удалить видео:
Удалите всю секцию `.room-video-section` из HTML файла.

---

## 5. Дополнительные секции

### Примечание (room-note)
В некоторых залах есть секция с примечанием. Она находится в `.room-description`:

```html
<div class="room-note">
    <p class="room-note-text">
        <strong>Примечание:</strong> Текст примечания...
    </p>
</div>
```

Чтобы изменить примечание, просто отредактируйте текст внутри тега `<p>`.

---

## 6. Важные замечания

### Имена файлов
- Используйте только латинские буквы и цифры в именах файлов
- Избегайте пробелов (используйте дефисы или подчеркивания)
- Сохраняйте единообразие в именовании

### Пути к файлам
- Все пути к файлам относительные (от корня сайта)
- Фотографии: `photos/{название_зала}/{файл}.jpg`
- Видео: `video/{название_зала}.mp4`

### Форматы файлов
- **Фотографии**: JPG, PNG (рекомендуется JPG для меньшего размера)
- **Видео**: MP4 (рекомендуется H.264 кодировка для лучшей совместимости)

### Размеры файлов
- Оптимизируйте изображения перед загрузкой (рекомендуется использовать инструменты сжатия)
- Видео должно быть оптимизировано для веб-воспроизведения

### Тестирование
После внесения изменений:
1. Проверьте, что все изображения и видео загружаются корректно
2. Убедитесь, что галерея работает (переключение между фото)
3. Проверьте отображение на разных устройствах (десктоп, планшет, мобильный)

---

## 7. Примеры для каждого зала

### Армалофт (armaloft.html)
- **Фотографии**: `photos/armaloft/armaloft1.jpg` - `armaloft8.jpg`
- **Характеристики**: Двухуровневый зал, нижний уровень 120м², верхний 50м², до 120 человек
- **Видео**: Нет

### Меркури (merkuri.html)
- **Фотографии**: `photos/merkuri/merkuri1.jpg` - `merkuri6.jpg`
- **Характеристики**: Площадь 70 м², до 50 человек
- **Видео**: Нет

### Самолет (samolet.html)
- **Фотографии**: `photos/samolet/samolet1.jpg` - `samolet3.jpg`
- **Характеристики**: Площадь 42 м², до 20 человек
- **Видео**: Нет

### Руфер (rufer.html)
- **Фотографии**: `photos/rufer/rufer1.jpg` - `rufer6.jpg`
- **Характеристики**: Площадь 40 м², до 25 человек
- **Видео**: `video/rufer.mp4`

### Пулька (pulka.html)
- **Фотографии**: `photos/pulka/pulka1.jpg` - `pulka3.jpg`
- **Характеристики**: Площадь 18 м², до 15 человек
- **Видео**: `video/pulka.mp4`

---

## 8. Быстрая справка

| Что изменить | Где искать в HTML | Что редактировать |
|--------------|-------------------|-------------------|
| Фотографии | `.room-gallery-track` | Теги `<img src="...">` |
| Площадь | `.room-characteristics` | Текст в `<span>` с площадью |
| Количество человек | `.room-characteristics` | Текст в `<span>` с количеством |
| Содержимое зала | `.room-features-section` | Элементы `.room-feature-item` |
| Видео | `.room-video-section` | Атрибут `src` в теге `<source>` |
| Примечание | `.room-note` | Текст в `.room-note-text` |


