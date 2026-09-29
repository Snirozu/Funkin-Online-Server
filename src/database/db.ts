import { PrismaClient } from '@prisma/client';
import { Clubs } from './clubs';
import { DatabaseCache } from './db.cache';
import { Mods } from './mods';
import { Reports } from './reports';
import { Scores } from './scores';
import { Songs } from './songs';
import { Users } from './users';

export const prisma = new PrismaClient();

export const KEYS_LIST:Array<number> = [4, 5, 6, 7, 8, 9];

class Database {
    users = new Users();
    scores = new Scores();
    songs = new Songs();
    reports = new Reports();
    mods = new Mods();
    clubs = new Clubs();

    cache = new DatabaseCache();
}

export const db = new Database();