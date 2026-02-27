const SUPABASE_URL = 'https://hojnfsltcqixfhsqbbtz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0GvOqmML6FHrMRxiz34fHQ_lPckxB9E';

async function fixAdmin() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users?role=eq.user`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ role: 'admin' })
        });
        const data = await res.json();
        console.log('Fixed users to admin:', data);
    } catch (e) {
        console.error(e);
    }
}

fixAdmin();
