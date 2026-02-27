import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hojnfsltcqixfhsqbbtz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_0GvOqmML6FHrMRxiz34fHQ_lPckxB9E'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
