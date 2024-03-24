import { listen } from "@colyseus/tools";
import app from "./app.config";
import * as fs from 'fs';
import { Assets } from './Assets';
import dotenv from 'dotenv';

// load files to memory
Assets.HTML_ROOMS = fs.readFileSync('assets/rooms.html', 'utf8');
Assets.HTML_HOME = fs.readFileSync('assets/index.html', 'utf8');
dotenv.config();

// Create and listen on 2567 (or PORT environment variable.)
listen(app);
