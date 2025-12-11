import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nnhulurfvyjxsjnlruee.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaHVsdXJmdnlqeHNqbmxydWVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjY2OTMsImV4cCI6MjA4MTAwMjY5M30.mTkheLovS0diJ_AAhDCSBuMJ-eEDkzy8faZppVDOzfM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);