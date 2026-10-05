import { localRepository } from './local';
import type { Repository } from './types';

/**
 * Точка подмены реализации. Появится сервер — здесь встанет apiRepository,
 * и больше нигде в приложении менять ничего не придётся.
 */
export const repository: Repository = localRepository;

export type { Repository, EntryFilter, BackupFile } from './types';
