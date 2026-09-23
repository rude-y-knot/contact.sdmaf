import { Employee } from './types';

export const COMPANY_NAME = 'Стальное дело';
export const COMPANY_PHONE = '+7 812 200-77-06';
export const COMPANY_WEBSITE = 'www.sdmaf.ru';
export const COMPANY_ADDRESS = 'Санкт-Петербург, г. Колпино, Финлядская д. 3';

export const INITIAL_SHEET_DATA: Employee[] = [
  { 
    id: 'yuriy-stanislavskiy', 
    firstName: 'Юрий', 
    lastName: 'Станиславский', 
    phone: '+79214388883', 
    email: 'marketing@kom3.ru', 
    title: 'Директор по маркетингу', 
    website: 'www.sdmaf.ru', 
    address: 'Санкт-Петербург, г. Колпино, Финлядская д. 3',
    department: 'Маркетинг',
    telegram: 'y_knt', 
    whatsapp: '79214388883',
    maxMessenger: false
  },
  { 
    id: 'tatyana-matina', 
    firstName: 'Татьяна', 
    lastName: 'Матина', 
    phone: '+79291539551', 
    email: 'mt@sdmaf.ru', 
    title: 'Директор по продажам', 
    website: 'www.sdmaf.ru', 
    address: 'Санкт-Петербург, г. Колпино, Финлядская д. 3',
    department: 'Продажи',
    telegram: 'sdmaf_sale', 
    whatsapp: '79291539551',
    maxMessenger: true
  },
  { 
    id: 'dmitriy-galkovskiy', 
    firstName: 'Дмитрий', 
    lastName: 'Галковский', 
    phone: '+79210999905', 
    email: 'gda@sdmaf.ru', 
    title: 'Генеральный директор', 
    website: 'www.sdmaf.ru', 
    address: 'Санкт-Петербург, г. Колпино, Финлядская д. 3',
    department: 'Управление',
    telegram: 'DmitryGalk', 
    whatsapp: '79210999905',
    maxMessenger: true
  },
  { 
    id: 'konstantin-mezenin', 
    firstName: 'Константин', 
    lastName: 'Мезенин', 
    phone: '+79119597956', 
    email: '', 
    title: 'Управляющий партнёр', 
    website: 'www.sdmaf.ru', 
    address: 'Санкт-Петербург, г. Колпино, Финлядская д. 3',
    department: 'Управление',
    telegram: '', 
    whatsapp: '79119597956',
    maxMessenger: false
  },
  { 
    id: 'anastasiya-gulyaeva', 
    firstName: 'Анастасия', 
    lastName: 'Гуляева', 
    phone: '+79112901150', 
    email: 'info@sdmaf.ru', 
    title: 'Менеджер по продажам', 
    website: 'www.sdmaf.ru', 
    address: 'Санкт-Петербург, г. Колпино, Финлядская д. 3',
    department: 'Продажи',
    telegram: '', 
    whatsapp: '79112901150',
    maxMessenger: true
  },
  { 
    id: 'sergey-seroev', 
    firstName: 'Сергей', 
    lastName: 'Сероев', 
    phone: '+79217636571', 
    email: 'info@sdmaf.ru', 
    title: 'Главный конструктор', 
    website: 'www.sdmaf.ru', 
    address: 'Санкт-Петербург, г. Колпино, Финлядская д. 3',
    department: 'Проектирование',
    telegram: '', 
    whatsapp: '79217636571',
    maxMessenger: true
  }
];

export const DEPARTMENTS = [
  'Все', 
  'Управление', 
  'Маркетинг', 
  'Продажи', 
  'Проектирование'
];
