import { CONFIG } from '../config.js';
import { utils } from '../utils.js';
import { api } from '../api.js';

export const onboarding = {
    async init() {
        console.log("Onboarding modülü yüklendi.");

        // Profil zaten oluşturulmuşsa profil sayfasına yönlendir
        try {
            const userProfile = await api.getUserProfile();
            const meta = userProfile?.metadata || {};
            const prefs = userProfile?.preferences || {};
            const hasMetaProfile = Boolean(
                meta.gender ||
                meta.age ||
                meta.height ||
                meta.weight ||
                meta.bodyType ||
                meta.skinTone ||
                meta.eyeColor ||
                meta.hairColor ||
                meta.hairType ||
                meta.faceShape ||
                meta.preferredColors
            );
            const hasPrefsProfile = Boolean(
                prefs.gender ||
                prefs.style ||
                (typeof prefs.budget === 'number' && !Number.isNaN(prefs.budget))
            );
            const hasProfile = hasMetaProfile || hasPrefsProfile;
            if (hasProfile) {
                window.location.href = 'profile.html';
                return;
            }
        } catch (err) {
            // profil yoksa devam et
        }

        const onboardingForm = document.getElementById('onboardingForm');
        const steps = document.querySelectorAll('.form-step');
        const nextBtn = document.getElementById('btnNext');
        const prevBtn = document.getElementById('btnPrev');
        const progressBar = document.getElementById('progressBar');
        const stepLabels = document.querySelectorAll('.step-label');
        
        // Mevcut Profili Yükleme
        try {
            const userProfile = await api.getUserProfile();
            if (userProfile && userProfile.metadata) {
                const meta = userProfile.metadata;
                ['age', 'height', 'weight', 'bodyType', 'skinTone', 'eyeColor', 'hairColor', 'hairType', 'faceShape', 'preferredColors'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el && meta[id]) el.value = meta[id];
                });
                
                const existingGender = (userProfile.preferences && userProfile.preferences.gender) || meta.gender;
                if (existingGender) {
                    const genderRadio = document.querySelector(`input[name="gender"][value="${existingGender}"]`);
                    if (genderRadio) genderRadio.checked = true;
                }
            }
        } catch (err) {
            console.warn("Önceden kayıtlı profil yüklenemedi:", err);
        }

        let currentStep = 1;
        const totalSteps = steps.length;

        const updateStepUI = () => {
            steps.forEach(step => {
                step.classList.toggle('active', parseInt(step.dataset.step) === currentStep);
            });

            const progress = (currentStep / totalSteps) * 100;
            if (progressBar) progressBar.style.width = `${progress}%`;

            stepLabels.forEach((label, index) => {
                const stepNum = index + 1;
                label.classList.toggle('active', stepNum === currentStep);
                label.classList.toggle('completed', stepNum < currentStep);
            });

            if (prevBtn) prevBtn.style.display = currentStep === 1 ? 'none' : 'block';
            
            if (nextBtn) {
                if (currentStep === totalSteps) {
                    nextBtn.innerHTML = `Kaydı Tamamla <span style="font-size: 1.2rem;">✨</span>`;
                } else {
                    nextBtn.innerHTML = `Devam Et <span style="font-size: 1.2rem;">→</span>`;
                }
            }
        };

        const validateStep = (stepNum) => {
            const currentStepEl = document.querySelector(`.form-step[data-step="${stepNum}"]`);
            if (!currentStepEl) return true;
            const inputs = currentStepEl.querySelectorAll('input, select');
            let isValid = true;

            inputs.forEach(input => {
                if (!input.checkValidity()) {
                    input.reportValidity();
                    isValid = false;
                }
            });

            return isValid;
        };

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (validateStep(currentStep)) {
                    if (currentStep < totalSteps) {
                        currentStep++;
                        updateStepUI();
                    } else {
                        // Son adım, formu gönder
                        if (onboardingForm) onboardingForm.requestSubmit();
                    }
                }
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentStep > 1) {
                    currentStep--;
                    updateStepUI();
                }
            });
        }

        if (onboardingForm) {
            onboardingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(onboardingForm);
                const userObj = Object.fromEntries(formData.entries());
                
                utils.saveData(CONFIG.STORAGE_KEY_USERINFO, userObj);
                window.location.href = 'styles.html';
            });
        }

        // İlk yüklemede UI güncelle
        updateStepUI();
    }
};
