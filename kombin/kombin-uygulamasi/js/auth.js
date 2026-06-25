import { supabase } from './config.js';

const SESSION_KEY = 'kombin_ai_session';
const USER_KEY = 'kombin_ai_user';

/**
 * Kombin.AI Authentication & Session Management
 * Artık Supabase Auth kullanılarak işlemler yapılıyor.
 */
export const auth = {
    /**
     * Login user
     * @param {string} email 
     * @param {string} password 
     */
    async login(email, password) {
        if (!supabase) {
            console.warn("Supabase yapılandırılmamış. Mock log-in kullanılıyor.");
            localStorage.setItem(SESSION_KEY, 'true');
            return true;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Giriş hatası:', error.message);
            throw error;
        }

        localStorage.setItem(SESSION_KEY, 'true');
        return true;
    },

    /**
     * Google ile giriş
     */
    async loginWithGoogle() {
        if (!supabase) {
            console.warn("Supabase yapılandırılmamış.");
            return;
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/dashboard.html'
            }
        });

        if (error) {
            console.error('Google Giriş hatası:', error.message);
            throw error;
        }
    },

    /**
     * Register new user
     * @param {string} name 
     * @param {string} email 
     * @param {string} password 
     */
    async register(name, email, password) {
        if (!supabase) {
            console.warn("Supabase yapılandırılmamış. Mock kaydı kullanılıyor.");
            localStorage.setItem(SESSION_KEY, 'true');
            return true;
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                }
            }
        });

        if (error) {
            console.error('Kayıt hatası:', error.message);
            throw error;
        }

        /* Başarılı kayıt sonrası profil tablosuna eklenebilir veya direkt login sayılınabilir. */
        localStorage.setItem(SESSION_KEY, 'true');
        return true;
    },

    /**
     * Logout user
     */
    async logout() {
        if (supabase) {
            await supabase.auth.signOut();
        }
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(USER_KEY);
        window.location.href = 'index.html';
    },

    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return localStorage.getItem(SESSION_KEY) === 'true';
    },

    /**
     * Check active session (with Supabase fallback) and sync
     */
    async checkSession() {
        if (supabase) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    localStorage.setItem(SESSION_KEY, 'true');
                    return true;
                } else {
                    localStorage.removeItem(SESSION_KEY);
                    localStorage.removeItem(USER_KEY);
                    return false;
                }
            } catch (err) {
                console.error("Session check error:", err);
                return this.isLoggedIn();
            }
        }
        return this.isLoggedIn();
    },

    /**
     * Get current user data
     */
    async getCurrentUser() {
        if (!supabase) {
            return { id: 'mock-id', email: 'test@example.com', name: 'Test User' };
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            return {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || user.email.split('@')[0]
            };
        }
        return null;
    },

    /**
     * Require auth to access a page
     */
    async requireAuth() {
        // Eğer URL'de Supabase'in Google'dan getirdiği token varsa (hash) 
        // Kullanıcı giriş yapmış demektir, Supabase'in işlemesi için ufak bir pay tanı
        if (window.location.hash.includes('access_token')) {
            localStorage.setItem(SESSION_KEY, 'true');
            await new Promise(r => setTimeout(r, 800)); // Supabase token process delay
        }

        if (!this.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        } 
        
        if (supabase) {
            // Sunucudan token kontrolü yap
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                this.logout();
            }
        }
    }
};
