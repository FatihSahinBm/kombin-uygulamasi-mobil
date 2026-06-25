const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists (for local development)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envFileContent = fs.readFileSync(envPath, 'utf-8');
    envFileContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const index = trimmed.indexOf('=');
        if (index > 0) {
            const key = trimmed.slice(0, index).trim();
            let val = trimmed.slice(index + 1).trim();
            // Remove wrapping quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            process.env[key] = val;
        }
    });
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const weatherApiKey = process.env.WEATHER_API_KEY || '';

const jsDir = path.join(__dirname, 'js');
if (!fs.existsSync(jsDir)){
    fs.mkdirSync(jsDir, { recursive: true });
}

const envContent = `/**
 * Bu dosya Vercel build-env.js betigi tarafindan otomatik olarak olusturulmustur.
 * Yerel gelistirmede de kullanilabilir.
 */
export const ENV = {
    SUPABASE_URL: '${supabaseUrl}',
    SUPABASE_KEY: '${supabaseKey}',
    GEMINI_API_KEY: '${geminiApiKey}',
    WEATHER_API_KEY: '${weatherApiKey}'
};
`;

fs.writeFileSync(path.join(jsDir, 'env.js'), envContent, 'utf-8');
console.log('js/env.js generated successfully.');
