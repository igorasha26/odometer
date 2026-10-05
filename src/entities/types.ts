/** Доменная модель приложения «Одометр». */

export type UUID = string;
/** Дата в формате 'YYYY-MM-DD'. Без времени — оно здесь не нужно. */
export type ISODate = string;
/** Деньги в минимальных единицах (копейках). Только целые числа. */
export type Money = number;

export interface User {
  id: UUID;
  /** Логин: приводится к нижнему регистру при сохранении и сравнении. */
  email: string;
  name?: string;
  /** PBKDF2 от пароля. Открытый пароль нигде не хранится. */
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export type FuelType =
  | 'ai92' | 'ai95' | 'ai98' | 'ai100'
  | 'diesel' | 'gas' | 'electric';

export const FUEL_LABELS: Record<FuelType, string> = {
  ai92: 'АИ-92',
  ai95: 'АИ-95',
  ai98: 'АИ-98',
  ai100: 'АИ-100',
  diesel: 'Дизель',
  gas: 'Газ',
  electric: 'Электро',
};

export type Transmission = 'auto' | 'manual' | 'cvt' | 'robot';

export interface Car {
  id: UUID;
  /** Владелец. У машин, заведённых до появления входа, поля нет. */
  userId?: UUID;
  brand: string;
  model: string;
  year?: number;
  plate?: string;
  vin?: string;
  engine?: string;
  transmission?: Transmission;
  fuelType: FuelType;
  tankVolume?: number;
  /** Заводской расход, л/100 км — для сравнения с фактическим. */
  factoryConsumption?: number;
  /** Интервал планового ТО, км. */
  serviceIntervalKm?: number;
  /** Интервал планового ТО, месяцев. */
  serviceIntervalMonths?: number;
  /** Пробег на момент добавления машины в систему. */
  initialOdometer: number;
  photo?: string;
  isArchived: boolean;
  createdAt: string;
}

export type CategoryKind =
  | 'fuel' | 'service' | 'parts' | 'repair'
  | 'wash' | 'tax' | 'fine' | 'other';

export interface Category {
  id: UUID;
  name: string;
  kind: CategoryKind;
  color: string;
  /** Системные категории нельзя удалить — только скрыть. */
  isSystem: boolean;
  isHidden: boolean;
  sortOrder: number;
}

export interface FuelDetails {
  liters: number;
  pricePerLiter: Money;
  /** Критично для расчёта расхода: считаем только между полными баками. */
  isFullTank: boolean;
  fuelType: FuelType;
  station?: string;
}

export interface PartDetails {
  partName: string;
  brand?: string;
  article?: string;
  vendor?: string;
  quantity?: number;
}

export interface Entry {
  id: UUID;
  carId: UUID;
  categoryId: UUID;
  date: ISODate;
  odometer: number;
  /**
   * Пробег подставлен автоматически, пользователь его не вводил.
   * Такие значения — догадка, поэтому в расчётах они не считаются опорными точками
   * и обновляются, если пробег машины поправили.
   */
  odometerAuto?: boolean;
  amount: Money;
  note?: string;
  fuel?: FuelDetails;
  part?: PartDetails;
  createdAt: string;
}

export interface Reminder {
  id: UUID;
  carId: UUID;
  title: string;
  categoryId?: UUID;
  dueOdometer?: number;
  dueDate?: ISODate;
  intervalKm?: number;
  intervalMonths?: number;
  isDone: boolean;
  completedEntryId?: UUID;
  createdAt: string;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  id: 'settings';
  currency: string;
  /** Кто вошёл сейчас. Пусто — показываем экран входа. */
  currentUserId?: UUID;
  theme?: ThemeMode;
  /** Свёрнутое боковое меню на широком экране. */
  sidebarCollapsed?: boolean;
  /** Порядок блоков на обзоре. */
  dashboardOrder?: string[];
  activeCarId?: UUID;
  /** Дата последнего экспорта — чтобы напоминать о резервной копии. */
  lastExportAt?: string;
  onboardingDone: boolean;
}

/** Черновики для создания: id и createdAt проставляет репозиторий. */
export type NewCar = Omit<Car, 'id' | 'createdAt' | 'isArchived'> & { isArchived?: boolean };
export type NewEntry = Omit<Entry, 'id' | 'createdAt'>;
export type NewReminder = Omit<Reminder, 'id' | 'createdAt' | 'isDone'> & { isDone?: boolean };
export type NewCategory = Omit<Category, 'id' | 'isSystem'> & { isSystem?: boolean };
