/*
  # Backfill Missing Profiles

  1. Changes
    - Create profiles for any existing users who don't have one
    - Ensures all users have a corresponding profile entry

  2. Notes
    - This is a one-time data migration for existing users
    - Future users will have profiles created automatically via trigger
*/

-- Insert profiles for users that don't have them
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'User'),
  au.created_at,
  now()
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
