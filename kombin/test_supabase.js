const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest() {
  const email = `test_${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log(`Testing SignUp for: ${email}`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error('SignUp Error:', signUpError.message);
    return;
  }
  console.log('SignUp Successful! User ID:', signUpData.user?.id);
  console.log('User confirmed status:', signUpData.user?.confirmed_at);

  console.log('Testing SignIn immediately...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    console.error('SignIn Error:', signInError.message);
  } else {
    console.log('SignIn Successful! Session token exists:', !!signInData.session);
  }
}

runTest();
