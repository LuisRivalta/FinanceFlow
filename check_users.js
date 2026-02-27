const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://hojnfsltcqixfhsqbbtz.supabase.co', 'sb_publishable_0GvOqmML6FHrMRxiz34fHQ_lPckxB9E');

async function check() {
    let { data, error } = await supabase.from('users').select('*');
    console.log(data, error);

    // update all users to admin
    await supabase.from('users').update({ role: 'admin' }).neq('id', 0);

    // fetch again
    let res = await supabase.from('users').select('*');
    console.log(res.data);
}
check();
