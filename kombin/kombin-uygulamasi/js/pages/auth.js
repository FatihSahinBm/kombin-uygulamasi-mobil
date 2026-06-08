import { auth } from '../auth.js';

export const authUI = {
    init() {
        console.log("Auth UI modülü yüklendi.");
        
        // Element tanımlamaları
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const tabs = document.querySelectorAll('.auth-tab');
        const forms = document.querySelectorAll('.auth-form');
        const subtitle = document.getElementById('auth-subtitle');
        const btnGoogleAuth = document.querySelector('.btn-social'); // Google butonu

        // Tab Geçiş Mantığı
        if (tabs.length > 0) {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const target = tab.getAttribute('data-target');
                    
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    forms.forEach(f => f.classList.remove('active'));
                    const targetForm = document.getElementById(target);
                    if (targetForm) targetForm.classList.add('active');

                    if (subtitle) {
                        if (target === 'register-form') {
                            subtitle.textContent = 'Yeni bir tarz yolculuğuna başla.';
                        } else {
                            subtitle.textContent = 'Tekrar hoş geldin! Hesabına giriş yap.';
                        }
                    }
                });
            });

            // URL parametresine göre tab açma (Hemen Katıl butonu için)
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('tab') === 'register') {
                const registerTab = document.querySelector('[data-target="register-form"]');
                if (registerTab) registerTab.click();
            }
        }

        // Giriş Formu Yönetimi
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                const btn = loginForm.querySelector('.btn-auth');
                btn.textContent = 'Giriş Yapılıyor...';
                
                try {
                    await auth.login(email, password);
                    window.location.href = 'dashboard.html';
                } catch (error) {
                    alert('Giriş başarısız: ' + error.message);
                    btn.textContent = 'Giriş Yap';
                }
            });
        }

        // Kayıt Formu Yönetimi
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('register-name').value;
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                const btn = registerForm.querySelector('.btn-auth');
                btn.textContent = 'Hesap Oluşturuluyor...';
                
                try {
                    await auth.register(name, email, password);
                    alert('Kayıt başarılı! Hesabına yönlendiriliyorsun.');
                    window.location.href = 'onboarding.html';
                } catch (error) {
                    alert('Kayıt başarısız: ' + error.message);
                    btn.textContent = 'Hesap Oluştur';
                }
            });
        }

        // Sosyal Auth (Gerçek Supabase Google Entegrasyonu)
        if (btnGoogleAuth) {
            btnGoogleAuth.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await auth.loginWithGoogle();
                } catch (error) {
                    alert('Google Giriş Hatası: ' + error.message);
                }
            });
        }
    }
};
