# Деплой: бекенд на Render, APK через EAS

Команди — для PowerShell, кожна окремо.

## 1. Код на GitHub

Render бере код із GitHub, тому потрібен репозиторій (можна приватний).

1. На github.com → **New repository** → назва `MyBudget`, **Private**, без README / .gitignore.
2. У теці `C:\Users\sholo\FrontEnd\MyBudget`:

```
git remote add origin https://github.com/<ваш-логін>/MyBudget.git
```
```
git push -u origin main
```

`.env` у git не потрапляють (вони в `.gitignore`), секрети лишаються лише у вас.

## 2. MongoDB Atlas: доступ з Render

Безкоштовний Render не має сталої IP-адреси. В Atlas → **Network Access** → **Add IP Address** →
**Allow access from anywhere** (`0.0.0.0/0`). Захист — логін і пароль користувача бази в рядку підключення.

## 3. Бекенд на Render

1. render.com → **New** → **Blueprint** → підключити GitHub і вибрати репозиторій `MyBudget`.
   Render знайде `render.yaml` і запропонує сервіс `mybudget-api`.
2. Він попросить значення (усе є у `backend/.env`):
   - `MONGODB_URI` — той самий рядок, що в `backend/.env`;
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`;
   - решту (`GOOGLE_CLIENT_IDS`, `IPINFO_TOKEN`, `SMTP_*`, `SUPPORT_EMAIL`) можна лишити порожніми.
   `JWT_*` Render згенерує сам.
3. **Apply**. Перша збірка триває кілька хвилин. Перевірка: відкрити `https://mybudget-api-uqdt.onrender.com/health`
   — має бути `{"ok":true}`.
4. Якщо Render дав іншу адресу (назва зайнята), замінити її в `frontend/eas.json` (обидва `EXPO_PUBLIC_API_URL`).

Словники перекладів уже в Atlas (`node scripts/seed-i18n.js`), повторювати не треба — база та сама.
Секрети JWT на Render нові, тому після переходу на сервер у застосунку треба буде увійти ще раз.

Безкоштовний сервіс засинає після 15 хвилин без запитів; перший запит будить його до хвилини. Застосунок
стукає на `/health` при запуску, а записи без мережі все одно зберігаються й синхронізуються пізніше.

## 4. APK через EAS

Потрібен безкоштовний акаунт на expo.dev. У теці `frontend`:

```
npx.cmd eas-cli@latest login
```
```
npx.cmd eas-cli@latest init
```
`init` створить проєкт на expo.dev і допише `projectId` в `app.json` — цю зміну треба закомітити.

```
npx.cmd eas-cli@latest build --platform android --profile preview
```

- На питання про ключ підпису (Android keystore) — **Yes**, хай EAS створить і зберігає його.
- Збірка йде в хмарі Expo (зазвичай 10–20 хвилин, на безкоштовному плані буває черга).
- Наприкінці буде посилання і QR-код: відкрити на телефоні, завантажити APK, дозволити встановлення з цього
  джерела. Expo Go для цієї версії не потрібен, `npx expo start` теж.

Профіль `preview` — APK для себе; `production` — AAB для Play Market (пізніше).

## 5. Після першої збірки — вхід через Google

На expo.dev → проєкт → **Credentials** → Android → SHA-1 ключа. З ним створити OAuth-клієнти в Google Cloud
Console (див. TODO.md).
