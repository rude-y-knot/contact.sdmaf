import { z } from 'zod';

const safeWebsiteSchema = z
  .string()
  .trim()
  .max(200)
  .refine((val) => {
    if (!val) return true;
    const lower = val.toLowerCase();
    return !lower.startsWith('javascript:') && !lower.startsWith('data:') && !lower.startsWith('vbscript:');
  }, 'Недопустимый формат сайта');

export const employeeIdParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Недопустимый идентификатор визитки');

export const employeePayloadSchema = z.object({
  id: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-zA-Z0-9а-яА-ЯёЁ\s_-]*$/, 'Недопустимые символы в URL-слаге')
    .optional(),
  firstName: z.string().trim().min(1, 'Укажите имя').max(80),
  lastName: z.string().trim().min(1, 'Укажите фамилию').max(80),
  title: z.string().trim().min(1, 'Укажите должность').max(140),
  department: z.string().trim().min(1).max(80).default('Продажи'),
  phone: z.string().trim().max(40).default(''),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Некорректный формат e-mail')
    .default(''),
  website: safeWebsiteSchema.default('www.sdmaf.ru'),
  address: z.string().trim().max(240).default('Санкт-Петербург, г. Колпино, Финлядская д. 3'),
  telegram: z.string().trim().max(120).default(''),
  whatsapp: z.string().trim().max(40).default(''),
  maxMessenger: z.boolean().default(false),
  isActive: z.boolean().optional(),
});

export const archiveSchema = z.object({
  isActive: z.boolean(),
});

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: employeeIdParamSchema,
        sortOrder: z.number().int().min(0).max(10000),
      })
    )
    .min(1)
    .max(500),
});

export const importCsvSchema = z.object({
  employees: z.array(employeePayloadSchema).min(1).max(500),
  replaceAll: z.boolean().default(false),
});

export const companySettingsSchema = z.object({
  companyName: z.string().trim().min(1, 'Укажите название компании').max(120),
  companyPhone: z.string().trim().min(1, 'Укажите общий телефон').max(40),
  companyWebsite: safeWebsiteSchema,
  companyAddress: z.string().trim().min(1, 'Укажите адрес компании').max(240),
});

export const passwordLoginSchema = z.object({
  password: z.string().min(1, 'Введите пароль').max(128),
});

export const passwordSetupSchema = z.object({
  password: z
    .string()
    .min(6, 'Пароль должен содержать минимум 6 символов')
    .max(128),
});
