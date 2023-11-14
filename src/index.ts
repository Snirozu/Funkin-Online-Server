import { listen } from "@colyseus/tools";
import app from "./app.config";
import * as fs from 'fs';
import { Assets } from './Assets';

Assets.HTML_THEME = fs.readFileSync('assets/style.html', 'utf8');

// Create and listen on 2567 (or PORT environment variable.)
listen(app);
