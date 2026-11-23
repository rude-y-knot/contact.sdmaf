import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import {
  claimFirstAdminPassword,
  createSessionToken,
  extractBearerToken,
  getAuthConfigState,
  isTokenValid,
  requireAdmin,
  revokeSessionToken,
  verifyAdminPassword,
} from './server/auth.ts';
import {
  createEmployee,
  deleteEmployee,
  getCompanySettings,
  getDatabasePath,
  getEmployeeById,
  importEmployeesBatch,
  listEmployees,
  reorderEmployees,
  setEmployeeActive,
  updateCompanySettings,
  updateEmployee,
} from './server/db.ts';
import {
  archiveSchema,
  companySettingsSchema,
  employeeIdParamSchema,
  employeePayloadSchema,
  importCsvSchema,
  passwordLoginSchema,
  passwordSetupSchema,
  reorderSchema,
} from './server/validation.ts';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// Security headers (frame-safe for preview & standard hardening)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Повторите через 15 минут.' },
});

// ==================== PUBLIC API ROUTES ====================

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    database: 'sqlite',
    storage: path.basename(getDatabasePath()),
  });
});

app.get('/api/settings/public', (_req, res) => {
  res.json(getCompanySettings());
});

app.get('/api/cards/:id', (req, res) => {
  const idParse = employeeIdParamSchema.safeParse(req.params.id);
  if (!idParse.success) {
    res.status(400).json({ error: 'Некорректный идентификатор визитки.' });
    return;
  }

  const employee = getEmployeeById(idParse.data, true);
  if (!employee) {
    res.status(404).json({ error: 'Визитная карточка не найдена.' });
    return;
  }

  res.json({
    employee,
    settings: getCompanySettings(),
  });
});

// ==================== AUTH API ROUTES ====================

app.get('/api/auth/status', (req, res) => {
  const config = getAuthConfigState();
  const token = extractBearerToken(req);
  const authenticated = isTokenValid(token);
  res.json({
    needsSetup: config.needsSetup,
    authSource: config.source,
    authenticated,
  });
});

app.post('/api/auth/setup', authLimiter, (req, res) => {
  const parsed = passwordSetupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некорректный пароль.' });
    return;
  }

  const result = claimFirstAdminPassword(parsed.data.password);
  if (!result.ok) {
    res.status(403).json({ error: result.error });
    return;
  }

  const session = createSessionToken();
  res.status(201).json({
    token: session.token,
    expiresAt: session.expiresAt,
  });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const config = getAuthConfigState();
  if (config.needsSetup) {
    res.status(409).json({ error: 'Сначала задайте пароль администратора.' });
    return;
  }

  const parsed = passwordLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Введите пароль.' });
    return;
  }

  if (!verifyAdminPassword(parsed.data.password)) {
    res.status(401).json({ error: 'Неверный пароль. Попробуйте ещё раз.' });
    return;
  }

  const session = createSessionToken();
  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
  });
});

app.post('/api/auth/logout', requireAdmin, (req, res) => {
  const token = extractBearerToken(req);
  if (token) {
    revokeSessionToken(token);
  }
  res.json({ ok: true });
});

// ==================== ADMIN PROTECTED API ROUTES ====================

app.get('/api/employees', requireAdmin, (_req, res) => {
  res.json({
    employees: listEmployees(true),
    settings: getCompanySettings(),
  });
});

app.post('/api/employees', requireAdmin, (req, res) => {
  const parsed = employeePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Ошибка валидации данных.' });
    return;
  }

  const created = createEmployee(parsed.data);
  res.status(201).json({ employee: created });
});

app.put('/api/employees/:id', requireAdmin, (req, res) => {
  const idParse = employeeIdParamSchema.safeParse(req.params.id);
  if (!idParse.success) {
    res.status(400).json({ error: 'Некорректный ID сотрудника.' });
    return;
  }

  const parsed = employeePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Ошибка валидации данных.' });
    return;
  }

  const updated = updateEmployee(idParse.data, parsed.data);
  if (!updated) {
    res.status(404).json({ error: 'Сотрудник не найден.' });
    return;
  }

  res.json({ employee: updated });
});

app.patch('/api/employees/:id/archive', requireAdmin, (req, res) => {
  const idParse = employeeIdParamSchema.safeParse(req.params.id);
  if (!idParse.success) {
    res.status(400).json({ error: 'Некорректный ID сотрудника.' });
    return;
  }

  const parsed = archiveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Укажите статус активности.' });
    return;
  }

  const updated = setEmployeeActive(idParse.data, parsed.data.isActive);
  if (!updated) {
    res.status(404).json({ error: 'Сотрудник не найден.' });
    return;
  }

  res.json({ employee: updated });
});

app.delete('/api/employees/:id', requireAdmin, (req, res) => {
  const idParse = employeeIdParamSchema.safeParse(req.params.id);
  if (!idParse.success) {
    res.status(400).json({ error: 'Некорректный ID сотрудника.' });
    return;
  }

  const deleted = deleteEmployee(idParse.data);
  if (!deleted) {
    res.status(404).json({ error: 'Сотрудник не найден.' });
    return;
  }

  res.json({ ok: true });
});

app.post('/api/employees/reorder', requireAdmin, (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Некорректный список сортировки.' });
    return;
  }

  reorderEmployees(parsed.data.items);
  res.json({ employees: listEmployees(true) });
});

app.post('/api/employees/import-csv', requireAdmin, (req, res) => {
  const parsed = importCsvSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Некорректные данные CSV.' });
    return;
  }

  const stats = importEmployeesBatch(parsed.data.employees, parsed.data.replaceAll);
  res.json({
    ...stats,
    employees: listEmployees(true),
  });
});

function escapeCsvCell(value: string): string {
  const neutralized = /^[=@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r;]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

app.get('/api/employees/export-csv', requireAdmin, (_req, res) => {
  const rows = listEmployees(true);
  const header = [
    'ID',
    'Имя',
    'Фамилия',
    'Телефон',
    'Почта',
    'Должность',
    'Департамент',
    'Сайт компании',
    'Адрес компании',
    'Мессенджер Макс',
    'Telegram',
    'Статус',
  ];

  const lines = [
    header.map(escapeCsvCell).join(','),
    ...rows.map((emp) =>
      [
        emp.id,
        emp.firstName,
        emp.lastName,
        emp.phone,
        emp.email,
        emp.title,
        emp.department,
        emp.website,
        emp.address,
        emp.maxMessenger ? 'Есть' : 'Нет',
        emp.telegram ? `https://t.me/${emp.telegram}` : '',
        emp.isActive === false ? 'Архив' : 'Активна',
      ]
        .map((v) => escapeCsvCell(String(v ?? '')))
        .join(',')
    ),
  ];

  const bom = '\uFEFF';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sdmaf_employees.csv"');
  res.send(bom + lines.join('\r\n'));
});

app.put('/api/settings', requireAdmin, (req, res) => {
  const parsed = companySettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Ошибка валидации настроек.' });
    return;
  }

  const updated = updateCompanySettings(parsed.data);
  res.json({ settings: updated });
});

// ==================== FRONTEND SERVING ====================

async function startServer() {
  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { index: false }));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api/')) {
          next();
          return;
        }
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API маршрут не найден.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Contact SDMAF server listening on http://0.0.0.0:${PORT} (DB: ${getDatabasePath()})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
