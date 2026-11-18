# Портфоліо Романа Мирончука

Реалізація аудиту від 17.11.2026. Гілка `codex/portfolio-audit-fixes`, база `30965afbce47eef47fa09225867f2cbdc09e7a71`. Підготовлено до публікації 18.11.2026 за запитом власника.

```powershell
npm ci
npm run build
npm start
```

Відкрити <http://127.0.0.1:4174>. `npm start` запускає лише локальний HTTP-сервер. Для готової сторінки не потрібні залежності Node у production.

`npm run build` також створює `dist/` з HTML, assets, robots та sitemap. Vercel публікує лише цю папку відповідно до `vercel.json`: вихідні дані, документація, тести й матеріали аудиту лишаються в Git.

## Де редагувати

- `scripts/build.cjs` — структура, відредаговані тексти, картки й шаблон. Одна генерація оновлює **обидва** HTML-входи.
- `content/portfolio.json` — вихідні факти кейсів, URL, оригінальні відгуки та пакети з попередньої версії. Старі рекламні поля збережені як джерело; вони не публікуються шаблоном.
- `assets/styles.css` — стилі й адаптивні сітки; `assets/fonts.css` і `assets/fonts/` — локальний Montserrat з OFL.
- `assets/app.js` — фільтри, історія, native dialog, prefill і стани форми.
- `assets/form.js` — транспорт форми, timeout, UUID та сувора перевірка підтвердження.

HTML уже містить сторінку, пропозицію та контакти. React/CDN, шрифт із Google під час відкриття, IntersectionObserver та приховування переповнення документа не потрібні. Адреси `/` і `/Portfolio.html` збережено; кейси мають `#case/<slug>`.

```powershell
npm test
npm run test:browser
npm run test:supplemental
npm run test:performance
```

Для браузерних перевірок потрібен встановлений Chrome та запущений `npm start`. Playwright перехоплює всі звернення до webhook. Lighthouse блокує URL приймача. Вимірювання performance також піднімає тимчасовий локальний сервер оригінальної версії з базового Git-коміту; порт 4175 має бути вільним.

Перед публікацією переглянути `review/implementation-report.md`, `docs/form-contract.md` та `docs/measurement-plan.md`. Договірні умови, статуси проєктів, періоди й точний особистий внесок потребують матеріалів власника. Нових фактів про них не вигадували.
