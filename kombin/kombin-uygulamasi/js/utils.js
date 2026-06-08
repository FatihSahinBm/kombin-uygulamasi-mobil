/**
 * Yardımcı fonksiyonlar (Utility methods)
 * LocalStorage işlemleri vb. standart fonksiyonları barındırır.
 */
export const utils = {
    // LocalStorage veri kaydetme
    saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error("Veri kaydedilemedi:", error);
            return false;
        }
    },

    // LocalStorage veri okuma
    getData(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error("Veri okunamadı:", error);
            return null;
        }
    },
    
    // LocalStorage veri silme
    removeData(key) {
        localStorage.removeItem(key);
    },

    // --- Anasayfa Eklentileri ---
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    escapeHTML(str) {
        const div = document.createElement('div');
        div.innerText = str;
        return div.innerHTML;
    },

    timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = Math.floor(seconds / 31536000);
        if (interval > 1) return interval + " yıl önce";
        interval = Math.floor(seconds / 2592000);
        if (interval > 1) return interval + " ay önce";
        interval = Math.floor(seconds / 86400);
        if (interval > 1) return interval + " gün önce";
        interval = Math.floor(seconds / 3600);
        if (interval > 1) return interval + " saat önce";
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + " dk önce";
        return "az önce";
    }
};
