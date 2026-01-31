
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hqekfvfarxscxozpxouh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZWtmdmZhcnhzY3hvenB4b3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Njk1OTEsImV4cCI6MjA4MzQ0NTU5MX0.DUqLFwf1UwdTurHy2gd5SE-l9NhUQ6F19G5YTzUE4ik';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
