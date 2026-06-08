const url = "https://your-supabase-url.supabase.co/rest/v1/users?limit=1";
const key = "your-supabase-anon-key";

fetch(url, {
  headers: {
    "apikey": key,
    "Authorization": "Bearer " + key,
  }
}).then(res => res.json())
  .then(data => {
    if (data.message) {
      console.log("HATA: " + data.message);
    } else {
      console.log("BASARILI!");
    }
  }).catch(err => console.log("FETCH HATASI: ", err.message));
