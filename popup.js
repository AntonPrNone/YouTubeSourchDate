const API_KEY = "AIzaSyBd-uEDTDxkykw8nf0Ff5uhSdwkFvQMD7M";

// Получаем элементы
const enableEndDate = document.getElementById("enableEndDate");
const endDateWrapper = document.getElementById("endDateWrapper");

// Обработчик для изменения состояния чекбокса
enableEndDate.addEventListener("change", () => {
  if (enableEndDate.checked) {
    endDateWrapper.style.display = "block"; // Показываем поле
    endDate.value = new Date().toISOString().split("T")[0]; // Устанавливаем текущую дату
  } else {
    endDateWrapper.style.display = "none"; // Скрываем поле
    endDate.value = ""; // Очищаем значение даты
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // Автоматически ставим фокус на поле ввода ссылки на видео
  document.getElementById("channelUrl").focus();
});


document.getElementById("search").addEventListener("click", async () => {
  const channelUrl = document.getElementById("channelUrl").value;
  const startDate = document.getElementById("startDate").value;
  const endDate = enableEndDate.checked ? document.getElementById("endDate").value : startDate;

  const results = document.getElementById("results");
  const log = document.getElementById("log");
  results.innerHTML = "";
  log.innerHTML = ""; // Очистить лог

  if (!channelUrl || !startDate) {
    results.innerHTML = "<li>Пожалуйста, заполните все поля.</li>";
    return;
  }

  try {
    const channelId = await getChannelId(channelUrl);
    logMessage(`Найден канал с ID: ${channelId}`);

    const videos = await searchVideos(channelId, startDate, endDate);

    if (videos.length === 0) {
      results.innerHTML = "<li>Видео не найдены за указанные даты.</li>";
      return;
    }

    videos.forEach((video) => {
      const li = document.createElement("li");
      const thumbnailUrl = video.thumbnail || 'https://via.placeholder.com/120x90';
      li.innerHTML = `
        <a href="${video.url}" target="_blank" class="video-container">
          <img src="${thumbnailUrl}" alt="${video.title}" class="video-thumbnail">
          <div class="video-text">
            <div class="video-title">${video.title}</div>
            <div class="video-date">${formatDate(video.publishedAt)}</div>
          </div>
        </a>
      `;
      results.appendChild(li);
    });
    
    
  } catch (error) {
    results.innerHTML = `<li>Ошибка: ${error.message}</li>`;
    logMessage(`Ошибка: ${error.message}`);
  }
});


async function getChannelId(channelUrl) {
  try {
    const url = new URL(channelUrl);
    const parts = url.pathname.split("/");

    logMessage(`URL канала разделён на части: ${parts.join(", ")}`);

    // Если это URL канала вида https://www.youtube.com/channel/UCID
    if (parts.length > 2 && parts[1] === "channel") {
      return parts[2];
    } 
    // Если это URL канала вида https://www.youtube.com/@username
    else if (parts.length > 1 && parts[1].startsWith('@')) {
      // Убираем "@" из хендла
      const handle = parts[1].slice(1);
      logMessage(`Обрабатываем канал с хендлом: ${handle}`);
      return await resolveChannelHandle(handle);
    } 
    // Если это URL канала вида https://www.youtube.com/user/username
    else if (parts.length > 1 && parts[1] === "user") {
      const userName = parts[2];
      logMessage(`Обрабатываем канал с именем пользователя: ${userName}`);
      return await resolveChannelName(userName);
    }

    throw new Error("Неверный формат URL канала.");
  } catch (error) {
    throw new Error(`Не удалось разобрать URL канала: ${error.message}`);
  }
}

async function resolveChannelHandle(handle) {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${handle}&type=channel&key=${API_KEY}`
      );
      const data = await response.json();
  
      console.log("Ответ от API для поиска канала:", data);
  
      if (!data.items || data.items.length === 0) {
        throw new Error(`Канал с хендлом @${handle} не найден.`);
      }
  
      const channelId = data.items[0].id.channelId;
      if (!channelId) {
        throw new Error("Не удалось получить ID канала.");
      }
  
      logMessage(`Найден канал с ID: ${channelId}`);
      return channelId;
    } catch (error) {
      logMessage(`Ошибка при поиске канала по хендлу @${handle}: ${error.message}`);
      throw new Error(`Ошибка при поиске канала по хендлу @${handle}: ${error.message}`);
    }
  }
  
  
  // Функция для получения ID канала через URL
  async function resolveChannelByUrl(url) {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split("/");
  
      // Проверяем, что URL соответствует нужному формату
      if (parts.length > 2 && parts[1] === "@") {
        const handle = parts[2];
        // Попробуем найти канал по ID
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${handle}&key=${API_KEY}`
        );
        const data = await response.json();
        if (!data.items || data.items.length === 0) {
          throw new Error("Канал не найден.");
        }
        return data.items[0].id;
      }
  
      throw new Error("Неверный формат URL канала.");
    } catch (error) {
      throw new Error(`Не удалось получить канал по URL: ${error.message}`);
    }
  }
  
async function resolveChannelName(channelName) {
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${channelName}&key=${API_KEY}`
  );
  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error("Канал не найден.");
  }
  return data.items[0].id.channelId;
}

async function searchVideos(channelId, startDate, endDate) {
  const videos = [];
  let nextPageToken = null;

  do {
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&publishedAfter=${startDate}T00:00:00Z&publishedBefore=${endDate}T23:59:59Z&maxResults=50&pageToken=${nextPageToken || ""}&key=${API_KEY}`
      );
      const data = await response.json();

      // Логируем ответ API для поиска
      console.log("Ответ от API для поиска видео:", data);

      if (!data.items || data.items.length === 0) {
        logMessage("Видео не найдены для данного канала и дат.");
      }

      data.items.forEach((item) => {
        if (item.id.kind === "youtube#video") {
          // Получаем URL превью (если доступно)
          const thumbnailUrl = item.snippet.thumbnails?.high?.url || 'https://via.placeholder.com/120x90';

          videos.push({
            title: item.snippet.title,
            publishedAt: item.snippet.publishedAt,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            thumbnail: thumbnailUrl
          });
        }
      });

      nextPageToken = data.nextPageToken;
    } catch (error) {
      logMessage(`Ошибка при поиске видео: ${error.message}`);
    }
  } while (nextPageToken);

  // Сортируем видео по дате публикации от старого к новому
  videos.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

  return videos;
}

function logMessage(message) {
  const log = document.getElementById("log");
  const logEntry = document.createElement("div");
  logEntry.textContent = message;
  log.appendChild(logEntry);

  // Прокрутка лога до самого низа
  log.scrollTop = log.scrollHeight;
}

// Функция для форматирования даты
function formatDate(dateString) {
  const date = new Date(dateString);

  // Форматируем дату по местному времени
  const day = date.getDate();
  const month = date.toLocaleString('ru-RU', { month: 'long' });
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('ru-RU', { hour12: false });

  return `${day} ${month} ${year}г., ${time}`;
}
